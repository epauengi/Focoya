# TSK-08 · Authentication

## Chạy local

1. Sao chép `frontend/.env.example` thành `frontend/.env.local`. `VITE_API_BASE_URL` phải gồm `/api`; khởi động lại Vite sau khi đổi biến.
2. Chạy Spring Boot bằng Java 21, PostgreSQL theo cấu hình backend. Origin FE phải khớp `CORS_ALLOWED_ORIGIN` (mặc định `http://localhost:5174`).
3. Trong `frontend`: `npm run dev`.

## Kiểm thử

```sh
npm run build
npm run lint
node src/auth/session.test.mjs
npm run test:rooms
```

- Mở `/rooms` khi chưa đăng nhập: chuyển `/login`, không hiện nội dung phòng.
- Đăng ký tên 2–50 ký tự, email mới, mật khẩu 8–72 ký tự có chữ và số; xác nhận mật khẩu, đồng ý điều khoản. Thành công chuyển Login, không tự lưu token đăng ký.
- Đăng nhập: chuyển Explore Rooms; tên/email lấy từ Auth API. Sai mật khẩu/email trùng/lỗi mạng hiển thị lỗi, nút submit hoạt động lại.
- Reload `/rooms`: gọi `/auth/refresh`, thay cả hai token. Không chọn “Ghi nhớ”: refresh token ở sessionStorage; chọn: localStorage. Access token chỉ ở bộ nhớ.
- `/dashboard`, `/rooms/*`, `/my-rooms` đều được bảo vệ. Token sắp hết hạn được refresh; `apiRequest()` gắn Bearer, refresh và thử lại tối đa một lần khi 401. Refresh bị 401/403: xóa phiên, về Login. Mất mạng: giữ refresh token, hiện Thử lại.
- Đăng xuất trong menu tài khoản/cài đặt: xóa token, về Login; Back/reload không mở lại phòng. Phản hồi refresh đến muộn không khôi phục phiên đã logout.

## Giới hạn

Backend hiện chỉ nhận bearer token JSON, chưa có cookie HttpOnly hoặc endpoint logout/revoke. Refresh token trong Web Storage có rủi ro XSS; logout chỉ xóa phiên trình duyệt hiện tại, không thu hồi JWT phía server. Chuyển sang HttpOnly cookie khi backend hỗ trợ. Danh sách/chi tiết phòng dùng Room API từ TSK-13; xem `../features/rooms/README.md`.

Bộ test tự động giả lập fetch theo hợp đồng Spring Boot; không thay thế kiểm thử end-to-end với backend thật.
