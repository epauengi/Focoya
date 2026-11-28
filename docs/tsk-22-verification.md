# TSK-22 · Báo cáo triển khai và kiểm chứng

Ngày: 2026-11-28. Nhánh: `feature/tsk-22-private-room`; nền `97b9f9c`. Thay đổi chưa commit/push/merge; không đánh dấu TASK.md hoặc Sheets hoàn tất.

## Phạm vi

- Tạo phòng PRIVATE, tối đa hai phòng active/tài khoản; khóa user trong transaction, retry collision mã mời bằng transaction mới. Kiểm tra tên, mô tả, chủ đề, sức chứa 10–30 và đúng năm ảnh bundled.
- `GET /api/rooms/me`: JWT bắt buộc, chỉ phòng PRIVATE active thuộc tài khoản; thứ tự ổn định, owner thấy mã mời. Private/invite response `Cache-Control: no-store`.
- My Rooms dữ liệu thật; native form, lỗi từng trường, khóa submit trùng, làm mới danh sách, xử lý kết quả POST chưa rõ, preview/vào phòng, Clipboard và sao chép thủ công.
- Guest xác thực mã ASCII sáu ký tự rồi preview. Credential chỉ memory, gắn user/auth generation/UUID; metadata khách không mã mời, không gọi owner-only detail query. Refresh/direct UUID yêu cầu mã lại. Rejection giữ mã lỗi không giữ credential/metadata, không rơi lại detail query.
- STOMP admission/reconnect dùng controller sẵn có. Capacity nguyên tử theo user; nhiều tab một chỗ. Topic chỉ dành cho socket đã JOIN đúng phòng.
- Private StudySession start kiểm tra owner/presence trước sửa phiên cũ; finish/XP giữ contract TSK-21. Không autoplay audio.
- Cập nhật OpenAPI, backend README, rooms README/REALTIME/PRIVATE-ROOMS và DESIGN.md. Không thêm dependency, Redis hoặc migration.

## Tự động

Backend chạy với PostgreSQL 18 cô lập `jdbc:postgresql://127.0.0.1:55432/focoya_tsk22_test`; không dùng database dịch vụ sẵn có cổng 5432.

| Thư mục | Lệnh | Kết quả |
|---|---|---|
| `backend/study-room-backend` | `.\mvnw.cmd test` | Exit 0, 52/52 |
| `frontend` | `npm run lint` | Exit 0 sau sửa test harness; verifier xác nhận |
| `frontend` | `npm run build` | Exit 0 |
| `frontend` | `npm run test:rooms` | Exit 0 |
| `frontend` | `npm run test:realtime` | Exit 0, 12/12 |
| `frontend` | `npm run test:profile` | Exit 0, 13/13 |
| `frontend` | `node --experimental-strip-types src/auth/session.test.mjs` | Exit 0, 27/27 |
| `frontend` | `node --test src/features/rooms/roomQueries.test.mjs src/features/rooms/RoomPreviewPage.test.mjs` | Exit 0, 27/27 |
| `frontend` | `node --test src/features/rooms/roomScene.test.mjs src/features/rooms/ambientAudio.test.mjs src/features/rooms/presencePresentation.test.mjs` | Exit 0, 11/11 |
| `frontend` | `node --test src/features/rooms/pomodoro.test.mjs src/features/rooms/pomodoroPreferences.test.mjs src/features/rooms/studySession.test.mjs` | Exit 0, 38/38 |
| `frontend` | `node --test src/features/rooms/privateRooms.test.mjs src/features/rooms/privateRoomQueries.test.mjs src/features/rooms/privateRoomAccess.test.mjs` | Exit 0, 34/34 |
| `frontend` | `node --test src/features/rooms/MyRoomsPage.test.mjs` | Exit 0, 2/2 |

Independent verification ban đầu phát hiện năm lỗi lint `setTimeout` trong test harness; sửa bằng import `node:timers`, không tắt rule. Kết quả lint cuối ghi trong phần cập nhật cuối bên dưới.

Backend integration thực sự gửi bốn POST đồng thời cho một user, chỉ hai request thành công; kiểm tra listing owner/inactive/order, guest detail 403, mã Unicode không hợp lệ và no-store. Các test khác bao phủ collision, membership, capacity, socket security, StudySession không sửa phiên trước khi từ chối, validation ảnh.

## Browser và REST/STOMP thật

Dùng tài khoản riêng trong database cô lập, owner và guest đăng nhập độc lập theo tab:

