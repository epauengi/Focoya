import { useRef, useState, useSyncExternalStore } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { getSession, subscribeSession } from "@/auth/session";
import type { Room } from "./rooms";
import { privateRoomMessage } from "./privateRooms";
import { ownedRoomsQuery } from "./privateRoomQueries";
import { CreatePrivateRoomForm } from "./CreatePrivateRoomForm";
import { JoinByCodeForm } from "./JoinByCodeForm";
import { InviteCodeShare } from "./InviteCodeShare";
import "./private-rooms.css";

const MAX_OWNED_ROOMS = 2;

function OwnedRoomCard({ room }: { room: Room }) {
  const [failedSrc, setFailedSrc] = useState("");
  const showFallback = failedSrc === room.image;

  return (
    <article className="prooms-card" aria-labelledby={`owned-room-${room.id}`}>
      <div className="prooms-card-thumb">
        {showFallback ? (
          <p className="rooms-scene-fallback" role="status">
            Không tải được ảnh phòng.
          </p>
        ) : (
          <img
            src={room.image}
            alt={`Không gian ${room.name}`}
            width="640"
            height="360"
            loading="lazy"
            onError={() => setFailedSrc(room.image)}
          />
        )}
        <div className="prooms-card-badges">
          <span className="prooms-badge">{room.theme}</span>
          <span className="prooms-badge prooms-badge--private">
            {room.visibility === "PRIVATE" ? "Riêng tư" : "Công khai"}
          </span>
        </div>
      </div>

      <div className="prooms-card-body">
        <div className="prooms-card-title">
          <h3 id={`owned-room-${room.id}`}>{room.name}</h3>
        </div>
        <p className="prooms-card-desc">
          {room.description.trim() || "Phòng chưa có mô tả."}
        </p>

        <dl className="prooms-card-stats">
          <div>
            <dt>Online (lần tải gần nhất)</dt>
            <dd>{room.online}</dd>
          </div>
          <div>
            <dt>Tối đa</dt>
            <dd>{room.maxSlots} chỗ</dd>
          </div>
        </dl>

        <InviteCodeShare inviteCode={room.inviteCode} roomName={room.name} compact />
      </div>

      <div className="prooms-card-actions">
        <Link className="rooms-button" to={`/rooms/${room.id}/preview`}>
          Xem trước phòng
        </Link>
      </div>
    </article>
  );
}

export function MyRoomsPage() {
  const { user } = useSyncExternalStore(subscribeSession, getSession);
  const userId = user?.id;
  const result = useQuery(ownedRoomsQuery(userId));
  const rooms = result.data ?? [];

  const [showCreateForm, setShowCreateForm] = useState(false);
  const restoreCreateFocus = useRef(false);

  const ownedKnown = result.isSuccess;
  const limitReached = ownedKnown && rooms.length >= MAX_OWNED_ROOMS;

  function openCreateForm() {
    if (!ownedKnown || limitReached) return;
    setShowCreateForm(true);
  }

  function closeCreateForm() {
    restoreCreateFocus.current = true;
    setShowCreateForm(false);
  }

  return (
    <main
      className="rooms-container prooms-page"
      id="room-main"
      tabIndex={-1}
      aria-labelledby="my-rooms-title"
      aria-busy={result.isPending}
    >
      <header className="prooms-header">
        <div>
          <h1 id="my-rooms-title">Phòng của tôi</h1>
          <p>
            Tạo phòng học riêng tư bằng mã mời, tham gia phòng của bạn bè hoặc mở lại các phòng bạn
            đã tạo. Mỗi tài khoản tạo tối đa {MAX_OWNED_ROOMS} phòng riêng.
          </p>
        </div>

        <div className="prooms-header-actions">
          <button
            type="button"
            className="rooms-button"
            disabled={showCreateForm || !ownedKnown || limitReached}
            aria-expanded={showCreateForm}
            aria-describedby={limitReached ? "my-rooms-limit-note" : undefined}
            ref={(button) => {
              if (button && restoreCreateFocus.current) {
                restoreCreateFocus.current = false;
                button.focus();
              }
            }}
            onClick={openCreateForm}
          >
            Tạo phòng riêng
          </button>
        </div>
      </header>

      {limitReached && !showCreateForm && (
        <p id="my-rooms-limit-note" className="prooms-limit-note" role="status">
          Bạn đã tạo đủ {MAX_OWNED_ROOMS}/{MAX_OWNED_ROOMS} phòng riêng. Bạn có thể chia sẻ mã mời
          của các phòng bên dưới hoặc tham gia phòng khác bằng mã mời.
        </p>
      )}

      {showCreateForm && (
        <section className="prooms-panel" aria-label="Biểu mẫu tạo phòng riêng">
          <CreatePrivateRoomForm
            key={userId ?? "anon"}
            userId={userId}
            ownedCount={rooms.length}
            maxOwned={MAX_OWNED_ROOMS}
            autoFocus
            onCancel={closeCreateForm}
          />
        </section>
      )}

      <section className="prooms-panel" aria-label="Tham gia phòng riêng bằng mã mời">
        <JoinByCodeForm key={`join-${userId ?? "anon"}`} userId={userId} />
      </section>

      <section className="prooms-section" aria-labelledby="owned-rooms-heading">
        <div className="prooms-section-head">
          <div>
            <h2 id="owned-rooms-heading">Phòng riêng bạn đã tạo</h2>
            <p>
              Số lượng online hiển thị theo dữ liệu máy chủ ở lần tải gần nhất.
            </p>
          </div>
          {ownedKnown && (
            <span className="prooms-count">
              {rooms.length}/{MAX_OWNED_ROOMS} phòng
            </span>
          )}
        </div>

        {result.isFetching && !result.isPending && (
          <p className="prooms-status" role="status">
            Đang cập nhật danh sách phòng…
          </p>
        )}

        {result.isPending ? (
          <section className="rooms-empty" role="status">
            <h2>Đang tải phòng của bạn…</h2>
          </section>
        ) : result.isError ? (
          <section className="rooms-empty" role="alert">
            <h2>Không tải được danh sách phòng riêng</h2>
            <p>{privateRoomMessage(result.error, "mine")}</p>
            <button
              type="button"
              className="rooms-button"
              disabled={result.isFetching}
              onClick={() => {
                void result.refetch();
              }}
            >
              {result.isFetching ? "Đang thử lại…" : "Thử lại"}
            </button>
          </section>
        ) : rooms.length === 0 ? (
          <section className="rooms-empty" aria-labelledby="owned-empty-title">
            <h3 id="owned-empty-title">Bạn chưa tạo phòng riêng nào</h3>
            <p>
              Tạo tối đa {MAX_OWNED_ROOMS} phòng riêng để học cùng nhóm bạn qua mã mời, hoặc nhập mã
              mời ở trên để tham gia phòng khác.
            </p>
            {!showCreateForm && (
              <button type="button" className="rooms-button" onClick={openCreateForm}>
                Tạo phòng riêng đầu tiên
              </button>
            )}
          </section>
        ) : (
          <div className="prooms-grid">
            {rooms.map((room) => (
              <OwnedRoomCard key={room.id} room={room} />
            ))}
          </div>
        )}
      </section>

      <section className="prooms-explore-strip" aria-label="Phòng học công khai">
        <p>Muốn tham gia các không gian học tập mở dành cho cộng đồng?</p>
        <Link className="prooms-secondary prooms-button-sm" to="/rooms">
          Khám phá phòng công khai
        </Link>
      </section>
    </main>
  );
}
