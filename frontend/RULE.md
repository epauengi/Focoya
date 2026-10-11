# RULE.md — Focoya Development Rules

> Đây là **nguồn quy tắc chung của dự án Focoya**.  
> Mọi thành viên và AI coding assistant phải đọc file này trước khi tạo, sửa, refactor hoặc xoá code.

## 1. Nguyên tắc bắt buộc

1. **Đọc code hiện có trước khi sửa.** Không đoán cấu trúc project, API, schema hoặc convention.
2. **Không tự ý rewrite lớn.** Chỉ thay đổi phần cần thiết cho task đang làm.
3. **Không phá code đang chạy.** Giữ tương thích với các phần đã có, đặc biệt là landing page/template hiện tại.
4. **Không tự ý đổi kiến trúc, tech stack hoặc thư viện chính** nếu chưa được team thống nhất.
5. **Không tự ý đổi API contract hoặc database schema** chỉ để tiện cho implementation.
6. Nếu task chưa rõ hoặc có xung đột với code hiện tại, **dừng và hỏi trước khi sửa**.
7. Không xoá code, file, dependency, migration hoặc config mà chưa xác định chắc chắn chúng không còn được sử dụng.
8. Ưu tiên **thay đổi nhỏ, dễ review, dễ rollback**.

---

## 2. Tech stack chuẩn

- Frontend: **React + Vite**
- Backend: **Spring Boot 3**
- Database: **PostgreSQL / Supabase**
- Realtime: **WebSocket + STOMP**
- Local environment: **Docker / Docker Compose**

Không tự ý thay thế framework hoặc thêm công nghệ trùng chức năng nếu không thật sự cần thiết.

---

## 3. Quy trình trước khi code

Trước mỗi task, AI phải:

1. Xác định task đang làm và phạm vi file liên quan.
2. Đọc các file hiện có liên quan trực tiếp.
3. Kiểm tra xem đã có component/service/helper tương tự chưa.
4. Kiểm tra API contract / model / database liên quan trước khi tạo mới.
5. Nêu ngắn gọn kế hoạch thay đổi trước khi thực hiện nếu thay đổi ảnh hưởng nhiều file.

**Không tạo duplicate component, duplicate API, duplicate utility hoặc duplicate model nếu project đã có.**

---

## 4. Frontend rules

- Tái sử dụng component và design pattern hiện có.
- **Không làm lại landing page/template đã có** trừ khi task yêu cầu.
- Không hard-code dữ liệu nếu đã có API/model tương ứng.
- Không gọi API trực tiếp rải rác trong component nếu project đã có API layer.
- Component không nên chứa quá nhiều business logic.
- Luôn xử lý các state cần thiết:
  - loading
  - error
  - empty
  - disabled
- Không phá responsive layout hiện có.
- Không tự ý thay đổi toàn bộ màu sắc, typography hoặc spacing của project.
- Asset mới phải tối ưu dung lượng; ưu tiên SVG/WebP khi phù hợp.

---

## 5. Backend rules

- Giữ phân tầng rõ ràng, ví dụ:
  - Controller
  - Service
  - Repository
  - Entity / DTO
- Controller không chứa business logic phức tạp.
- Không expose trực tiếp Entity ra API nếu project đang dùng DTO.
- Validate input ở backend.
- Trả HTTP status và error response nhất quán.
- Không hard-code secret, password, token hoặc environment value.
- Không tự ý đổi endpoint/request/response nếu chưa cập nhật API contract.
- Logic liên quan XP, level, streak, badge hoặc StudySession phải được xử lý phía backend khi đó là dữ liệu authoritative.

---

## 6. Database rules

- **Không sửa database production bằng tay.**
- Mọi thay đổi schema phải đi qua migration.
- Không sửa migration cũ đã được merge/chạy ở môi trường chung; tạo migration mới.
- Không xoá cột/table khi chưa kiểm tra dependency.
- Không lưu dữ liệu realtime tạm thời vào DB nếu không cần thiết.
- Tránh lưu dữ liệu có thể tính lại từ nguồn chính nếu không có lý do rõ ràng.

---

## 7. API & Realtime rules

### REST
Dùng cho dữ liệu cần lưu trữ/persistent, ví dụ:
- User/Profile
- Room
- Study History
- Gamification

### WebSocket/STOMP
Dùng cho realtime, ví dụ:
- presence
- join/leave
- trạng thái học
- room events
- chat realtime

