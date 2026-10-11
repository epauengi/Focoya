-- =====================================================================
-- Focoya - V1 baseline schema (PostgreSQL 15)
-- =====================================================================
--
-- FILE NÀY LÀM GÌ?
--   Flyway (thư viện chạy bên trong backend) đọc file này khi backend khởi động
--   và chạy các lệnh CREATE TABLE bên dưới để tạo bảng trong DB.
--   Hibernate KHÔNG tạo bảng (ddl-auto: validate), nó chỉ kiểm tra entity Java khớp với bảng.
--
-- QUY TẮC BẮT BUỘC
--   1. File này đã merge thì KHÔNG ĐƯỢC SỬA, kể cả sửa comment.
--      Flyway lưu checksum của file trong bảng flyway_schema_history,
--      sửa 1 ký tự là checksum lệch -> backend không khởi động được.
--   2. Muốn đổi schema (thêm cột, thêm bảng, thêm index...) -> tạo file MỚI:
--      V2__mo_ta_ngan.sql, V3__... (chữ V + số + HAI dấu gạch dưới + mô tả).
--   3. Đổi schema xong phải sửa entity Java trong package entity/ cho khớp,
--      rồi chạy ./mvnw test để Hibernate validate lại.
--
-- QUY ƯỚC CHUNG
--   - Khóa chính (id) là UUID, do backend (Hibernate) tự sinh trước khi INSERT.
--   - Tên bảng/cột viết snake_case (started_at); bên Java là camelCase (startedAt).
--   - Thời gian dùng TIMESTAMPTZ, lưu theo UTC. Đổi sang giờ Việt Nam khi hiển thị.
--   - Enum (role, status, visibility) lưu dạng chữ (VARCHAR) + CHECK để chặn giá trị lạ.
--   - Tên constraint: chk_<bảng>_<ý nghĩa> (CHECK), uq_... (UNIQUE), idx_... (INDEX).
--   - DEFAULT trong SQL chỉ có tác dụng khi INSERT không nhắc tới cột đó.
--     Hibernate luôn INSERT đủ mọi cột, nên entity Java cũng phải gán giá trị mặc định.
--
-- KHÔNG LƯU TRONG DB
--   Presence (ai đang online, trạng thái STUDYING / BREAK / IDLE) nằm trong memory
--   của backend (PresenceRegistry, TSK-16). Lý do: thay đổi liên tục, mất khi restart cũng không sao.
--
-- QUAN HỆ GIỮA CÁC BẢNG
--   users 1 ── 1 gamification_profiles
--   users 1 ── n rooms            (chỉ private room có chủ)
--   users 1 ── n study_sessions
--   rooms 1 ── n study_sessions
--   users n ── n badges           (qua bảng nối user_badges)
-- =====================================================================


-- ---------------------------------------------------------------------
-- BẢNG users: tài khoản đăng nhập + profile cơ bản.
-- Người phụ trách: Thọ (TSK-06 Auth, TSK-09 Profile).
--
-- Tên bảng là "users" (số nhiều) vì "user" là TỪ KHÓA của PostgreSQL,
-- đặt tên "user" thì mọi câu query đều phải bọc trong dấu ngoặc kép, rất dễ lỗi.
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id              UUID         PRIMARY KEY,
    -- Dùng để đăng nhập. UNIQUE: không có 2 tài khoản cùng email (đăng ký trùng -> HTTP 409).
    email           VARCHAR(255) NOT NULL UNIQUE,
    -- Mật khẩu đã băm bằng BCrypt. KHÔNG BAO GIỜ lưu mật khẩu thật, KHÔNG BAO GIỜ trả cột này ra API.
    password_hash   VARCHAR(255) NOT NULL,
    -- Tên hiển thị trong phòng học. 2-50 ký tự (validate ở DTO, TSK-09).
    display_name    VARCHAR(50)  NOT NULL,
    -- Mã avatar có sẵn phía frontend (vd: 'cat-01'), KHÔNG phải link ảnh. MVP không cho upload ảnh.
    avatar_key      VARCHAR(50),
    -- Giới thiệu ngắn, tối đa 200 ký tự (TSK-09).
    bio             VARCHAR(200),
    -- Quyền: USER (mặc định) hoặc ADMIN. Đưa vào claim của JWT (TSK-06).
    role            VARCHAR(20)  NOT NULL DEFAULT 'USER',
    -- Hibernate tự điền 2 cột này (@CreationTimestamp / @UpdateTimestamp).
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    -- role chỉ được là 1 trong 2 giá trị này. Phải khớp enum UserRole bên Java.
    CONSTRAINT chk_users_role CHECK (role IN ('USER', 'ADMIN'))
);


