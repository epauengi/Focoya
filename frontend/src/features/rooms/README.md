# TSK-13 · Room API

- Dùng `VITE_API_BASE_URL` trong `frontend/.env.local` (xem `.env.example`); request đi qua `apiRequest()` của TSK-08, gồm Bearer/refresh/401 retry.
- Backend thực tế: `GET /api/rooms?theme=Café&q=cozy` trả mảng `RoomResponse[]`; `GET /api/rooms/{UUID}` trả một phòng. Không dùng envelope/pagination trong OpenAPI cũ.
- `roomQueries.ts`: query keys `['rooms', 'list', {theme, q}]` và `['rooms', 'detail', id]`; dùng chung detail cache cho Preview/Focus. Truyền AbortSignal để hủy request cũ.
- `src/api/queryClient.ts`: staleTime 30 giây, tối đa một retry cho lỗi mạng/5xx, không retry 4xx, không tự fetch khi focus. Cache xóa khi đổi user/logout; không lưu xuống browser storage.
- Tìm kiếm debounce 300ms, URL giữ `q`/`theme`. Loading, lỗi + Thử lại, 403, 404 và danh sách rỗng có trạng thái riêng.
- Join chỉ giữ điều hướng Preview → Focus theo UUID. Không thêm endpoint join hoặc WebSocket. `online` backend hiện là giá trị tạm; UI chỉ hiển thị sức chứa, không dùng để tính chỗ trống hay chặn Join.

## TSK-14 · Room Preview

- Giữ Design System, scene và query chi tiết dùng chung với Focus Room; không sửa tìm kiếm/bộ lọc Explore.
- Scene tải ưu tiên, giải mã bất đồng bộ; ảnh lỗi có thông báo nhưng không chặn vào phòng. Layout một cột trên mobile, hỗ trợ bàn phím và giảm chuyển động.
- Tên, theme, mô tả, sức chứa lấy từ API; mô tả `null`/rỗng có nội dung thay thế. Online/chỗ trống hiển thị `—` kèm giải thích, không coi `online = 0` là phòng trống.
- Backend chưa có presence thực tế hoặc kiểm tra sức chứa khi vào phòng công khai. Vì vậy chưa xác định/chặn phòng đầy; Join chỉ điều hướng, không giữ slot, không tăng online. Bổ sung khi backend cung cấp dữ liệu có thẩm quyền, không triển khai WebSocket trong TSK-14.
- Loading, lỗi mạng/5xx có Thử lại; 403/404 có đường về Explore, không hiện nút Join. ID sai định dạng được chặn trước khi gọi HTTP.

### Kiểm thử TSK-14

Trong `frontend`:

```sh
npm run build
npm run lint
npm run test:rooms
node --test src/features/rooms/roomQueries.test.mjs src/features/rooms/RoomPreviewPage.test.mjs
```

1. Chạy backend theo `backend/README.md`; cấu hình `VITE_API_BASE_URL=http://localhost:8080/api` trong `.env.local`, chạy `npm run dev`, đăng nhập.
2. Mở `/rooms`, thử tìm kiếm/lọc theme, chọn một thẻ phòng. Kiểm tra URL `/rooms/{UUID}/preview`, request `GET /api/rooms/{UUID}` và nội dung khớp response; online/chỗ trống vẫn là `—`.
3. Chọn **Vào phòng** (Join Room). Kiểm tra URL `/rooms/{UUID}`, tên/theme đúng, clock/Pomodoro và tasks của Focus Room vẫn hoạt động. Detail cache còn mới không cần request lặp lại; sau 30 giây có thể refetch.
4. Dùng Back trở về Preview; thử **Quay lại Explore**/**Chọn phòng khác**. Thử bàn phím, viewport 320/390/768px và reduced motion; không tràn ngang, thao tác tối thiểu 44px.
5. Dùng Network throttling để quan sát loading; chặn request chi tiết/offline để thấy lỗi, bỏ chặn rồi **Thử lại**. Dùng UUID không tồn tại cho 404, ID sai định dạng cho not-found không HTTP, phòng riêng không thuộc tài khoản cho 403.
6. Chặn ảnh scene: thấy thông báo ảnh lỗi, Join vẫn dùng được. Phòng thiếu mô tả: thấy nội dung thay thế. Không kiểm thử phòng đầy bằng số online giả; backend hiện chưa cung cấp điều kiện này.

## Kiểm thử

Trong `frontend`:

```sh
npm run build
npm run lint
npm run test:rooms
node src/auth/session.test.mjs
node src/features/rooms/roomQueries.test.mjs
```

1. Chạy Spring Boot bằng Java 21, PostgreSQL; chạy FE `npm run dev`, đăng nhập.
2. Explore phải hiển thị phòng backend, không phải danh sách mock; kiểm tra Network có `GET /api/rooms` + Bearer.
3. Nhập từ khóa, chọn Café/Nature; kiểm tra `q`/`theme`, kết quả rỗng, nút Xem tất cả phòng.
4. Chọn phòng: URL Preview chứa UUID, request detail đúng UUID; Vào phòng mở Focus, Back về Explore. My Rooms cũng lấy phòng API.
5. Mở UUID không tồn tại/ID không hợp lệ: thông báo không tìm thấy; 403 báo không truy cập được. Offline/5xx: báo lỗi, Thử lại phục hồi; slow network hiện loading.
6. Không hiển thị số người online giả. Logout/đổi tài khoản không dùng lại cache của người trước.

Test fetch giả lập không thay thế end-to-end với Spring Boot thật.
