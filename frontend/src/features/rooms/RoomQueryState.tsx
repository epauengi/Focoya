import { Link } from "react-router";
import { ApiError } from "../../auth/session";

export function RoomQueryState({ pending, error, retry }: { pending: boolean; error: Error | null; retry: () => void }) {
  if (pending) return <section className="rooms-empty" role="status"><h2>Đang tải phòng...</h2></section>;
  const missing = error instanceof ApiError && error.status === 404;
  const forbidden = error instanceof ApiError && error.status === 403;
  return <section className="rooms-empty" role="alert">
    <h2>{missing ? "Không tìm thấy phòng" : forbidden ? "Không thể truy cập phòng" : "Không tải được phòng"}</h2>
    <p>{error?.message ?? "Vui lòng thử lại."}</p>
    {!missing && !forbidden && <button className="rooms-button" onClick={retry}>Thử lại</button>}
    <Link className="rooms-text-link" to="/rooms">Khám phá phòng</Link>
  </section>;
}