-- ---------------------------------------------------------------------
-- BẢNG gamification_profiles: XP, streak, mục tiêu ngày của 1 user.
-- Người phụ trách logic: Tiên (TSK-25). Bảng tạo sẵn ở đây.
--
-- Quan hệ 1-1 với users: mỗi user có đúng 1 profile.
--   Cách làm 1-1: khóa ngoại user_id + UNIQUE (bỏ UNIQUE thì thành 1-n).
--   Backend phải tạo profile ngay khi user đăng ký (TSK-06).
--
-- LEVEL KHÔNG LƯU: level tính từ total_xp mỗi khi cần
-- (công thức trong Excel TSK-25: floor(sqrt(total_xp / 100)) + 1).
-- Lưu cả hai thì sẽ có lúc lệch nhau (XP 500 mà level ghi 2).
-- ---------------------------------------------------------------------
CREATE TABLE gamification_profiles (
    id                  UUID        PRIMARY KEY,
    -- ON DELETE CASCADE: xóa user thì profile tự bị xóa theo.
    user_id             UUID        NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    -- Tổng XP tích lũy. Chỉ backend được cộng XP, không tin số XP client gửi lên.
    total_xp            INT         NOT NULL DEFAULT 0,
    -- Số ngày học liên tiếp hiện tại; reset khi bỏ 1 ngày.
    current_streak      INT         NOT NULL DEFAULT 0,
    -- Kỷ lục streak dài nhất từng đạt.
    longest_streak      INT         NOT NULL DEFAULT 0,
    -- Ngày học gần nhất (chỉ ngày, không giờ). Dùng để tính streak: hôm qua có học -> streak + 1.
    last_study_date     DATE,
    -- Mục tiêu phút học mỗi ngày. Đạt mục tiêu -> thưởng XP (Excel TSK-25: 60 phút = +50 XP).
    daily_goal_minutes  INT         NOT NULL DEFAULT 60,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Chặn số âm, phòng khi code bị bug trừ XP quá tay.
    CONSTRAINT chk_gp_total_xp      CHECK (total_xp >= 0),
    CONSTRAINT chk_gp_streak        CHECK (current_streak >= 0 AND longest_streak >= 0),
    CONSTRAINT chk_gp_daily_goal    CHECK (daily_goal_minutes > 0)
);


