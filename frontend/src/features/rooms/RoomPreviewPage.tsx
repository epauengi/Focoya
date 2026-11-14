import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { roomQuery } from "./roomQueries";
import { RoomQueryState } from "./RoomQueryState";

export function RoomPreviewPage() {
  const { roomId } = useParams();
  const result = useQuery(roomQuery(roomId));
  const room = result.data;
  const [failedImage, setFailedImage] = useState("");

  return <main className="rooms-container" id="room-main" tabIndex={-1} aria-busy={result.isPending}>
    <Link className="rooms-back" to="/rooms"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>Quay lại Explore</Link>
    {result.isPending || result.isError || !room ? <RoomQueryState pending={result.isPending} error={result.error} retry={() => { void result.refetch(); }} /> : <div className="rooms-preview">
      <div className="rooms-scene">
        {failedImage === room.image ? <p className="rooms-scene-fallback" role="status">Không tải được ảnh không gian. Bạn vẫn có thể vào phòng.</p> : <img key={room.image} src={room.image} alt={`Không gian ${room.name}`} width="960" height="800" decoding="async" fetchPriority="high" onError={() => setFailedImage(room.image)} />}
        <span className="rooms-tag">{room.theme}</span>
      </div>
      <section className="rooms-preview-info" aria-labelledby="preview-title">
        <h1 id="preview-title">{room.name}</h1>
        <span className="rooms-theme-label">Chủ đề: {room.theme}</span>
        <p className="rooms-preview-description">{room.description.trim() || "Phòng chưa có mô tả."}</p>
        <dl className="rooms-slot-stats" aria-describedby="room-presence-note">
          <div><dt>Đang online</dt><dd><span aria-hidden="true">—</span><span className="rooms-sr-only">Chưa có dữ liệu</span></dd></div>
          <div><dt>Tối đa</dt><dd>{room.maxSlots}<span className="rooms-sr-only"> người</span></dd></div>
          <div><dt>Chỗ trống</dt><dd><span aria-hidden="true">—</span><span className="rooms-sr-only">Chưa có dữ liệu</span></dd></div>
        </dl>
        {/* ponytail: online is a backend placeholder; derive slots and block Join only when presence is authoritative. */}
        <p className="rooms-demo-note" id="room-presence-note">Chưa có dữ liệu online và chỗ trống thực tế; chưa thể xác định phòng đầy.</p>
        <div className="rooms-join">
          <Link className="rooms-button" to={`/rooms/${room.id}`}>Vào phòng<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></Link>
          <Link className="rooms-text-link" to="/rooms">Chọn phòng khác</Link>
        </div>
      </section>
    </div>}
  </main>;
}