Không dùng WebSocket để broadcast dữ liệu không cần thiết mỗi giây.

Đối với Pomodoro:
- Server lưu mốc thời gian cần thiết như `startedAt` / `endsAt`.
- Client tự countdown.
- Không gửi timer tick mỗi giây qua WebSocket.

---

## 8. Git rules

- Không code trực tiếp trên `main`.
- Mỗi task nên có branch riêng.
- Không commit file secret hoặc `.env` thật.
- Commit chỉ chứa thay đổi liên quan đến task.
- Không trộn refactor lớn với feature/bugfix không liên quan.
- Trước khi merge:
  - project build được
  - không có lỗi lint/compiler nghiêm trọng
  - không phá feature hiện có
  - đã review diff

---

## 9. Dependency rules

AI **không được tự ý cài thêm package/library** chỉ vì implementation sẽ dễ hơn.

Trước khi thêm dependency:
1. Kiểm tra project đã có giải pháp tương đương chưa.
2. Xác định dependency thật sự cần thiết.
3. Ưu tiên thư viện phổ biến, được duy trì tốt.
4. Không thêm package cho việc có thể giải quyết đơn giản bằng code hiện có.

Không tự ý nâng major version dependency.

---

## 10. Security rules

Tuyệt đối không commit:

- API key
- JWT secret
- database password
- Supabase service key
- access token
- private credential

Dùng environment variables và `.env.example`.

AI không được log:
- password
- token
- secret
- thông tin xác thực nhạy cảm

Backend phải kiểm tra authorization, không chỉ dựa vào frontend.

---

## 11. Khi sửa code bằng AI

AI phải tuân theo thứ tự:

**READ → UNDERSTAND → PLAN → MODIFY → VERIFY**

Sau khi sửa, AI phải kiểm tra:

- Có thay đổi ngoài phạm vi task không?
- Có duplicate code không?
- Có phá API/schema hiện tại không?
- Có import/dependency thừa không?
- Có lỗi compile/build/type không?
- Có làm mất responsive hoặc behavior cũ không?

Nếu không chắc chắn về một thay đổi quan trọng:

> **Không tự quyết định. Hỏi người phụ trách trước.**

---

## 12. Không được làm

AI không được tự ý:

- Rewrite toàn bộ project.
- Đổi framework.
- Đổi cấu trúc project trên diện rộng.
- Rename hàng loạt file/folder.
- Xoá feature đang tồn tại.
- Thay toàn bộ UI theo style mới.
- Đổi database schema chỉ để code dễ hơn.
- Đổi API contract mà không báo.
- Tạo mock data rồi để lẫn vào production flow.
- Bỏ qua lỗi bằng cách comment code hoặc disable validation.
- Dùng `any`/workaround chỉ để hết lỗi mà không xử lý nguyên nhân.
- Commit secret.
- Sửa code ngoài task khi không cần thiết.

---

## 13. Definition of Done cho mỗi task

Một task chỉ được xem là hoàn thành khi:

- [ ] Đúng yêu cầu của task.
- [ ] Không phá chức năng hiện có.
- [ ] Build/compile thành công.
- [ ] Không có secret trong source.
- [ ] Không tạo code trùng không cần thiết.
- [ ] API/schema vẫn đúng contract hiện tại.
- [ ] UI giữ đúng design system/responsive hiện tại.
- [ ] Diff chỉ chứa thay đổi liên quan.
- [ ] Code đủ rõ để thành viên khác tiếp tục phát triển.

---

## 14. Quy tắc ưu tiên khi có xung đột

Nếu có xung đột giữa nhiều nguồn hướng dẫn, ưu tiên theo thứ tự:

1. **Yêu cầu task/issue đã được team xác nhận**
2. **RULE.md**
3. **API contract / database schema / design system hiện tại**
4. **Code và convention hiện có trong project**
5. Đề xuất của AI

AI **không được tự ý ghi đè quyết định của team**.

---

## 15. Prompt bắt buộc cho AI

Khi bắt đầu một phiên coding mới, dùng:

> Read `RULE.md` first and treat it as mandatory project instructions.  
> Inspect the existing code before making changes.  
> Do not modify anything outside the current task unless required.  
> If the task conflicts with `RULE.md`, API contract, database schema, or existing architecture, stop and explain the conflict before coding.
