# TSK-17/19 · Realtime Focus Room

`RoomPresence` điều khiển cả thanh chỗ ngồi lẫn bảng thành viên qua một controller. Số người lấy từ `snapshot.onlineCount`; sức chứa lấy từ `room.maxSlots`. Chỉ hiển thị thành viên sau JOIN/resync thành công. Thanh ưu tiên chỗ của bạn, tối đa ba avatar; nút `+N` mở danh sách đầy đủ. Hai nơi đều dùng `ProfileAvatar`, không gọi API theo từng user.

`projectPresence` so sánh snapshot liên tiếp, giữ thứ tự thành viên cũ và thêm người mới vào cuối. Ra/vào dùng hiệu ứng 200 ms ở các chỗ đang hiện; hình rời phòng nằm ngoài danh sách và cây trợ năng, bị gỡ khi hiệu ứng kết thúc hoặc người đó vào lại. Snapshot đầu tiên, đổi thông tin hồ sơ/trạng thái, mất kết nối, đổi socket và chuyển phòng không tạo hiệu ứng ra/vào giả. Reduced motion bỏ các hiệu ứng này nhưng vẫn cập nhật thành viên ngay.

Test trình bày: `node --test src/features/rooms/presencePresentation.test.mjs`. Khi kiểm tra bằng backend thật, xác nhận thêm `+N`, fallback avatar, trạng thái xác nhận từ máy chủ và đóng một trong hai tab của cùng tài khoản không làm mất người đó.

Giới hạn hiện tại: REST chi tiết phòng riêng trả 403 cho khách truy cập trực tiếp qua UUID, trước khi giao diện có thể JOIN STOMP. Bảng mã mời xử lý lỗi STOMP khi trang đã tải được phòng; luồng mời khách hoàn chỉnh thuộc TSK-22. Không nới quyền REST hoặc STOMP.

Contract: [`docs/realtime-presence.md`](../../../../docs/realtime-presence.md). Backend TSK-16 phải được triển khai; không có fallback presence giả.

## Cấu hình và sử dụng

- Dùng `VITE_API_BASE_URL=http://localhost:8080/api` như REST hiện tại. Client suy ra native WebSocket cùng host, endpoint gốc `/ws-room`, tự đổi HTTPS thành WSS. Không SockJS, không token trong URL.
- Backend `CORS_ALLOWED_ORIGIN` phải khớp origin frontend.
- Mở Focus Room sau khi đăng nhập. Nút thành viên cạnh tên phòng hiển thị trạng thái kết nối, danh sách từ server, chọn `Đang học` / `Đang nghỉ` / `Chưa bắt đầu`.
- Phòng riêng bị `FORBIDDEN`: mở bảng thành viên, nhập mã mời 6 ký tự. Mã chỉ giữ trong component, không ghi storage/URL. Backend quyết định quyền và sức chứa.
- `Ngắt kết nối` dừng reconnect; `Kết nối lại` lấy access token hiện tại. Rời route/unmount dọn subscription và socket.
- Countdown Pomodoro chạy ở client; phiên Focus được ghi qua StudySession REST. Không gửi timer/task hay command mỗi giây.
- `useTimerPresence()` dùng chính controller của `RoomPresence`: Focus xác nhận Start/Resume gửi `STUDYING`; nghỉ chạy/tiếp tục gửi `BREAK`; pause/finish/reset gửi `IDLE`. Khi timer không điều khiển, giữ chọn trạng thái thủ công. Trong workflow timer, select thủ công bị khóa.
- `setTimerStatus()` giữ intent riêng với snapshot. Snapshot server vẫn quyết định avatar; snapshot đến không phát STATUS phản hồi. Cùng intent không gửi lặp; reconnect gửi intent mới nhất sau JOIN/resync, không hồi phục trạng thái timer cũ. Trạng thái là chung cho các tab của cùng user, không riêng từng timer.
- Mất socket không dừng phiên đã xác nhận hoặc countdown. Cảnh báo kết nối hiện diện; chỉ mở phiên Focus mới sau khi có snapshot xác nhận chính user trong phòng. Không mở STOMP connection thứ hai.

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

Presence backend chỉ hỗ trợ một JVM. TSK-21 bổ sung đồng bộ intent Pomodoro, không thay đổi REST/STOMP contract hay quyền truy cập. Xem [Pomodoro và giới hạn backend](./README.md#tsk-21--pomodoro-end-to-end).
