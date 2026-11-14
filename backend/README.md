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

Kiểm thử realtime không cần PostgreSQL:

```powershell
.\mvnw.cmd "-Dtest=PresenceRegistryTest,RoomOnlineCountTest,RoomPresenceServiceTest,RoomApiSecurityRegressionTest,WebSocket*Test,PresenceWebSocketIntegrationTest,JwtTokenProviderTest" test
```
