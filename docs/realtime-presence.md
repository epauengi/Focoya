# TSK-16 — Realtime presence contract

Chỉ Backend; không triển khai giao diện, chat, timer, study sessions hoặc TSK-17.

## Kết nối và xác thực

- Native WebSocket: `ws://localhost:8080/ws-room` (production dùng `wss://`). Không SockJS.
- STOMP 1.2; header **STOMP CONNECT**: `Authorization: Bearer <accessToken>`. Không đưa JWT vào URL/query string. HTTP upgrade không yêu cầu bearer header để tương thích trình duyệt; STOMP CONNECT bắt buộc JWT hợp lệ.
- Dùng access token hiện tại của Auth API; từ chối refresh token, token hết hạn, sai chữ ký, subject không phải UUID. Identity lấy từ JWT, không nhận `userId` trong payload.
- Origin dùng cùng `cors.allowed-origin` / `CORS_ALLOWED_ORIGIN` như REST API. Không wildcard.
- Client bật heartbeat 10 giây, reconnect với backoff. Mỗi kết nối mới phải CONNECT, subscribe các user queue, JOIN lại, sau đó subscribe room topic; không giữ quyền phòng từ kết nối cũ. Khi access token hết hạn, lấy token mới qua Auth API rồi tạo kết nối STOMP mới; không gửi token mới trong payload JOIN/STATUS.

## Destinations

| Hướng | Destination | Payload / ý nghĩa |
| --- | --- | --- |
| Client SUBSCRIBE | `/user/queue/presence` | Snapshot xác nhận command, chỉ session gửi nhận |
| Client SUBSCRIBE | `/user/queue/errors` | Lỗi command, chỉ session gửi nhận |
| Client SEND | `/app/rooms/{roomId}/join` | `{}` cho public/chủ phòng; `{"inviteCode":"ABC123"}` cho khách phòng riêng |
| Client SUBSCRIBE | `/topic/rooms/{roomId}/presence` | Chỉ sau JOIN thành công; snapshot phòng |
| Client SEND | `/app/rooms/{roomId}/status` | `{"status":"STUDYING"}`; cũng hỗ trợ `BREAK`, `IDLE` |
| Client SEND | `/app/rooms/{roomId}/leave` | `{}` |

`roomId` là UUID. Subscribe ngoài allowlist, subscribe phòng chưa JOIN, SEND trực tiếp `/topic/**`, `/queue/**`, `/user/**` đều bị từ chối. Chỉ biết UUID phòng riêng không cấp quyền đọc presence.

### Trình tự vào phòng

1. CONNECT với access token; chờ CONNECTED.
2. Subscribe `/user/queue/presence`, `/user/queue/errors` (nên chờ receipt xác nhận subscribe).
3. SEND JOIN. Chờ snapshot xác nhận hoặc lỗi.
4. Subscribe room topic, chờ receipt; SEND JOIN lần nữa để lấy snapshot mới nhất, tránh bỏ lỡ thay đổi giữa lần JOIN đầu và lúc subscription có hiệu lực. JOIN lặp không tăng online hoặc reset status.
5. Khi nhận snapshot, thay toàn bộ danh sách hiện tại. Bỏ snapshot có `revision` nhỏ hơn bản đã áp dụng cho phòng đó. Giá trị `revision` có thể bằng nhau khi JOIN lặp.
6. Khi rời phòng: SEND LEAVE, chờ xác nhận; unsubscribe room topic. Session đã leave không còn nhận topic phòng đó, kể cả quên unsubscribe.

Frontend cần lưu revision **theo phòng, trong một lần kết nối**; reset khi reconnect/server restart. Không giả định revision liên tục hoặc bắt đầu từ 1.

## Snapshot

JOIN, LEAVE, STATUS, disconnect đều dùng full snapshot, không dùng delta:

```json
{
  "type": "SNAPSHOT",
  "roomId": "6d719321-3e10-411d-93ad-0411e2f3e984",
  "revision": 12,
  "onlineCount": 1,
  "users": [
    {
      "userId": "4251cc03-c9a7-42ac-a3d1-e75850417ab4",
      "displayName": "An",
      "avatarKey": null,
      "status": "IDLE"
    }
  ]
}
```

