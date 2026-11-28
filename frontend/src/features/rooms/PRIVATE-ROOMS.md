# TSK-22 · Phòng riêng

## REST contract

API base đã gồm `/api`; tất cả thao tác phòng riêng cần JWT.

- `POST /rooms`: `{name, description, theme, image, maxSlots}`, trả `201 RoomResponse`. Không gửi owner, visibility, UUID hoặc mã mời. Tên trim 1–100 ký tự, mô tả tối đa 500, chủ đề Study/Café/Nature/Gaming/Chill, ảnh bundled, sức chứa nguyên 10–30. Máy chủ khóa user trước khi kiểm tra tối đa hai phòng active và tạo PRIVATE.
- `GET /rooms/me`: chỉ phòng PRIVATE active của JWT hiện tại, thứ tự ổn định; mã mời chỉ chủ phòng thấy.
- `GET /rooms/join/{inviteCode}`: trim/uppercase mã ASCII sáu ký tự. Trả metadata, không tạo membership, không giữ chỗ. Khách không nhận `inviteCode` trong metadata.
- `GET /rooms/{UUID}`: public hoặc chủ phòng; khách riêng vẫn nhận 403 dù từng xác thực mã mời. Explore vẫn chỉ liệt kê public.

## Giao diện và quyền

`/my-rooms` lấy dữ liệu thật qua `ownedRoomsQuery`, không giả public room là phòng sở hữu. Form native có lỗi từng trường, khóa gửi trùng, giữ dữ liệu khi lỗi, không retry POST tự động. Network/5xx hoặc response không hợp lệ khiến kết quả tạo phòng chưa rõ: refetch danh sách trước khi cho gửi mới; nếu refetch lỗi cần kiểm tra lại thành công. Tạo thành công hiển thị mã thật, sao chép, xem trước hoặc vào phòng; không tự vào.

Clipboard chỉ báo thành công sau `writeText` resolve. Khi không hỗ trợ/bị từ chối, ô mã readonly cho chọn và sao chép thủ công. Chỉ chia sẻ mã với người dự định mời.

`privateRoomAccess.ts` giữ một credential trong memory, gắn user, auth generation, UUID. Join submit rõ ràng, xác thực REST rồi mở `/rooms/{UUID}/preview`; mã không vào URL điều hướng, history state, query key, storage hoặc log. `useAccessibleRoom` sử dụng metadata khách riêng, **tắt owner-only detail query**, không ghi vào cache detail chung. Owner detail dùng key `['rooms','private-detail',userId,roomId]`; My Rooms dùng `['rooms','mine',userId]`, `gcTime:0`, không có persistence. Kết quả async khác user/generation bị bỏ.

Refresh mất credential: request UUID nhận 403, hiển thị form nhập lại mã gắn đúng UUID, không lộ metadata và không mount presence/Pomodoro. Rời room/preview flow, logout, đổi user/generation, auth lỗi hoặc bị từ chối quyền rõ ràng xóa credential. Đi lại preview/focus của chính phòng giữ credential.

## Realtime, sức chứa và Pomodoro

`RoomPresence.initialInviteCode` chuyển credential riêng sang controller hiện có. Owner/public gửi `{}`, khách gửi `{inviteCode}`. Một controller, cùng JOIN ACK, subscribe topic sau ACK, resync ACK, heartbeat, refresh JWT và cleanup. Reconnect phải JOIN lại bằng credential memory, không kế thừa quyền socket cũ. Seats và số online chỉ từ snapshot đã xác nhận. Lỗi admission có hướng thử lại, nhập mã, My Rooms, Explore hoặc login.

Preview hiển thị online REST gần nhất, không reservation/polling; phòng có thể đầy trước JOIN. PresenceRegistry kiểm tra sức chứa nguyên tử, một user nhiều socket chỉ một chỗ; REST validation cho user đã hiện diện vào tab thứ hai kể cả khi đầy. Mất một tab không xóa user nếu tab khác còn kết nối. Presence chỉ một JVM, mất khi restart; chưa hỗ trợ nhiều replica.

Pomodoro giữ `presenceReady`, Web Locks, status STUDYING/BREAK/IDLE, navigation blocker và profile invalidation hiện có. Backend start private chỉ cho owner hoặc guest đã JOIN được registry xác nhận, trước khi đóng phiên cũ/tạo phiên mới. Finish hợp lệ vẫn được sau disconnect; luật XP, thời lượng và lifecycle không đổi.

## Lỗi và giới hạn

400 tùy thao tác: form/giới hạn hai phòng hoặc đầy; 401 đăng nhập lại; 403 nhập lại mã; 404 mã/phòng không có hoặc đã đóng; 429 chờ; network/5xx thử lại (create phải kiểm tra kết quả trước). STOMP dùng mã lỗi ổn định hiện có, không parse SQL/raw exception. Không public creation, chỉnh/xóa room, mã hết hạn/rotation, membership vĩnh viễn hoặc seat reservation.

Invite endpoint mang mã trong API path theo contract cũ. Reverse proxy/access logs cần redact path `/api/rooms/join/*`, tắt ghi payload JOIN và áp dụng rate limit ở gateway/shared store; không dùng counter per-process để giả bảo vệ production. Không thêm Redis/schema chỉ cho task này.

## Kiểm thử

Từ `frontend`:

```sh
npm run lint
npm run build
npm run test:rooms
npm run test:realtime
npm run test:profile
node --experimental-strip-types src/auth/session.test.mjs
node --test src/features/rooms/roomQueries.test.mjs src/features/rooms/RoomPreviewPage.test.mjs
node --test src/features/rooms/roomScene.test.mjs src/features/rooms/ambientAudio.test.mjs src/features/rooms/presencePresentation.test.mjs
node --test src/features/rooms/pomodoro.test.mjs src/features/rooms/pomodoroPreferences.test.mjs src/features/rooms/studySession.test.mjs
node --test src/features/rooms/privateRooms.test.mjs src/features/rooms/privateRoomQueries.test.mjs src/features/rooms/privateRoomAccess.test.mjs src/features/rooms/MyRoomsPage.test.mjs
```

Node tests không thay thế backend/PostgreSQL/browser thật. Trước review cần hai tài khoản độc lập: create 201, refresh My Rooms, copy, owner JOIN; guest validate/preview/JOIN không detail request, metadata không mã, cùng snapshot; guest refresh nhập lại; unauthorized UUID/topic/StudySession bị từ chối; full/final-seat/two-tabs/disconnect; Pomodoro hoàn thành đủ năm phút nhận XP thật và Profile refetch. Ghi rõ phần nào chưa chạy trong báo cáo, không đánh dấu TASK/Sheets hoàn tất thay review.
