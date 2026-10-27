import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { THEMES, type Room, type RoomTheme } from "./rooms";
import { roomsQuery } from "./roomQueries";
import { RoomQueryState } from "./RoomQueryState";

function RoomCard({ room }: { room: Room }) {
  return <Link className="rooms-card" to={`/rooms/${room.id}/preview`}>
    <div className="rooms-thumb">
      <img src={room.image} alt={`Không gian ${room.name}`} width="640" height="400" loading="lazy" />
      <span className="rooms-tag">{room.theme}</span>
    </div>
    <div className="rooms-card-meta">
      <h2>{room.name}</h2>
      <span className="rooms-online">Tối đa {room.maxSlots} người</span>
    </div>
  </Link>;
}

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const themeParam = params.get("theme");
  const theme: RoomTheme = THEMES.find((item) => item === themeParam) || "All Rooms";
  const query = params.get("q") || "";
  const [input, setInput] = useState(query);
  useEffect(() => { setInput(query); }, [query]);
  useEffect(() => {
    if (input === query) return;
    const timer = window.setTimeout(() => {
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        if (input) next.set("q", input);
        else next.delete("q");
        return next;
      }, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [input, query, setParams]);
  const result = useQuery(roomsQuery(theme, query));
  const rooms = result.data ?? [];
  const updating = input !== query || result.isFetching;

  function updateFilter(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value && value !== "All Rooms") next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  }

  return <main className="rooms-container" id="room-main" tabIndex={-1}>
    <section className="rooms-intro" aria-labelledby="explore-title">
      <div><h1 id="explore-title">Explore Rooms</h1><p>Khám phá không gian học tập, kết nối cùng bạn bè và nâng cao hiệu suất.</p></div>
      <label className="rooms-search"><span className="rooms-sr-only">Tìm kiếm phòng học</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg><input type="search" maxLength={100} value={input} placeholder="Tìm kiếm phòng học…" onChange={(event) => setInput(event.target.value)} /></label>
    </section>
    <div className="rooms-filters" aria-label="Lọc theo chủ đề">
      {THEMES.map((item) => <button key={item} className={theme === item ? "is-active" : ""} aria-pressed={theme === item} onClick={() => updateFilter("theme", item)}>{item}</button>)}
    </div>
    <div className="rooms-result-info"><p aria-live="polite">{updating ? "Đang tải phòng..." : result.isError ? "Không tải được danh sách phòng" : `${rooms.length} không gian học tập`}</p><span>Chưa hỗ trợ trạng thái online realtime</span></div>
    {result.isPending || result.isError ? <RoomQueryState pending={result.isPending} error={result.error} retry={() => { void result.refetch(); }} />
      : rooms.length ? <div className="rooms-grid" aria-busy={updating}>{rooms.map((room) => <RoomCard room={room} key={room.id} />)}</div>
      : <section className="rooms-empty" aria-labelledby="rooms-empty-title"><h2 id="rooms-empty-title">Không tìm thấy phòng nào</h2><p>Thử từ khóa hoặc chủ đề khác nhé.</p><button className="rooms-button" onClick={() => setParams({})}>Xem tất cả phòng</button></section>}
  </main>;
}

export function MyRoomsPage() {
  const [selectedRoom, setSelectedRoom] = useState("");
  const result = useQuery(roomsQuery());
  const rooms = result.data ?? [];
  const selected = rooms.find((room) => room.id === selectedRoom);
  return <main className="rooms-container" id="room-main" tabIndex={-1}>
    <section className="rooms-intro"><div><h1>My Rooms</h1><p>Chọn một không gian tập trung dành cho bạn.</p></div></section>
    <section className="rooms-my-space">
      <img src="/room-assets/rainy.jpg" alt="Góc bàn học nhìn ra cửa sổ mưa" width="640" height="400" />
      <div><h2>Không gian của bạn</h2><p>Bạn có thể chọn phòng công khai để dùng Pomodoro và danh sách công việc.</p>
        {result.isPending || result.isError ? <RoomQueryState pending={result.isPending} error={result.error} retry={() => { void result.refetch(); }} /> : <>
          {!rooms.length && <p role="status">Chưa có phòng công khai.</p>}
          <label htmlFor="personal-room">Chọn không gian</label>
          <select id="personal-room" value={selected?.id ?? ""} onChange={(event) => setSelectedRoom(event.target.value)}><option value="">Chọn một phòng…</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select>
          {selected ? <Link className="rooms-button" to={`/rooms/${selected.id}`}>Mở không gian tập trung</Link> : <button className="rooms-button" disabled>Chọn phòng để tiếp tục</button>}
        </>}
        <Link className="rooms-text-link" to="/rooms">Khám phá tất cả phòng</Link>
      </div>
    </section>
  </main>;
}