- `users` chỉ có identity công khai, không email, JWT, mã mời, session ID. Thứ tự ổn định theo UUID.
- User mới bắt đầu `IDLE`. Status dùng chung cho các tab của user trong cùng phòng; command cuối được xử lý thắng.
- `onlineCount = users.length`; đếm user duy nhất, không đếm tab/socket.
- Một STOMP session chỉ ở một phòng; LEAVE trước khi JOIN phòng khác. Nhiều session của cùng user có thể JOIN; không chiếm thêm slot, không tạo user trùng.
- Disconnect chỉ gỡ session tương ứng; user chỉ biến mất khi session cuối rời/disconnect. Disconnect lặp không tác dụng. Socket cũ disconnect sau reconnect không xóa session mới. Reconnect không tự cấp quyền đọc room topic: phải JOIN lại.
- Phòng đầy chặn user mới bằng kiểm tra nguyên tử trong RAM. Session bổ sung của user đang online vẫn được phép. Không giữ chỗ bằng REST Preview hoặc REST join-by-code.
- JOIN kiểm tra phòng tồn tại/đang mở, tài khoản còn tồn tại; phòng riêng yêu cầu chủ phòng hoặc mã mời đúng. Mã được trim và chuẩn hóa uppercase; không phát lại mã trong event. REST `/api/rooms/join/{inviteCode}` chỉ trả preview, không thay JOIN WebSocket, không tạo membership hoặc giữ slot.

## Lỗi

Lỗi nghiệp vụ command trả `/user/queue/errors` (không làm rò nội dung exception). Frontend phân nhánh theo `code`, không theo `message`:

| `code` | Xử lý |
| --- | --- |
| `ROOM_NOT_FOUND` | Phòng không tồn tại hoặc đã đóng |
| `FORBIDDEN` | Phòng riêng: không phải chủ phòng, thiếu/sai mã mời |
| `ROOM_FULL` | Hết slot cho user mới |
| `NOT_JOINED` | Chưa JOIN phòng ở session này |
| `ALREADY_IN_ROOM` | Phải LEAVE phòng cũ trước khi JOIN phòng khác |
| `INVALID_INVITE_CODE` | Mã mời sai định dạng |
| `INVALID_STATUS` | Status rỗng/không hợp lệ |
| `USER_NOT_FOUND` | Tài khoản không còn tồn tại |
| `UNAUTHORIZED` | Session không còn xác thực hợp lệ |
| `REQUEST_REJECTED` | JSON/payload sai, status enum không hợp lệ hoặc lỗi không công khai chi tiết |

Ví dụ: `{"code":"ROOM_FULL","message":"room full"}`. Giá trị enum lạ (ví dụ `"PAUSED"`) không được tự đổi thành `IDLE`; payload bị từ chối.

Lỗi xác thực CONNECT, vi phạm destination/SUBSCRIBE bị từ chối bằng STOMP `ERROR` đã ẩn chi tiết, kết nối đóng; không trả HTTP JSON sau upgrade. Client không retry liên tục khi sai mã/token; sửa thông tin hoặc refresh token trước.

## Kiểm thử

Từ `backend/study-room-backend`:

```powershell
.\mvnw.cmd "-Dtest=PresenceRegistryTest,RoomOnlineCountTest,RoomPresenceServiceTest,RoomApiSecurityRegressionTest,WebSocket*Test,PresenceWebSocketIntegrationTest,JwtTokenProviderTest" test
```

Các test realtime dùng repository mock, không cần PostgreSQL. Test `StudyRoomBackendApplicationTests.contextLoads` có sẵn vẫn dùng cấu hình PostgreSQL của ứng dụng; để chạy toàn bộ `test`, cần DB sẵn sàng.

## Giới hạn vận hành

Presence và simple broker nằm trong **một JVM**, mất khi restart; không ghi DB. Chưa hỗ trợ nhiều replica. Khi scale ngang phải thay bằng shared presence/broker, không dùng mỗi instance làm nguồn đếm riêng.

Heartbeat phát hiện kết nối mất mạng không tức thời. Client phải thương lượng heartbeat; đóng kết nối bằng DISCONNECT/transport close khi không dùng. Token hết hạn bị chặn ở inbound frame tiếp theo; room topic kiểm tra lại hạn token và membership khi giao message. WebSocket không thay đổi contract REST Auth/Room; field REST `online` nay lấy từ `PresenceRegistry`.
