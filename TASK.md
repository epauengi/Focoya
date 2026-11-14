# FOCOYA — README DANH SÁCH TASK

- **Phạm vi:** 40 task chính (`TSK-01` đến `TSK-40`) và 7 mục backlog tùy chọn (`BKL-01` đến `BKL-07`).
- **Quy mô:** 5 thành viên; công nghệ dự kiến: React/Vite, Spring Boot 3, PostgreSQL/Supabase, WebSocket/STOMP, Docker.
- **Lịch thực hiện theo tab quản lý:** 28/09/2026–20/12/2026. Các backlog dự kiến sau nghiệm thu.
- **Quy ước:** "Trạng thái trên sheet" phản ánh kế hoạch được cập nhật trong bảng, không khẳng định tính năng đã vận hành hay qua kiểm thử.

## A. 40 task chính theo Sprint

## Sprint 0

### TSK-01 — Kiến trúc & Setup

**Công việc:** Chốt scope/tech stack, tạo repo, cấu trúc FE/BE, convention Git & môi trường dev

- **Phụ trách chính:** Phong
- **Hỗ trợ:** Thọ, Tiên
- **Bắt đầu:** 2026-09-28
- **Deadline:** 2026-09-29
- **Loại công việc:** Setup
- **Đầu ra bàn giao:** Repo skeleton + README + branch convention
- **Trạng thái trên sheet:** Đã hoàn thành (100%)
- **Phụ thuộc:** -
- **Ghi chú/kỹ thuật:** Chốt sớm để cả nhóm bắt đầu đồng bộ

### TSK-02 — Backend & Database

**Công việc:** Thiết kế PostgreSQL ERD, JPA entities và migration baseline

- **Phụ trách chính:** Thọ
- **Hỗ trợ:** Tiên
- **Bắt đầu:** 2026-09-28
- **Deadline:** 2026-10-02
- **Loại công việc:** Setup
- **Đầu ra bàn giao:** ERD + schema + migration v1
- **Trạng thái trên sheet:** Đã hoàn thành (100%)
- **Phụ thuộc:** TSK-01
- **Ghi chú/kỹ thuật:** Không lưu presence realtime vào DB

### TSK-03 — API & Thiết kế

**Công việc:** Chuẩn hóa API Contract/OpenAPI cho Auth, User, Room, Study, Gamification

- **Phụ trách chính:** Tiên
- **Hỗ trợ:** Thọ, Phong
- **Bắt đầu:** 2026-09-29
- **Deadline:** 2026-10-04
- **Loại công việc:** Docs
- **Đầu ra bàn giao:** OpenAPI/Swagger contract v1
- **Trạng thái trên sheet:** Đã hoàn thành (100%)
- **Phụ thuộc:** TSK-01, TSK-02
- **Ghi chú/kỹ thuật:** REST cho dữ liệu persistent; WS cho realtime

### TSK-04 — UI/UX Design

**Công việc:** Thiết kế Design System, IA, wireframe các màn hình chính và responsive rules

- **Phụ trách chính:** Thảo
- **Hỗ trợ:** Tân
- **Bắt đầu:** 2026-09-28
- **Deadline:** 2026-10-04
- **Loại công việc:** Design
- **Đầu ra bàn giao:** Figma + UI tokens + wireframes
- **Trạng thái trên sheet:** Đã hoàn thành (100%)
- **Phụ thuộc:** TSK-01
- **Ghi chú/kỹ thuật:** Ưu tiên room screen tạo WOW moment

### TSK-05 — Frontend Room

**Công việc:** Prototype asset/theme cho Rainy Café, Midnight Library, Autumn Forest, Sunset Beach

- **Phụ trách chính:** Tân
- **Hỗ trợ:** Thảo
- **Bắt đầu:** 2026-09-30
- **Deadline:** 2026-10-04
- **Loại công việc:** Design
- **Đầu ra bàn giao:** 4 scene prototype + asset guideline
- **Trạng thái trên sheet:** Đã hoàn thành (100%)
- **Phụ thuộc:** TSK-04
- **Ghi chú/kỹ thuật:** Asset nhẹ, ưu tiên CSS/SVG/WebP

