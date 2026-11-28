# Study Room - Backend

Backend API server cho ứng dụng Study Room.

## Tech Stack

- **Java 21**
- **Spring Boot 3.5**
- **Spring Security** — Xác thực & phân quyền
- **Spring Data JPA** — ORM & truy vấn database
- **Spring WebSocket** — Giao tiếp realtime
- **PostgreSQL 15** — Cơ sở dữ liệu
- **Lombok** — Giảm boilerplate code
- **Maven** — Quản lý dependency & build

## Cấu trúc thư mục

```
study-room-backend/
├── src/main/java/com/lofi/studyroombackend/
│   ├── config/          # Cấu hình (Security, WebSocket,...)
│   ├── controller/      # REST API controllers
│   ├── entity/          # JPA entities (XxxEntity)
│   │   └── enums/       # Enum dùng trong entity (UserRole, RoomVisibility, ...)
│   └── StudyRoomBackendApplication.java
├── src/main/resources/
│   └── application.yml
└── pom.xml
```

## Yêu cầu

- JDK 21+
- Không cần cài Maven, dùng `./mvnw` (Windows: `.\mvnw.cmd`)

## Chạy ứng dụng

```bash
cd study-room-backend
./mvnw spring-boot:run
```

Server sẽ chạy tại `http://localhost:8080`.

## Realtime (TSK-16)

WebSocket STOMP: `/ws-room`. JWT trong header STOMP `CONNECT`; presence lưu RAM, không lưu DB.

Contract cho TSK-17: [realtime-presence.md](../docs/realtime-presence.md).

Kiểm thử unit/WebMvc/realtime không cần PostgreSQL:

```powershell
.\mvnw.cmd "-Dtest=PresenceRegistryTest,RoomOnlineCountTest,RoomPresenceServiceTest,RoomApiSecurityRegressionTest,RoomServiceImplTest,StudySessionServiceImplTest,WebSocket*Test,PresenceWebSocketIntegrationTest,JwtTokenProviderTest,GamificationEventListenerTest" test
```

## Private Rooms & Study Sessions (TSK-22)

- `GET /api/rooms/me`: yêu cầu access token hợp lệ (`SecurityConfig` đặt trước `GET /api/rooms/{roomId}`), trả danh sách phòng `PRIVATE` đang `active = true` của chính user theo thứ tự xác định (`created_at ASC, name ASC, id ASC`), kèm `inviteCode` và header `Cache-Control: no-store`.
- `POST /api/rooms`: tạo phòng `PRIVATE` với giới hạn tối đa 2 phòng riêng đang mở mỗi user (khóa dòng user bằng `UserRepository.findByIdForUpdate` để tránh vượt giới hạn khi gửi đồng thời), retry có giới hạn khi trùng `invite_code` ở tầng DB, trả `Cache-Control: no-store`.
- `GET /api/rooms/{roomId}`: giữ nguyên kiểm tra quyền chủ phòng cho phòng `PRIVATE` (`403` với người khác), ẩn `inviteCode` khi không phải chủ phòng, và trả `Cache-Control: no-store` cho phòng `PRIVATE`.
- `GET /api/rooms/join/{inviteCode}`: chuẩn hóa `trim().toUpperCase()`, kiểm tra đúng 6 ký tự chữ/số `[A-Z0-9]{6}` (`400` nếu sai định dạng); nếu phòng đầy (`online >= maxSlots`), người dùng đã có mặt trong `PresenceRegistry` vẫn được phép xem/vào lại phòng; trả `Cache-Control: no-store`.
- `POST /api/study-sessions/start`: nếu `roomId` là phòng `PRIVATE`, kiểm tra user là chủ phòng hoặc đang có mặt trong `PresenceRegistry` (`403` nếu không đủ quyền) **trước** khi chốt phiên `IN_PROGRESS` cũ.

## Giới hạn kiến trúc & bảo mật đã biết

- **PresenceRegistry chỉ chạy trên 1 JVM**: số người online (`online`), kiểm tra user đã có mặt khi phòng đầy ở `GET /api/rooms/join/{inviteCode}`, và kiểm tra thành viên phòng riêng ở `POST /api/study-sessions/start` đọc trạng thái trong RAM (`PresenceRegistry`). Nếu triển khai nhiều instance backend, cần chuyển presence sang store/broker dùng chung.
- **Chống brute-force `inviteCode`**: backend chỉ kiểm tra định dạng 6 ký tự `[A-Z0-9]{6}` (không cài rate limiter trong RAM của app vì không an toàn khi scale và dễ tràn bộ nhớ). Môi trường production cần bật rate limiting / WAF cho `/api/rooms/join/*` và STOMP join tại API gateway hoặc reverse proxy.
