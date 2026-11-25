# TSK-15 · Hồ sơ

- `/profile` dùng `ProtectedRoute` và `RoomsLayout`. Mở từ menu **Hồ sơ** hoặc thẻ **Tài khoản** trong cài đặt phòng.
- `GET` và `PUT /users/me` dùng `apiRequest`; `VITE_API_BASE_URL` đã bao gồm `/api`. PUT gửi đủ `displayName`, `bio`, `avatarKey`; dùng `null` để xóa giới thiệu hoặc ảnh đại diện. Email chỉ đọc.
- Cache `['profile', userId]` cập nhật từ phản hồi PUT. Thanh tài khoản dùng cache khi có, nếu không dùng dữ liệu đăng nhập; cache bị xóa khi đổi tài khoản hoặc đăng xuất.
- Cấp, XP và các chỉ số lấy từ `UserProfileResponse`; schema `User` trong OpenAPI hiện chưa liệt kê các chỉ số này. Máy chủ tính tổng giờ học từ các phiên đã hoàn thành, làm tròn đến một chữ số thập phân. Trang không tự tính chuỗi học hay cấp độ, không cấp huy hiệu.
- Figma MCP không có quyền mở file tham chiếu. Giao diện dùng `DESIGN.md`, `RoomsLayout`, `RoomSettings` và ảnh Midnight Library có sẵn. Tám lựa chọn avatar là SVG nội bộ, không có tải ảnh lên.

## Kiểm tra

Chạy `npm run test:profile` trong `frontend`. Để kiểm tra tích hợp, bật Spring Boot và PostgreSQL cục bộ, đặt `VITE_API_BASE_URL`, đăng nhập rồi mở **Hồ sơ**. Thử đổi tên, giới thiệu và ảnh; tải lại để xác nhận dữ liệu lưu. Xóa giới thiệu và chọn **Dùng chữ cái đầu tên** để kiểm tra giá trị `null`. Đăng xuất rồi mở `/profile` để xác nhận chuyển về đăng nhập.