## Sprint 1

### TSK-06 — Backend Auth

**Công việc:** Xây dựng đăng ký/đăng nhập email, JWT access/refresh và Spring Security

- **Phụ trách chính:** Thọ
- **Hỗ trợ:** Phong
- **Bắt đầu:** 2026-10-05
- **Deadline:** 2026-10-12
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Auth API + security config
- **Trạng thái trên sheet:** Đã hoàn thành (100%)
- **Phụ thuộc:** TSK-02, TSK-03
- **Ghi chú/kỹ thuật:** Google OAuth để sau khi email/password ổn định

### TSK-07 — Frontend Auth

**Công việc:** Xây dựng Login/Register/Forgot-state UI responsive theo Design System

- **Phụ trách chính:** Thảo
- **Hỗ trợ:** Phong
- **Bắt đầu:** 2026-10-05
- **Deadline:** 2026-10-10
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Auth screens hoàn chỉnh
- **Trạng thái trên sheet:** Đã hoàn thành (100%)
- **Phụ thuộc:** TSK-04
- **Ghi chú/kỹ thuật:** Có loading/error/empty state

### TSK-08 — Fullstack Auth

**Công việc:** Tích hợp Auth FE↔BE, protected routes, session restore và logout flow

- **Phụ trách chính:** Phong
- **Hỗ trợ:** Thọ, Thảo
- **Bắt đầu:** 2026-10-11
- **Deadline:** 2026-10-16
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Auth end-to-end
- **Trạng thái trên sheet:** Đã hoàn thành (100%)
- **Phụ thuộc:** TSK-06, TSK-07
- **Ghi chú/kỹ thuật:** Không lưu sensitive token sai cách

### TSK-09 — Backend User

**Công việc:** User/Profile API: avatarKey, displayName, bio, stats cơ bản

- **Phụ trách chính:** Thọ
- **Hỗ trợ:** Tiên
- **Bắt đầu:** 2026-10-13
- **Deadline:** 2026-10-16
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** User/Profile endpoints
- **Trạng thái trên sheet:** Đã hoàn thành (100%)
- **Phụ thuộc:** TSK-06
- **Ghi chú/kỹ thuật:** Level tính từ totalXP, không lưu trùng

### TSK-10 — Frontend Core

**Công việc:** Landing + onboarding + giới thiệu feature/room nổi bật

- **Phụ trách chính:** Thảo
- **Hỗ trợ:** Tân
- **Bắt đầu:** 2026-10-05
- **Deadline:** 2026-10-11
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Landing responsive
- **Trạng thái trên sheet:** Đã hoàn thành (90%)
- **Phụ thuộc:** TSK-04
- **Ghi chú/kỹ thuật:** Không biến thành dashboard generic

### TSK-11 — Frontend Rooms

**Công việc:** Trang Explore Rooms: public rooms, online count placeholder, filter/theme cards

- **Phụ trách chính:** Tân
- **Hỗ trợ:** Thảo
- **Bắt đầu:** 2026-10-05
- **Deadline:** 2026-10-12
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Rooms list UI
- **Trạng thái trên sheet:** Đã hoàn thành (90%)
- **Phụ thuộc:** TSK-04
- **Ghi chú/kỹ thuật:** Data mock trước, nối API sau

### TSK-12 — Backend Room

**Công việc:** Room CRUD, public seed rooms, private room/invite code, slot limit

- **Phụ trách chính:** Thọ
- **Hỗ trợ:** Phong
- **Bắt đầu:** 2026-10-13
- **Deadline:** 2026-10-18
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Room REST API
- **Trạng thái trên sheet:** Đã hoàn thành (90%)
- **Phụ thuộc:** TSK-02, TSK-03
- **Ghi chú/kỹ thuật:** User chỉ tạo private room trong MVP