-- ---------------------------------------------------------------------
-- BẢNG rooms: phòng học ảo.
-- Người phụ trách: Thọ (TSK-12).
--
-- Có 2 loại phòng:
--   PUBLIC  : hệ thống seed sẵn 4 phòng (Rainy Café, Midnight Library, ...).
--             owner_id = NULL, không có invite_code, ai cũng vào được.
--   PRIVATE : user tự tạo. Bắt buộc có owner_id và invite_code 6 ký tự.
--             Muốn vào phải nhập đúng invite_code (TSK-12, TSK-22).
--
-- XÓA MỀM (soft delete): không DELETE dòng, chỉ đặt is_active = false.
-- Lý do: study_sessions cũ vẫn trỏ tới room này (lịch sử học), xóa thật sẽ lỗi khóa ngoại.
--
-- Số người ĐANG ONLINE trong phòng KHÔNG lưu ở đây (lấy từ PresenceRegistry in-memory).
-- ---------------------------------------------------------------------
CREATE TABLE rooms (
    id                  UUID         PRIMARY KEY,
    -- Chủ phòng. Không có NOT NULL vì public room không có chủ.
    owner_id            UUID         REFERENCES users (id),
    name                VARCHAR(100) NOT NULL,
    -- TEXT: chuỗi không giới hạn độ dài, hợp cho mô tả dài.
    description         TEXT,
    -- Các *_key là MÃ để frontend tra ra tài nguyên tương ứng (vd: 'rainy-cafe'),
    -- không phải link file. Frontend (Tân) quyết định danh sách key.
    theme_key           VARCHAR(50)  NOT NULL,   -- tông màu / giao diện
    scene_key           VARCHAR(50),             -- ảnh/animation nền
    ambient_track_key   VARCHAR(50),             -- âm thanh nền (mưa, lửa trại...)
    -- PUBLIC hoặc PRIVATE. Phải khớp enum RoomVisibility bên Java.
    visibility          VARCHAR(10)  NOT NULL,
    -- Mã mời 6 ký tự, chỉ private room có. UNIQUE: không có 2 phòng trùng mã.
    -- (PostgreSQL cho phép nhiều dòng cùng NULL dù có UNIQUE, nên public room để NULL không bị lỗi.)
    invite_code         VARCHAR(6)   UNIQUE,
    -- Số người tối đa trong phòng. Private room: 10-30 (kiểm tra ở service, TSK-12).
    max_slots           INT          NOT NULL,
    -- false = phòng đã bị "xóa" (xem ghi chú XÓA MỀM ở trên).
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_rooms_visibility CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
    CONSTRAINT chk_rooms_max_slots  CHECK (max_slots > 0),
    -- Luật nghiệp vụ do DB tự bảo vệ (dù code Java có bug cũng không lưu sai được):
    --   PRIVATE -> bắt buộc có owner_id VÀ invite_code
    --   PUBLIC  -> KHÔNG được có invite_code
    CONSTRAINT chk_rooms_private_fields CHECK (
        (visibility = 'PRIVATE' AND owner_id IS NOT NULL AND invite_code IS NOT NULL)
        OR (visibility = 'PUBLIC' AND invite_code IS NULL)
    )
);

-- INDEX giống mục lục sách: giúp DB tìm nhanh mà không phải đọc cả bảng.
-- Dùng cho: "lấy các phòng user X đã tạo" (giới hạn tối đa 2 private room/user, TSK-12).
CREATE INDEX idx_rooms_owner_id ON rooms (owner_id);


