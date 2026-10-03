-- =====================================================================
-- Focoya - V1 baseline schema (PostgreSQL)
-- QUY TẮC FLYWAY: file đã chạy thì KHÔNG sửa nữa. Muốn đổi schema -> tạo V2__..., V3__...
-- Presence (ai đang online) KHÔNG lưu ở đây, nó nằm trong memory của backend.
-- =====================================================================

-- ---------------------------------------------------------------------
-- users: tài khoản + profile cơ bản.
-- Tên bảng là "users" vì "user" là từ khóa của PostgreSQL.
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id              UUID         PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(50)  NOT NULL,
    avatar_key      VARCHAR(50),
    bio             VARCHAR(200),
    role            VARCHAR(20)  NOT NULL DEFAULT 'USER',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_users_role CHECK (role IN ('USER', 'ADMIN'))
);

-- ---------------------------------------------------------------------
-- gamification_profiles: XP / streak / daily goal của 1 user (quan hệ 1-1).
-- Level KHÔNG lưu, tính từ total_xp. Phần logic thuộc Tiên (TSK-25).
-- ---------------------------------------------------------------------
CREATE TABLE gamification_profiles (
    id                  UUID        PRIMARY KEY,
    user_id             UUID        NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    total_xp            INT         NOT NULL DEFAULT 0,
    current_streak      INT         NOT NULL DEFAULT 0,
    longest_streak      INT         NOT NULL DEFAULT 0,
    last_study_date     DATE,
    daily_goal_minutes  INT         NOT NULL DEFAULT 60,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_gp_total_xp      CHECK (total_xp >= 0),
    CONSTRAINT chk_gp_streak        CHECK (current_streak >= 0 AND longest_streak >= 0),
    CONSTRAINT chk_gp_daily_goal    CHECK (daily_goal_minutes > 0)
);

-- ---------------------------------------------------------------------
-- rooms: public room (seed sẵn, owner_id = NULL) và private room (user tạo, có invite_code).
-- Không xóa cứng room, chỉ set is_active = false, để lịch sử study_sessions vẫn trỏ được tới room.
-- ---------------------------------------------------------------------
CREATE TABLE rooms (
    id                  UUID         PRIMARY KEY,
    owner_id            UUID         REFERENCES users (id),
    name                VARCHAR(100) NOT NULL,
    description         TEXT,
    theme_key           VARCHAR(50)  NOT NULL,
    scene_key           VARCHAR(50),
    ambient_track_key   VARCHAR(50),
    visibility          VARCHAR(10)  NOT NULL,
    invite_code         VARCHAR(6)   UNIQUE,
    max_slots           INT          NOT NULL,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_rooms_visibility CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
    CONSTRAINT chk_rooms_max_slots  CHECK (max_slots > 0),
    -- Private room bắt buộc có owner + invite_code; public room thì không có invite_code.
    CONSTRAINT chk_rooms_private_fields CHECK (
        (visibility = 'PRIVATE' AND owner_id IS NOT NULL AND invite_code IS NOT NULL)
        OR (visibility = 'PUBLIC' AND invite_code IS NULL)
    )
);

CREATE INDEX idx_rooms_owner_id ON rooms (owner_id);

-- ---------------------------------------------------------------------
-- study_sessions: mỗi lần học (Pomodoro) là 1 dòng.
-- start  -> status = IN_PROGRESS, started_at = giờ server
-- finish -> status = COMPLETED, ended_at + duration_minutes do server tính, xp_earned do server tính
-- ---------------------------------------------------------------------
CREATE TABLE study_sessions (
    id                UUID        PRIMARY KEY,
    user_id           UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    room_id           UUID        NOT NULL REFERENCES rooms (id),
    status            VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
    started_at        TIMESTAMPTZ NOT NULL,
    ended_at          TIMESTAMPTZ,
    duration_minutes  INT,
    xp_earned         INT         NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_ss_status   CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT chk_ss_duration CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
    CONSTRAINT chk_ss_xp       CHECK (xp_earned >= 0),
    CONSTRAINT chk_ss_ended    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- History / dashboard / leaderboard đều lọc theo user và khoảng thời gian.
CREATE INDEX idx_ss_user_started ON study_sessions (user_id, started_at);
CREATE INDEX idx_ss_room_id      ON study_sessions (room_id);
-- Leaderboard tuần: lọc các session COMPLETED trong tuần.
CREATE INDEX idx_ss_status_ended ON study_sessions (status, ended_at);
-- Mỗi user chỉ được có tối đa 1 session IN_PROGRESS tại một thời điểm (chống bấm start 2 lần).
CREATE UNIQUE INDEX uq_ss_one_in_progress_per_user
    ON study_sessions (user_id) WHERE status = 'IN_PROGRESS';

-- ---------------------------------------------------------------------
-- badges + user_badges: thuộc TSK-26 (Tiên). Tạo bảng sẵn, seed sau.
-- ---------------------------------------------------------------------
CREATE TABLE badges (
    id               UUID         PRIMARY KEY,
    code             VARCHAR(50)  NOT NULL UNIQUE,
    name             VARCHAR(100) NOT NULL,
    description      VARCHAR(255),
    icon_key         VARCHAR(50),
    condition_type   VARCHAR(50)  NOT NULL,
    condition_value  INT          NOT NULL
);

CREATE TABLE user_badges (
    id           UUID        PRIMARY KEY,
    user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    badge_id     UUID        NOT NULL REFERENCES badges (id) ON DELETE CASCADE,
    unlocked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Idempotent: 1 user chỉ mở khóa 1 badge đúng 1 lần.
    CONSTRAINT uq_user_badges_user_badge UNIQUE (user_id, badge_id)
);
