# Study Room - Backend

Backend API server cho ứng dụng Study Room.

## Tech Stack

- **Java 21**
- **Spring Boot 3.5**
- **Spring Security** — Xác thực & phân quyền
- **Spring Data JPA** — ORM & truy vấn database
- **Spring WebSocket** — Giao tiếp realtime
- **PostgreSQL 15** — Cơ sở dữ liệu
- **Flyway** — Migration schema
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
│   ├── application.yml
│   └── db/migration/    # Flyway migration (V1__init_schema.sql, ...)
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