-- ---------------------------------------------------------------------
-- BẢNG study_sessions: mỗi lần học (1 Pomodoro) là 1 dòng.
-- Người phụ trách: Thọ (TSK-20). Tiên đọc bảng này cho history/dashboard/leaderboard (TSK-23, TSK-27).
--
-- VÒNG ĐỜI 1 SESSION (Excel TSK-20):
--   POST /api/study-sessions/start
--       -> tạo dòng mới: status = IN_PROGRESS, started_at = GIỜ SERVER
--   POST /api/study-sessions/finish
--       -> ended_at = giờ server
--       -> duration_minutes = ended_at - started_at  (server tự tính)
--       -> nếu đủ tối thiểu 5 phút: status = COMPLETED, xp_earned = server tự tính
--   Bỏ dở / không hợp lệ -> status = CANCELLED, xp_earned = 0
--
-- CHỐNG GIAN LẬN: client KHÔNG gửi thời lượng hay XP. Mọi thời gian lấy theo đồng hồ server.
-- ---------------------------------------------------------------------
CREATE TABLE study_sessions (
    id                UUID        PRIMARY KEY,
    -- Ai học. Xóa user thì xóa luôn lịch sử học của user đó.
    user_id           UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- Học ở phòng nào. Không CASCADE vì room chỉ xóa mềm (is_active), không bao giờ xóa thật.
    room_id           UUID        NOT NULL REFERENCES rooms (id),
    -- IN_PROGRESS / COMPLETED / CANCELLED. Phải khớp enum StudySessionStatus bên Java.
    status            VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
    -- Lúc bấm start (giờ server).
    started_at        TIMESTAMPTZ NOT NULL,
    -- Lúc kết thúc. NULL khi session còn đang chạy.
    ended_at          TIMESTAMPTZ,
    -- Số phút học thực tế. NULL khi chưa kết thúc.
    duration_minutes  INT,
    -- XP nhận được từ session này (Excel TSK-25: 1 phút = 1 XP).
    -- Lưu riêng từng session để leaderboard tuần tính được bằng SUM(xp_earned) trong tuần.
    xp_earned         INT         NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_ss_status   CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT chk_ss_duration CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
    CONSTRAINT chk_ss_xp       CHECK (xp_earned >= 0),
    -- Giờ kết thúc không được trước giờ bắt đầu.
    CONSTRAINT chk_ss_ended    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Index theo đúng các câu hỏi sẽ được hỏi nhiều nhất:
-- Lịch sử học / dashboard: "session của user X trong khoảng ngày A -> B".
-- Index 2 cột: tìm theo user_id trước, rồi trong đó lọc tiếp theo started_at.
CREATE INDEX idx_ss_user_started ON study_sessions (user_id, started_at);
-- Thống kê theo phòng (vd: phòng học yêu thích, TSK-23).
CREATE INDEX idx_ss_room_id      ON study_sessions (room_id);
-- Leaderboard tuần: "các session COMPLETED kết thúc trong tuần này".
CREATE INDEX idx_ss_status_ended ON study_sessions (status, ended_at);

-- PARTIAL UNIQUE INDEX (unique có điều kiện WHERE):
-- Trong các dòng đang IN_PROGRESS, mỗi user_id chỉ được xuất hiện 1 lần.
-- => 1 user có thể có 100 session COMPLETED, nhưng tối đa 1 session ĐANG CHẠY.
-- Chặn trường hợp bấm Start 2 lần thật nhanh (2 request tới cùng lúc) mà code Java có thể để lọt.
-- Backend cần bắt lỗi trùng này và trả về lỗi dễ hiểu cho client.
CREATE UNIQUE INDEX uq_ss_one_in_progress_per_user
    ON study_sessions (user_id) WHERE status = 'IN_PROGRESS';


-- ---------------------------------------------------------------------
-- BẢNG badges: danh mục huy hiệu (First Step, On Fire, Night Owl...).
-- Người phụ trách: Tiên (TSK-26). Bảng tạo sẵn ở đây, dữ liệu seed thêm sau (V2 hoặc DataSeeder).
-- ---------------------------------------------------------------------
CREATE TABLE badges (
    id               UUID         PRIMARY KEY,
    -- Mã cố định để code tra cứu, không đổi theo ngôn ngữ (vd: 'FIRST_STEP', 'ON_FIRE').
    code             VARCHAR(50)  NOT NULL UNIQUE,
    -- Tên hiển thị (vd: 'First Step').
    name             VARCHAR(100) NOT NULL,
    description      VARCHAR(255),
    -- Mã icon phía frontend, cùng ý tưởng với avatar_key.
    icon_key         VARCHAR(50),
    -- Điều kiện mở khóa, đọc theo cặp: loại + ngưỡng.
    --   vd: ('TOTAL_SESSIONS', 1)  -> hoàn thành phiên học đầu tiên
    --       ('STREAK_DAYS', 7)     -> học 7 ngày liên tiếp
    condition_type   VARCHAR(50)  NOT NULL,
    condition_value  INT          NOT NULL
);


-- ---------------------------------------------------------------------
-- BẢNG user_badges: user nào đã mở khóa badge nào, vào lúc nào.
-- Người phụ trách: Tiên (TSK-26).
--
-- Đây là BẢNG NỐI cho quan hệ n-n:
--   1 user có nhiều badge, 1 badge thuộc về nhiều user.
--   -> không nhét được vào users hay badges, phải có bảng ở giữa.
-- ---------------------------------------------------------------------
CREATE TABLE user_badges (
    id           UUID        PRIMARY KEY,
    user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    badge_id     UUID        NOT NULL REFERENCES badges (id) ON DELETE CASCADE,
    unlocked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- IDEMPOTENT: mỗi cặp (user, badge) chỉ có 1 dòng.
    -- Code trao badge lỡ chạy 2 lần thì lần 2 bị DB chặn, user không nhận trùng badge.
    CONSTRAINT uq_user_badges_user_badge UNIQUE (user_id, badge_id)
);