### TSK-13 — Frontend Data Layer

**Công việc:** Tạo API client, TanStack Query conventions, error/loading handling

- **Phụ trách chính:** Phong
- **Hỗ trợ:** Tiên
- **Bắt đầu:** 2026-10-05
- **Deadline:** 2026-10-09
- **Loại công việc:** Setup
- **Đầu ra bàn giao:** Shared API/query layer
- **Trạng thái trên sheet:** Đang thực hiện (70%)
- **Phụ thuộc:** TSK-01, TSK-03
- **Ghi chú/kỹ thuật:** Chuẩn hóa query keys và error mapping

### TSK-14 — Frontend Rooms

**Công việc:** Room Preview: scene preview, mô tả, online/slot, Join CTA

- **Phụ trách chính:** Phong
- **Hỗ trợ:** Thảo
- **Bắt đầu:** 2026-10-13
- **Deadline:** 2026-10-18
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Room preview screen
- **Trạng thái trên sheet:** Đã hoàn thành (100%)
- **Phụ thuộc:** TSK-11
- **Ghi chú/kỹ thuật:** Tối ưu ảnh/animation trước khi vào room

### TSK-15 — Frontend Profile

**Công việc:** Profile page: avatar, bio, XP/level, streak, stats placeholders

- **Phụ trách chính:** Thảo
- **Hỗ trợ:** Tiên
- **Bắt đầu:** 2026-10-13
- **Deadline:** 2026-10-18
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Profile UI
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-09, TSK-04
- **Ghi chú/kỹ thuật:** Nối dữ liệu thật khi API sẵn sàng

## Sprint 2

### TSK-16 — Realtime Backend

**Công việc:** Spring WebSocket + STOMP, room topic, PresenceRegistry, join/leave/status events

- **Phụ trách chính:** Thọ
- **Hỗ trợ:** Phong
- **Bắt đầu:** 2026-10-19
- **Deadline:** 2026-10-24
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Realtime backend foundation
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-12
- **Ghi chú/kỹ thuật:** Auto cleanup khi disconnect/reconnect

### TSK-17 — Realtime Frontend

**Công việc:** WebSocket client layer: connect/reconnect, subscribe room, typed event handlers

- **Phụ trách chính:** Phong
- **Hỗ trợ:** Thọ, Tân
- **Bắt đầu:** 2026-10-22
- **Deadline:** 2026-10-28
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Realtime client foundation
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-16, TSK-13
- **Ghi chú/kỹ thuật:** Không broadcast timer mỗi giây

### TSK-18 — Frontend Room

**Công việc:** Immersive room scene + ambient audio controls + reduced-motion fallback

- **Phụ trách chính:** Tân
- **Hỗ trợ:** Thảo
- **Bắt đầu:** 2026-10-19
- **Deadline:** 2026-10-26
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Study room scene
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-05, TSK-14
- **Ghi chú/kỹ thuật:** Dùng CSS transform/opacity, tránh hiệu ứng nặng

### TSK-19 — Frontend Realtime

**Công việc:** Presence UI: avatar seats, studying/break/idle status, join/leave animation

- **Phụ trách chính:** Tân
- **Hỗ trợ:** Phong
- **Bắt đầu:** 2026-10-27
- **Deadline:** 2026-11-01
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Realtime presence UI
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-17, TSK-18
- **Ghi chú/kỹ thuật:** State phải khớp snapshot từ server

### TSK-20 — Backend Study

**Công việc:** Pomodoro + StudySession backend, event start/complete, persistence và XP hook

- **Phụ trách chính:** Thọ
- **Hỗ trợ:** Tiên
- **Bắt đầu:** 2026-10-25
- **Deadline:** 2026-11-01
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** StudySession/Pomodoro service
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-16, TSK-02
- **Ghi chú/kỹ thuật:** Server lưu startedAt/endsAt, client tự countdown