- Owner tạo qua giao diện: 201, My Rooms có một phòng, mã thật, preview/vào phòng. Tạo phòng thứ hai REST 201; thứ ba 400; listing có đúng hai phòng.
- Guest nhập mã, preview không ô chia sẻ, **0 request owner-only UUID detail**; vào Focus, hai tài khoản cùng thấy `2/10`, cùng avatar và tên. Không code trong DOM guest, history state hoặc storage.
- Refresh guest: Focus không mount, không socket trước xác thực, metadata/tên phòng không hiển thị; nhập mã lowercase lại mở preview đúng UUID.
- Explore trả sáu public room, không chứa private room; guest My Rooms rỗng; anonymous `/rooms/me` 401; guest UUID detail 403; mã không có 404.
- Validation tạo phòng: tên rỗng, theme sai, capacity 9, ảnh URL ngoài đều 400.
- Capacity thật: thêm bảy user rồi hai JOIN cạnh tranh chỗ cuối; một connected, một `ROOM_FULL`, online 10. User đã có mặt gọi invite REST 200 và socket thứ hai JOIN thành công dù đầy, vẫn online 10. Đóng một socket vẫn đầy; đóng socket cuối của user mở chỗ cho user mới.
- Unauthorized SUBSCRIBE private topic nhận STOMP `ERROR`, không snapshot. Guest chưa JOIN start 403; guest đã JOIN start 201; phiên ngắn finish `CANCELLED`, 0 XP.
- Pomodoro guest start/pause/resume qua giao diện; owner thấy STUDYING/IDLE tương ứng. Chờ **thời gian thực ít nhất năm phút**, End Session báo `+5 XP (5 phút)`; `/users/me` xác nhận `totalXp:5`, `level:1`; truy vấn PostgreSQL xác nhận `COMPLETED`, `duration_minutes:5`, `xp_earned:5`, `total_xp:5`; status trở lại IDLE. Không chỉnh timestamp/countdown để giả XP. Audio không phát tự động.
- Desktop 1366 và mobile 390 đã chụp; Focus mobile không tràn ngang.

Ảnh evidence trong phiên công cụ: `tsk22-owner-created`, `tsk22-guest-confirmed-pomodoro`, `tsk22-focus-mobile`, `tsk22-completed-five-minutes`, `tsk22-refresh-code-reentry`, `tsk22-guest-preview-mobile`.

## Review và giới hạn

Independent security review xác nhận sửa hai lỗi phát hiện: guest rejection không fallback GET UUID; hủy/mở lại create form không vượt khóa kết quả chưa rõ khi refetch thất bại. Không còn finding authorization/concurrency trong phạm vi review.

Bổ sung browser: Profile UI hiển thị 5 XP, cấp 1, 0,1 giờ; My Rooms guest empty state và create form mobile không tràn ngang, tất cả control có label, đủ năm ảnh. Submit mã `123` bằng DOM click hiển thị lỗi và `aria-invalid=true` (Puppeteer click tool timeout không phải lỗi ứng dụng).

Chưa chạy thủ công hết: expiry JWT/reconnect qua thời gian hết hạn thực, socket transport-loss khi đang finish, Clipboard trên nhiều hệ điều hành và tất cả tổ hợp lỗi 429/5xx trên browser. Unit/integration tests không thay cho các kiểm tra vận hành này.

Presence vẫn một JVM, không dùng cho nhiều replica. Invite path theo contract cũ cần gateway/access-log redact và rate limit dùng chung; task không thêm limiter per-process giả bảo vệ production. Mã không có rotation/expiry; không có membership bền vững hoặc reservation.

## Cập nhật cuối

Independent verifier chạy lại `npm run lint` và hai test file vừa sửa: exit 0; 14/14 tests. `git diff --check` exit 0 sau xóa dòng trắng thừa cuối ExplorePage; không đổi hành vi. AC1–AC8 đạt trong phạm vi đã kiểm tra. Independent UI review phát hiện gate nhập mã lệch cột desktop và lặp tiêu đề khiến CTA thấp trên mobile; đã sửa card riêng tối đa 560px, một tiêu đề, control 16px, back link tối thiểu 44px. Writer và independent verifier chạy lại lint/build, `git diff --check` và 25/25 regression tests: exit 0. Verifier xác nhận quyền, auth-generation, UUID matching và accessible form naming không đổi. Independent browser re-verification PASS ở 1366×768 và 390×844: một heading, input 16px, back link 44px, CTA nằm trong viewport, không tràn; mã sai có alert và liên kết aria-describedby. Ảnh: `uigate22-desktop-1366`, `uigate22-mobile-390`, `uigate22-mobile-error-390`. Preview/Focus mobile không tràn ngang. Highlight Explore trên private preview còn là hạn chế điều hướng nhỏ. Native `<details>/<summary>` có expanded state sẵn qua accessibility tree; thiếu thuộc tính `aria-expanded` trong DOM không tự chứng minh lỗi. Không coi báo cáo này là phê duyệt merge.

Đã dừng Vite, Spring Boot và PostgreSQL test cổng 55432 sau kiểm chứng; không dừng dịch vụ PostgreSQL cổng 5432. Lệnh dev server kết thúc exit 1 do chủ động dừng process, không phải kết quả Maven test. Runtime log có `Authentication failed` khi UNSUBSCRIBE socket test đã đóng và `Forbidden` từ SUBSCRIBE trái phép cố ý; chưa điều tra riêng độ nhiễu cleanup log. Database test tạm được giữ tại `C:\Users\Slim5\AppData\Local\Temp\opencode\tsk22-pg`, không đưa vào Git.
