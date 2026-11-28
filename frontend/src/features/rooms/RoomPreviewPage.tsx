import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../auth/session';
import { useAccessibleRoom } from './useAccessibleRoom';
import { RoomQueryState } from './RoomQueryState';
import { PrivateRoomGate } from './PrivateRoomGate';
import { InviteCodeShare } from './InviteCodeShare';

export function RoomPreviewPage() {
  const { roomId } = useParams();
  const { guest, rejection, result, room } = useAccessibleRoom(roomId);
  const [failedImage, setFailedImage] = useState('');
  if (rejection) return <main className="rooms-container" id="room-main" tabIndex={-1}><PrivateRoomGate roomId={roomId} errorCode={rejection.code} /></main>;
  if (!guest && result.error instanceof ApiError && result.error.status === 403) return <main className="rooms-container" id="room-main" tabIndex={-1}><PrivateRoomGate roomId={roomId} /></main>;

  return <main className="rooms-container" id="room-main" tabIndex={-1} aria-busy={!guest && result.isPending}>
    <Link className="rooms-back" to={room?.visibility === 'PRIVATE' ? '/my-rooms' : '/rooms'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>{room?.visibility === 'PRIVATE' ? 'Quay lại My Rooms' : 'Quay lại Explore'}</Link>
    {(!guest && (result.isPending || result.isError)) || !room ? <RoomQueryState pending={result.isPending} error={result.error} retry={() => { void result.refetch(); }} /> : <div className="rooms-preview">
      <div className="rooms-scene">
        {failedImage === room.image ? <p className="rooms-scene-fallback" role="status">Không tải được ảnh không gian. Bạn vẫn có thể vào phòng.</p> : <img key={room.image} src={room.image} alt={`Không gian ${room.name}`} width="960" height="800" decoding="async" fetchPriority="high" onError={() => setFailedImage(room.image)} />}
        <span className="rooms-tag">{room.theme}</span>
      </div>
      <section className="rooms-preview-info" aria-labelledby="preview-title">
        <h1 id="preview-title">{room.name}</h1>
        <span className="rooms-theme-label">{room.visibility === 'PRIVATE' ? 'Phòng riêng · ' : ''}Chủ đề: {room.theme}</span>
        <p className="rooms-preview-description">{room.description.trim() || 'Phòng chưa có mô tả.'}</p>
        <dl className="rooms-slot-stats" aria-describedby="room-presence-note">
          <div><dt>Online gần nhất</dt><dd>{room.online}</dd></div>
          <div><dt>Tối đa</dt><dd>{room.maxSlots}<span className="rooms-sr-only"> người</span></dd></div>
          <div><dt>Chỗ trống gần nhất</dt><dd>{Math.max(0, room.maxSlots - room.online)}</dd></div>
        </dl>
        <p className="rooms-demo-note" id="room-presence-note">Số online là lần ghi nhận từ máy chủ, không giữ chỗ. Kết nối realtime xác nhận quyền vào phòng và số người thực tế; phòng có thể đầy trước khi bạn vào.</p>
        {!guest && room.inviteCode && <InviteCodeShare inviteCode={room.inviteCode} />}
        <div className="rooms-join">
          <Link className="rooms-button" to={`/rooms/${room.id}`}>Vào phòng<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></Link>
          <Link className="rooms-text-link" to="/rooms">Chọn phòng khác</Link>
        </div>
      </section>
    </div>}
  </main>;
}