### TSK-21 — Frontend Pomodoro

**Công việc:** Pomodoro UI, settings focus/break, browser notification, status sync

- **Phụ trách chính:** Tân
- **Hỗ trợ:** Phong
- **Bắt đầu:** 2026-10-27
- **Deadline:** 2026-11-01
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Pomodoro end-to-end UI
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-18, TSK-20
- **Ghi chú/kỹ thuật:** Không gửi tick mỗi giây qua WebSocket

### TSK-22 — Fullstack Rooms

**Công việc:** Private room invite/join-by-code flow end-to-end + error states

- **Phụ trách chính:** Phong
- **Hỗ trợ:** Thọ, Thảo
- **Bắt đầu:** 2026-10-25
- **Deadline:** 2026-11-01
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Private room flow
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-12, TSK-13, TSK-17
- **Ghi chú/kỹ thuật:** Test room full/sai mã/hết quyền truy cập

### TSK-23 — Backend Analytics

**Công việc:** Study history API, aggregation theo ngày/tuần, favorite room, peak hour

- **Phụ trách chính:** Tiên
- **Hỗ trợ:** Thọ
- **Bắt đầu:** 2026-10-26
- **Deadline:** 2026-11-01
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Study history/stat queries
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-20
- **Ghi chú/kỹ thuật:** Tối ưu query/index theo user + date

## Sprint 3

### TSK-24 — Frontend History

**Công việc:** Trang Study History: session list, filter ngày/phòng, empty/loading states

- **Phụ trách chính:** Tiên
- **Hỗ trợ:** Thảo
- **Bắt đầu:** 2026-11-02
- **Deadline:** 2026-11-07
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Study history page
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-23, TSK-13
- **Ghi chú/kỹ thuật:** Giữ UI đồng nhất Design System

### TSK-25 — Backend Gamification

**Công việc:** XP, level thresholds, streak update và daily goal business rules

- **Phụ trách chính:** Tiên
- **Hỗ trợ:** Thọ
- **Bắt đầu:** 2026-11-02
- **Deadline:** 2026-11-08
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Gamification service
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-20
- **Ghi chú/kỹ thuật:** XP chỉ được cộng ở backend

### TSK-26 — Backend Achievement

**Công việc:** Badge/Achievement engine + seed First Step, On Fire, Night Owl...

- **Phụ trách chính:** Tiên
- **Hỗ trợ:** Thọ
- **Bắt đầu:** 2026-11-09
- **Deadline:** 2026-11-15
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Achievement service + seed data
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-25
- **Ghi chú/kỹ thuật:** Badge unlock idempotent

### TSK-27 — Backend Dashboard

**Công việc:** Dashboard + weekly leaderboard APIs, heatmap activity dataset

- **Phụ trách chính:** Tiên
- **Hỗ trợ:** Thọ
- **Bắt đầu:** 2026-11-02
- **Deadline:** 2026-11-15
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Dashboard/leaderboard APIs
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-23, TSK-25
- **Ghi chú/kỹ thuật:** Leaderboard chỉ cần weekly MVP

### TSK-28 — Frontend Dashboard

**Công việc:** Dashboard, Recharts, heatmap, weekly goal và leaderboard UI

- **Phụ trách chính:** Tiên
- **Hỗ trợ:** Thảo
- **Bắt đầu:** 2026-11-09
- **Deadline:** 2026-11-15
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Dashboard + leaderboard screens
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-27, TSK-04
- **Ghi chú/kỹ thuật:** Không quá nhiều card; ưu tiên biểu đồ rõ

### TSK-29 — Frontend Settings

**Công việc:** Settings: Pomodoro defaults, audio volume, notification preferences, account basics

- **Phụ trách chính:** Thảo
- **Hỗ trợ:** Tân
- **Bắt đầu:** 2026-11-02
- **Deadline:** 2026-11-07
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Settings screen
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-04, TSK-08
- **Ghi chú/kỹ thuật:** Tách settings local và account settings

