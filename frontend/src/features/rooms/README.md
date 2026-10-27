# TSK-13 · Room API

- Dùng `VITE_API_BASE_URL` trong `frontend/.env.local` (xem `.env.example`); request đi qua `apiRequest()` của TSK-08, gồm Bearer/refresh/401 retry.
- Backend thực tế: `GET /api/rooms?theme=Café&q=cozy` trả mảng `RoomResponse[]`; `GET /api/rooms/{UUID}` trả một phòng. Không dùng envelope/pagination trong OpenAPI cũ.
- `roomQueries.ts`: query keys `['rooms', 'list', {theme, q}]` và `['rooms', 'detail', id]`; dùng chung detail cache cho Preview/Focus. Truyền AbortSignal để hủy request cũ.
- `src/api/queryClient.ts`: staleTime 30 giây, tối đa một retry cho lỗi mạng/5xx, không retry 4xx, không tự fetch khi focus. Cache xóa khi đổi user/logout; không lưu xuống browser storage.
- Tìm kiếm debounce 300ms, URL giữ `q`/`theme`. Loading, lỗi + Thử lại, 403, 404 và danh sách rỗng có trạng thái riêng.
- Join chỉ giữ điều hướng Preview → Focus theo UUID. Không thêm endpoint join hoặc WebSocket. `online` backend hiện là giá trị tạm; UI chỉ hiển thị sức chứa, không dùng để tính chỗ trống hay chặn Join.

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
