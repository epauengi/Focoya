import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { roomQuery } from "./roomQueries";
import { RoomQueryState } from "./RoomQueryState";

export function RoomPreviewPage() {
  const { roomId } = useParams();
  const result = useQuery(roomQuery(roomId));
  const room = result.data;
  if (result.isPending || result.isError || !room) return <main className="rooms-container" id="room-main" tabIndex={-1}><RoomQueryState pending={result.isPending} error={result.error} retry={() => { void result.refetch(); }} /></main>;

  return <main className="rooms-container" id="room-main" tabIndex={-1}>
    <Link className="rooms-back" to="/rooms"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>Quay lại Explore</Link>
    <div className="rooms-preview">
      <div className="rooms-scene"><img src={room.image} alt={`Không gian ${room.name}`} width="960" height="800" /><span className="rooms-tag">{room.theme}</span></div>
      <section className="rooms-preview-info" aria-labelledby="preview-title">
        <span className="rooms-theme-label">{room.theme}</span><h1 id="preview-title">{room.name}</h1><p>{room.description}</p>
        <dl className="rooms-slot-stats"><div><dt>Đang học</dt><dd>—</dd></div><div><dt>Tối đa</dt><dd>{room.maxSlots}</dd></div><div><dt>Chỗ trống</dt><dd>—</dd></div></dl>
        <p className="rooms-demo-note">Chưa hỗ trợ trạng thái online và chỗ trống realtime.</p>
        <div className="rooms-join">
          <Link className="rooms-button" to={`/rooms/${room.id}`}>Vào phòng</Link>
          <Link className="rooms-text-link" to="/rooms">Chọn phòng khác</Link>
        </div>
      </section>
    </div>
  </main>;
}
