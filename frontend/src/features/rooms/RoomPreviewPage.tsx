import { Link, useParams } from "react-router";
import { getRoom } from "./rooms";

export function RoomPreviewPage() {
  const { roomId } = useParams();
  const room = getRoom(roomId);
  if (!room) return <main className="rooms-container" id="room-main" tabIndex={-1}><section className="rooms-empty"><h1>Không tìm thấy phòng</h1><p>Phòng này không có trong danh sách demo. Chọn một không gian khác để tiếp tục.</p><Link className="rooms-button" to="/rooms">Khám phá phòng</Link></section></main>;
  const available = Math.max(0, room.maxSlots - room.online);

  return <main className="rooms-container" id="room-main" tabIndex={-1}>
    <Link className="rooms-back" to="/rooms"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>Quay lại Explore</Link>
    <div className="rooms-preview">
      <div className="rooms-scene"><img src={room.image} alt={`Không gian ${room.name}`} width="960" height="800" /><span className="rooms-tag">{room.theme}</span></div>
      <section className="rooms-preview-info" aria-labelledby="preview-title">
        <span className="rooms-theme-label">{room.theme}</span><h1 id="preview-title">{room.name}</h1><p>{room.description}</p>
        <dl className="rooms-slot-stats"><div><dt>Đang học</dt><dd>{room.online}</dd></div><div><dt>Tối đa</dt><dd>{room.maxSlots}</dd></div><div><dt>Chỗ trống</dt><dd>{available}</dd></div></dl>
        <p className="rooms-demo-note">Dữ liệu thử nghiệm — số người và chỗ trống chỉ mang tính minh họa.</p>
        <div className="rooms-join">
          {available > 0 ? <Link className="rooms-button" to={`/rooms/${room.id}`}>Vào phòng học</Link> : <button className="rooms-button" disabled>Phòng đã đầy</button>}
          <p>Chế độ xem thử · Chưa kết nối máy chủ phòng.</p>
        </div>
      </section>
    </div>
  </main>;
}