### TSK-30 — Realtime Chat

**Công việc:** Chat text ngắn realtime, max 200 chars, last messages in-memory, rate-limit basic

- **Phụ trách chính:** Phong
- **Hỗ trợ:** Thọ, Tân
- **Bắt đầu:** 2026-11-02
- **Deadline:** 2026-11-08
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Room chat end-to-end
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-16, TSK-17
- **Ghi chú/kỹ thuật:** MVP không cần lưu chat DB

### TSK-31 — Frontend Quality

**Công việc:** Responsive + accessibility audit: keyboard, focus, contrast, reduced motion

- **Phụ trách chính:** Thảo
- **Hỗ trợ:** Tân
- **Bắt đầu:** 2026-11-08
- **Deadline:** 2026-11-15
- **Loại công việc:** Testing
- **Đầu ra bàn giao:** Responsive/A11y checklist pass
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-07, TSK-10, TSK-15, TSK-29
- **Ghi chú/kỹ thuật:** Ưu tiên mobile + laptop 1366px

### TSK-32 — Frontend Performance

**Công việc:** Tối ưu animation/asset/audio room, mobile polish, lazy load theme assets

- **Phụ trách chính:** Tân
- **Hỗ trợ:** Phong
- **Bắt đầu:** 2026-11-09
- **Deadline:** 2026-11-15
- **Loại công việc:** Feature
- **Đầu ra bàn giao:** Room performance pass
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-18, TSK-19, TSK-21, TSK-30
- **Ghi chú/kỹ thuật:** Kiểm tra FPS và memory khi ở room lâu

## Sprint 4

### TSK-33 — Backend Quality

**Công việc:** Validation, exception model, security review, API docs, integration/unit tests backend

- **Phụ trách chính:** Thọ
- **Hỗ trợ:** Tiên
- **Bắt đầu:** 2026-11-16
- **Deadline:** 2026-11-22
- **Loại công việc:** Testing
- **Đầu ra bàn giao:** Backend hardening + test report
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-06, TSK-12, TSK-20, TSK-25
- **Ghi chú/kỹ thuật:** Check authz room private + input validation

### TSK-34 — Frontend Quality

**Công việc:** UI regression, cross-page consistency, loading/error/empty states, visual polish

- **Phụ trách chính:** Thảo
- **Hỗ trợ:** Tân, Phong
- **Bắt đầu:** 2026-11-16
- **Deadline:** 2026-11-22
- **Loại công việc:** Testing
- **Đầu ra bàn giao:** UI regression checklist
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-31
- **Ghi chú/kỹ thuật:** Chốt typography/spacing/component states

## Sprint 5

### TSK-35 — Test & Tài liệu

**Công việc:** Integration test data, seed accounts/rooms, test cases và chương phân tích hệ thống

- **Phụ trách chính:** Tiên
- **Hỗ trợ:** Thọ, Phong
- **Bắt đầu:** 2026-11-23
- **Deadline:** 2026-12-06
- **Loại công việc:** Testing
- **Đầu ra bàn giao:** Seed data + test cases + report section
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-27, TSK-33
- **Ghi chú/kỹ thuật:** Chuẩn bị dữ liệu demo không phụ thuộc mạng ngoài

### TSK-36 — Demo & Frontend

**Công việc:** Cross-browser/device test room, chuẩn bị demo accounts/scenes và demo script assets

- **Phụ trách chính:** Tân
- **Hỗ trợ:** Thảo, Phong
- **Bắt đầu:** 2026-11-30
- **Deadline:** 2026-12-13
- **Loại công việc:** Testing
- **Đầu ra bàn giao:** Demo dataset + room assets + test notes
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-32, TSK-34
- **Ghi chú/kỹ thuật:** Mở sẵn 2-3 account/tab cho realtime demo

### TSK-37 — Tài liệu Backend

