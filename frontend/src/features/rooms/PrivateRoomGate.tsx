import { Link } from 'react-router';
import { JoinByCodeForm } from './JoinByCodeForm';
import './private-rooms.css';

export function PrivateRoomGate({ roomId, errorCode }: { roomId: string | undefined; errorCode?: string }) {
  return <section className="prooms-access" aria-labelledby="private-access-title">
    <h1 id="private-access-title">Phòng riêng được bảo vệ</h1>
    <p className="prooms-access-intro">Bạn cần mã mời để xem và vào phòng. Sau khi tải lại trang, hãy nhập lại mã; biết địa chỉ phòng không cấp quyền truy cập.</p>
    {errorCode && <p className="prooms-alert" role="alert">{errorCode === 'UNAUTHORIZED' ? 'Phiên kết nối đã hết hạn. Đăng nhập lại để tiếp tục.' : errorCode === 'ROOM_NOT_FOUND' ? 'Phòng không tồn tại hoặc đã đóng.' : 'Quyền vào phòng đã bị từ chối. Hãy xác thực lại mã mời.'}</p>}
    {errorCode === 'UNAUTHORIZED' && <Link className="rooms-button prooms-access-login" to="/login">Đăng nhập lại</Link>}
    <JoinByCodeForm targetRoomId={roomId} headingId="private-access-title" />
    <Link className="rooms-text-link" to="/my-rooms">Quay về My Rooms</Link>
  </section>;
}
