# Focus Room - TSK-18

## TSK-21 — Pomodoro End-to-End

### API và vòng đời

- Tái sử dụng `apiRequest`, JWT refresh, room queries, profile query và một controller STOMP. Contract thực tế theo Java/OpenAPI và [PR #25](https://github.com/epauengi/Focoya/pull/25), không theo mô tả StudySession cũ trong TASK.md.
- Focus gọi `POST /study-sessions/start` với đúng `{roomId}`; chỉ countdown sau response `IN_PROGRESS` hợp lệ, đúng user/room. API base đã có `/api`. Response được parse runtime; lưu ID ở memory để đối chiếu, không phải quyền nhắm endpoint finish.
- End/hết giờ gọi `POST /study-sessions/finish` không body. Chỉ chấp nhận terminal response đúng ID/user/room. Không gửi duration, timestamp hoặc XP. Không retry network/5xx, không dùng mutation retry; client auth chỉ replay một lần sau 401 bị từ chối trước nghiệp vụ.
- Máy trạng thái: idle → starting → running → paused/resumed → finishing → completed; lỗi chưa rõ commit giữ uncertain. Guard đồng bộ chặn nhấn liên tiếp; countdown theo deadline monotonic, kiểm tra wall elapsed khi tab ngủ và visibility, không trừ từng tick.
- Pause chỉ ngừng countdown, **backend vẫn tính thời gian pause**. Resume dùng phiên cũ, không POST start mới. End Session chốt thời gian. Reset/đổi mode xác nhận rồi finish phiên Focus trước. Short/Long hoàn toàn local, không XP hay StudySession.
- Cài đặt: mặc định 25/5/15 phút, số nguyên Focus 5–60, Short 1–15, Long 5–30; phản hồi lỗi từng trường, khôi phục mặc định. Chỉ áp dụng idle/phiên sau. Lưu preferences không nhạy cảm ở `focoya:pomodoro:preferences:v1`, không lưu token/session ownership/XP.
- AutoStart: Focus finish xác nhận rồi Short; hết break mới start Focus khi đã JOIN phòng. Không chờ bù nhiều chu kỳ sau tab ngủ, không tự chuyển sau uncertain. Long chỉ chọn thủ công, không thêm scheduler.
- Presence: Focus running/resume STUDYING; break running/resume BREAK; pause/end/reset IDLE. Không STATUS mỗi giây. Xem [REALTIME.md](./REALTIME.md).
- Toast luôn là fallback. Notification chỉ khi được hỗ trợ và permission granted; xin quyền qua thao tác bật thông báo trong Settings, không tự hỏi lúc tải. Denied không hỏi lặp. Một thông báo cho mỗi lần hết timer; chỉ đưa XP sau backend xác nhận. Không bảo đảm thông báo sau đóng tab/trình duyệt; ambience độc lập.
- Start có thể chốt phiên cũ nên cũng invalidate `profileQuery(userId)`. Finish xác nhận invalidate cùng query, kể cả observer inactive. Profile lần mở sau fetch lại XP/level/tổng giờ từ API, không cộng optimistic hoặc sửa streak/badge.

### An toàn và giới hạn backend

- Web Locks giữ khóa theo user suốt workflow, cả pause/uncertain. Tab khác không tự takeover. Trình duyệt không hỗ trợ Web Locks từ chối Focus có ghi nhận; break vẫn chạy. Không dùng localStorage flag làm khóa. Khóa chỉ cùng origin/browser; không bảo vệ thiết bị khác, origin khác, API trực tiếp hoặc thay đổi server.
- Capture user/generation/room/operation; response cũ không thay UI/cache tài khoản mới. Unmount không tự finish; POST đang chờ giữ khóa đến khi settle. Không tự khôi phục ownership sau refresh.
- 400/401/403 và start404 là từ chối rõ ràng, hiển thị hướng dẫn. Network/timeout/5xx/dữ liệu sai/ID sai là uncertain. Finish404 chỉ nói không tìm thấy active session, **không chứng minh phiên đã hoàn thành**. Không tự POST lại; rời phòng khi uncertain cần xác nhận cảnh báo.
- Điều hướng trong ứng dụng chặn khi còn workflow, cho End rồi Leave, chờ kết quả. Logout chủ động cũng hỏi kết thúc trước. `beforeunload` chỉ cảnh báo khi trình duyệt hỗ trợ; refresh/đóng tab/mất mạng không bảo đảm finish. Không sendBeacon/fetch từ cleanup. Start sau đó có thể chốt phiên cũ theo luật server.
- Backend không pause/resume, active lookup, idempotency key hoặc finish theo session ID. Phát hiện response ID lệch chỉ ngăn trình bày sai, **không thể ngăn finish đã chạm phiên khác trên thiết bị khác**. Follow-up nhỏ: endpoint finish có expectedSessionId và kiểm tra nguyên tử, active lookup; idempotency key nếu cần phục hồi request. Không thể loại thời gian pause khỏi XP bằng contract hiện tại.

### Kiểm thử TSK-21

```sh
node --test src/features/rooms/pomodoro.test.mjs src/features/rooms/studySession.test.mjs src/features/rooms/pomodoroPreferences.test.mjs
npm run test:realtime
npm run test:profile
npm run test:rooms
npm run lint
npm run build
```

Backend/DB test + hai tài khoản cần kiểm tra trước review:
1. Đăng nhập, vào public room, đợi JOIN; cấu hình thời lượng, mở Pomodoro. Start đúng một POST; response IN_PROGRESS, avatar tab khác STUDYING.
2. Pause/resume không start mới; IDLE/STUDYING xác nhận bằng snapshot. Ngắt/kết nối socket khi timer chạy: countdown không mất, intent mới nhất hồi phục, không STATUS mỗi tick.
3. End trước 5 phút: CANCELLED, 0 XP, phút thực tế. Chạy đủ ≥5 phút không chỉnh timestamp server: COMPLETED, phút/XP từ response; Profile fetch mới, level/giờ đúng API.
4. Short/Long không có StudySession request, BREAK/IDLE đúng. AutoStart đợi finish rồi mới nghỉ, hết nghỉ mới start tiếp, không catch-up nhiều phiên.
5. Quyền notification default/granted/denied/unsupported; toast fallback; một thông báo/lần hết giờ. Test click dồn, request chậm/mất mạng/5xx/404/ID lệch, logout/room switch trong request; uncertain không replay.
6. Hai tab cùng user: tab sau không takeover; browser không Web Locks từ chối focus, break vẫn dùng. Refresh/đóng tab cảnh báo, không giả khôi phục phiên.
7. Giữ ambience, scenes, tasks, fullscreen, Live Clock. Kiểm tra bàn phím, reduced motion, viewport 375/768/1024/1366; validation/readable notices không đẩy controls khỏi màn hình.

Mock tests/browser fixtures không thay thế E2E Spring Boot/PostgreSQL thật. Không đánh dấu TASK.md/Sheets hoàn thành trước review.

- `/rooms/:roomId` giữ đồng hồ, Pomodoro tích hợp StudySession, danh sách việc tạm và chế độ toàn màn hình. Countdown vẫn ở client; máy chủ quyết định thời gian ghi nhận và XP.
- Cảnh ưu tiên hình nền được chọn, rồi ảnh phòng nhận từ API. Xem [bảng ánh xạ cảnh và âm thanh](../../../public/room-assets/README.md). Ảnh lỗi thử ảnh theo cảnh rồi `bg.png`.
- Nút hình mây mở bộ điều khiển âm thanh. Web Audio chỉ khởi tạo khi nhấn Phát; đổi preset điều chỉnh một luồng noise, không phát chồng. Rời phòng hoặc đăng xuất đóng AudioContext. Chỉ mức âm lượng được lưu (`focoya:room-audio:volume:v1`), không gửi qua mạng và không tự phát sau khi tải lại.
- `prefers-reduced-motion` ẩn hiệu ứng trang trí ngay khi đổi cài đặt hệ điều hành, không ảnh hưởng âm thanh.
- Kiểm tra: mở bốn cảnh; thử hình nền ghi đè, phát/tạm dừng, tắt tiếng, đổi preset, chỉnh âm lượng bằng phím mũi tên, tải lại, rời phòng và giảm chuyển động. Thử thêm Pomodoro, danh sách việc và toàn màn hình. Test Node: `node --test src/features/rooms/roomScene.test.mjs src/features/rooms/ambientAudio.test.mjs`.

# TSK-13 · Room API

TSK-17/19: [Realtime Focus Room — kết nối, chỗ ngồi và kiểm thử](./REALTIME.md).

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