**Công việc:** Viết chương Backend/API/Database/Realtime, sơ đồ kiến trúc và ảnh Swagger

- **Phụ trách chính:** Thọ
- **Hỗ trợ:** Tiên
- **Bắt đầu:** 2026-11-30
- **Deadline:** 2026-12-13
- **Loại công việc:** Docs
- **Đầu ra bàn giao:** Backend report section
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-33
- **Ghi chú/kỹ thuật:** Bám implementation thực tế, không viết chung chung

### TSK-38 — Tài liệu UI/UX

**Công việc:** Viết chương UI/UX, sitemap, layout, kỹ thuật responsive/animation và chụp màn hình

- **Phụ trách chính:** Thảo
- **Hỗ trợ:** Tân
- **Bắt đầu:** 2026-11-30
- **Deadline:** 2026-12-13
- **Loại công việc:** Docs
- **Đầu ra bàn giao:** UI/UX report section + screenshots
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-34
- **Ghi chú/kỹ thuật:** Chuẩn hóa caption/figure cho báo cáo

### TSK-39 — DevOps & Release

**Công việc:** Docker/CI, deploy FE/BE/DB, env production, smoke test, final integration & release candidate

- **Phụ trách chính:** Phong
- **Hỗ trợ:** Thọ, Tiên
- **Bắt đầu:** 2026-11-23
- **Deadline:** 2026-12-17
- **Loại công việc:** DevOps
- **Đầu ra bàn giao:** Production URL + release candidate
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-33, TSK-34, TSK-35
- **Ghi chú/kỹ thuật:** Có phương án backup demo local nếu cloud lỗi

## Final

### TSK-40 — Demo & Nghiệm thu

**Công việc:** Chuẩn bị demo flow, slide merge, rehearsal kỹ thuật và checklist nộp bài

- **Phụ trách chính:** Phong
- **Hỗ trợ:** Thọ, Tiên, Thảo, Tân
- **Bắt đầu:** 2026-12-15
- **Deadline:** 2026-12-20
- **Loại công việc:** Docs
- **Đầu ra bàn giao:** Slide + demo checklist + gói nộp cuối
- **Trạng thái trên sheet:** Chưa bắt đầu (0%)
- **Phụ thuộc:** TSK-35, TSK-36, TSK-37, TSK-38, TSK-39
- **Ghi chú/kỹ thuật:** Mỗi thành viên phải hiểu phần mình để vấn đáp

## B. Backlog tùy chọn P1/P2

Các mục dưới đây nằm ngoài 40 task KPI chính. Theo sheet, chỉ thực hiện khi core flow ổn định, dự kiến sau nghiệm thu.

### BKL-01 — Authentication (P1)

**Tính năng đề xuất:** Tích hợp Google OAuth 2.0 & Social Login

- **Mức ưu tiên:** P1
- **Phụ trách dự kiến:** Thọ
- **Người hỗ trợ:** Phong
- **Mốc dự kiến:** Từ 21/12/2026
- **Deadline:** Sau nghiệm thu
- **Loại công việc:** Feature
- **Đầu ra kỳ vọng:** Google OAuth client + token exchange
- **Trạng thái trên sheet:** Backlog (0%)
- **Phụ thuộc:** TSK-06, TSK-08
- **Ghi chú kỹ thuật:** Triển khai sau khi luồng email/password production ổn định

### BKL-02 — Media / Audio (P1)

**Tính năng đề xuất:** Tích hợp Spotify API / lofi web stream player & custom ambient soundpacks

- **Mức ưu tiên:** P1
- **Phụ trách dự kiến:** Tân
- **Người hỗ trợ:** Thảo
- **Mốc dự kiến:** Từ 21/12/2026
- **Deadline:** Sau nghiệm thu
- **Loại công việc:** Feature
- **Đầu ra kỳ vọng:** Spotify Web Playback SDK / custom player UI
- **Trạng thái trên sheet:** Backlog (0%)
- **Phụ thuộc:** TSK-18, TSK-21
- **Ghi chú kỹ thuật:** Cần kiểm tra bản quyền audio và CORS iframe

