# TSK-17 · Realtime Focus Room

Contract: [`docs/realtime-presence.md`](../../../../docs/realtime-presence.md). Backend TSK-16 phải được triển khai; không có fallback presence giả.

## Cấu hình và sử dụng

- Dùng `VITE_API_BASE_URL=http://localhost:8080/api` như REST hiện tại. Client suy ra native WebSocket cùng host, endpoint gốc `/ws-room`, tự đổi HTTPS thành WSS. Không SockJS, không token trong URL.
- Backend `CORS_ALLOWED_ORIGIN` phải khớp origin frontend.
- Mở Focus Room sau khi đăng nhập. Nút thành viên cạnh tên phòng hiển thị trạng thái kết nối, danh sách từ server, chọn `Đang học` / `Đang nghỉ` / `Chưa bắt đầu`.
- Phòng riêng bị `FORBIDDEN`: mở bảng thành viên, nhập mã mời 6 ký tự. Mã chỉ giữ trong component, không ghi storage/URL. Backend quyết định quyền và sức chứa.
- `Ngắt kết nối` dừng reconnect; `Kết nối lại` lấy access token hiện tại. Rời route/unmount dọn subscription và socket.
- Pomodoro vẫn local. Không gửi timer, task hoặc command mỗi giây; trạng thái học chỉ gửi khi người dùng chọn, khôi phục sau reconnect.

## Lifecycle

`realtime.ts` dùng `@stomp/stompjs`: heartbeat 10 giây, connection/JOIN timeout 10 giây, reconnect exponential 1–30 giây. Auth getter tái sử dụng single-flight refresh của Auth; khi Auth publish token mới, component thay socket cũ bằng socket xác thực mới. STOMP ERROR/lỗi nghiệp vụ dừng retry, chỉ hiển thị thông báo theo code đã biết; không hiển thị frame/token/raw exception.

CONNECTED → subscribe hai user queues → JOIN ACK → subscribe room topic → JOIN resync ACK → connected. Spring simple broker hiện tại không hỗ trợ STOMP RECEIPT; client không chờ receipt. Thứ tự SUBSCRIBE/SEND dựa trên `setPreserveReceiveOrder(true)` và inbound executor một thread của TSK-16; application SNAPSHOT là ACK. ACK command theo FIFO để LEAVE không nhầm với STATUS/JOIN đang chờ. Nếu đổi concurrency/order backend, cần cập nhật cơ chế xác nhận trước khi deploy. Mỗi socket có revision riêng, snapshot đầy đủ thay danh sách; revision cũ bị bỏ. Callback socket cũ không cập nhật component mới. Mất mạng xóa danh sách để không trình bày dữ liệu cũ như đang online.

LEAVE chờ ACK rồi unsubscribe/deactivate; timeout 10 giây đóng cưỡng bức. Disconnect mạng dựa vào heartbeat backend. Đóng trang đột ngột không bảo đảm gửi LEAVE; backend cleanup socket.

## Kiểm thử

Trong `frontend`:

```sh
npm run test:realtime
node --experimental-strip-types src/auth/session.test.mjs
npm run test:rooms
node --test src/features/rooms/roomQueries.test.mjs src/features/rooms/RoomPreviewPage.test.mjs
npm run lint
npm run build
```

Test transport chỉ nằm trong test: dùng STOMP Client thật, WebSocket giả lập frame (không có SUBSCRIBE receipt như simple broker) để kiểm tra ordering, events, reconnect, stale callbacks và cleanup. Không thay thế kiểm tra end-to-end backend thật.

Kiểm tra thủ công với hai tài khoản/tab và DB test riêng:
1. Vào cùng phòng; danh sách giống nhau, số người duy nhất đúng. Mở thêm tab cùng tài khoản không tăng số người.
2. Đổi trạng thái; tab kia nhận snapshot. Timer chạy không tạo SEND mỗi giây.
3. Rời phòng; tab còn lại nhận snapshot mới. Điều hướng qua nhiều phòng không nhận dữ liệu phòng cũ.
4. Offline rồi online; hiện reconnecting, JOIN lại, danh sách đồng bộ. Restart backend revision thấp hơn vẫn áp dụng.
5. Thử mã mời sai, phòng đầy, JWT hết hạn, logout và refresh token. Không có retry storm hoặc token trong log/URL.

Tham khảo [giới hạn receipt của Spring simple broker](https://docs.spring.io/spring-framework/reference/6.2/web/websocket/stomp/handle-annotations.html).

Presence backend chỉ hỗ trợ một JVM. Không thay đổi Preview/Explore, REST contract, Pomodoro hoặc các tính năng ngoài TSK-17.