### BKL-03 — Social & Friends (P1)

**Tính năng đề xuất:** Hệ thống kết bạn, xem bạn bè online & mời trực tiếp vào phòng riêng

- **Mức ưu tiên:** P1
- **Phụ trách dự kiến:** Phong
- **Người hỗ trợ:** Thọ
- **Mốc dự kiến:** Từ 21/12/2026
- **Deadline:** Sau nghiệm thu
- **Loại công việc:** Feature
- **Đầu ra kỳ vọng:** Friend list, invite notification & online status
- **Trạng thái trên sheet:** Backlog (0%)
- **Phụ thuộc:** TSK-16, TSK-22
- **Ghi chú kỹ thuật:** Mở rộng STOMP user destination

### BKL-04 — Phòng học ảo (P2)

**Tính năng đề xuất:** Cho phép upload custom background (ảnh/video looping WebM) cho phòng học

- **Mức ưu tiên:** P2
- **Phụ trách dự kiến:** Tân
- **Người hỗ trợ:** Thảo
- **Mốc dự kiến:** Từ 21/12/2026
- **Deadline:** Sau nghiệm thu
- **Loại công việc:** Feature
- **Đầu ra kỳ vọng:** Custom scene uploader & Cloudinary/S3 storage
- **Trạng thái trên sheet:** Backlog (0%)
- **Phụ thuộc:** TSK-18
- **Ghi chú kỹ thuật:** Giới hạn dung lượng file < 15MB để tránh lag

### BKL-05 — Gamification (P2)

**Tính năng đề xuất:** Shop vật phẩm ảo (mua hình nền, âm thanh, khung avatar bằng XP tích lũy)

- **Mức ưu tiên:** P2
- **Phụ trách dự kiến:** Tiên
- **Người hỗ trợ:** Thảo
- **Mốc dự kiến:** Từ 21/12/2026
- **Deadline:** Sau nghiệm thu
- **Loại công việc:** Feature
- **Đầu ra kỳ vọng:** Virtual store API & UI catalog
- **Trạng thái trên sheet:** Backlog (0%)
- **Phụ thuộc:** TSK-25, TSK-26
- **Ghi chú kỹ thuật:** Đảm bảo tính toàn vẹn giao dịch ảo (XP deduction)

### BKL-06 — Trợ lý AI (P2)

**Tính năng đề xuất:** Focoya AI Study Bot hỗ trợ gợi ý thời gian nghỉ và tóm tắt mục tiêu học tập

- **Mức ưu tiên:** P2
- **Phụ trách dự kiến:** Thọ
- **Người hỗ trợ:** Tiên
- **Mốc dự kiến:** Từ 21/12/2026
- **Deadline:** Sau nghiệm thu
- **Loại công việc:** Feature
- **Đầu ra kỳ vọng:** AI webhook service kết nối Gemini API
- **Trạng thái trên sheet:** Backlog (0%)
- **Phụ thuộc:** TSK-20, TSK-27
- **Ghi chú kỹ thuật:** Rate limit API call và token budget

### BKL-07 — Nền tảng di động (P2)

**Tính năng đề xuất:** Cấu hình Progressive Web App (PWA) & responsive tối ưu cho iPad/Tablet

- **Mức ưu tiên:** P2
- **Phụ trách dự kiến:** Thảo
- **Người hỗ trợ:** Tân
- **Mốc dự kiến:** Từ 21/12/2026
- **Deadline:** Sau nghiệm thu
- **Loại công việc:** Feature
- **Đầu ra kỳ vọng:** PWA service worker, manifest & touch gestures
- **Trạng thái trên sheet:** Backlog (0%)
- **Phụ thuộc:** TSK-31, TSK-34
- **Ghi chú kỹ thuật:** Tối ưu trải nghiệm chạm và offline indicator
