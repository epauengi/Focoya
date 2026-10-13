# Focoya – Luồng Auth Backend (TSK-06)

> Cập nhật: 12/10/2026 · Nhánh `feature/auth`
> Thư mục code: `backend/study-room-backend/src/main/java/com/lofi/studyroombackend/`

TSK-06 cho backend 3 API công khai (đăng ký, đăng nhập, refresh) và một "trạm gác" JWT bảo vệ mọi API còn lại: thiếu hoặc sai token thì trả **401**.

**Cách đọc:** đọc mục 2 (Khái niệm nền) trước, rồi đi theo 4 flow (mục 3–6). Mỗi flow ghi rõ request đi qua file nào, hàm nào.

## Mục lục

1. [Bản đồ các file](#1-bản-đồ-các-file)
2. [Khái niệm nền](#2-khái-niệm-nền)
3. [Flow 1 – Đăng ký](#3-flow-1--đăng-ký)
4. [Flow 2 – Đăng nhập](#4-flow-2--đăng-nhập)
5. [Flow 3 – Gọi API có token](#5-flow-3--gọi-api-có-token)
6. [Flow 4 – Refresh token](#6-flow-4--refresh-token)
7. [Xử lý lỗi](#7-xử-lý-lỗi)
8. [Hợp đồng API cho FE](#8-hợp-đồng-api-cho-fe)
9. [Cấu hình và biến môi trường](#9-cấu-hình-và-biến-môi-trường)
10. [Câu hỏi vấn đáp hay gặp](#10-câu-hỏi-vấn-đáp-hay-gặp)
11. [Giới hạn hiện tại và việc còn lại](#11-giới-hạn-hiện-tại-và-việc-còn-lại)

---

## 1. Bản đồ các file

```
studyroombackend/
├── config/
│   └── SecurityConfig.java          luật URL, STATELESS, CORS, 401 JSON, bean BCrypt, gắn filter
├── security/
│   ├── JwtTokenProvider.java        tạo + đọc (kiểm tra) token
│   └── JwtAuthenticationFilter.java đọc header Bearer ở MỌI request, ghi user vào SecurityContext
├── controller/
│   ├── AuthController.java          /api/auth/register, /login, /refresh
│   └── TestController.java          /api/hello (cần token, để thử filter)
├── service/
│   ├── AuthService.java             interface: register, login, refresh
│   └── AuthServiceImpl.java         logic
├── repository/
│   └── UserRepository.java          findByEmail, existsByEmail (+ save, findById có sẵn)
├── dto/
│   ├── request/                     RegisterRequest, LoginRequest, RefreshTokenRequest
│   └── response/                    AuthResponse, UserResponse, ErrorResponse
└── exception/
    └── GlobalExceptionHandler.java  đổi exception thành JSON { status, message }

src/main/resources/application.yml   jwt.*, cors.*
src/test/.../security/JwtTokenProviderTest.java   5 unit test cho token
```

| File | Vai trò |
| --- | --- |
| `SecurityConfig` | Luật "URL nào cần đăng nhập", STATELESS, CORS, trả 401 dạng JSON, bean BCrypt, gắn filter JWT vào dãy filter |
| `JwtTokenProvider` | Tạo access/refresh token và đọc (kiểm tra) token |
| `JwtAuthenticationFilter` | Chạy ở mọi request: đọc `Authorization: Bearer ...`, token hợp lệ thì ghi user vào `SecurityContext` |
| `AuthController` | 3 endpoint auth. Chỉ nhận request rồi gọi service ("controller mỏng") |
| `AuthService` + `AuthServiceImpl` | Kiểm tra email trùng, mã hóa mật khẩu, so mật khẩu, tạo token |
| `UserRepository` | Truy vấn bảng `users` |
| DTO `request/` | Khuôn JSON FE gửi lên, kèm luật validate |
| DTO `response/` | Khuôn JSON trả về. `UserResponse` **không có** `passwordHash` |
| `GlobalExceptionHandler` | Bắt exception từ controller/service, trả JSON lỗi chung |

---

## 2. Khái niệm nền

### 2.1. JWT gồm 3 phần

Token có dạng `xxxxx.yyyyy.zzzzz`, ngăn bởi dấu chấm:

| Phần | Chứa gì | Ví dụ |
| --- | --- | --- |
| Header | Thuật toán ký | `{"alg":"HS256"}` |
| Payload (claims) | Thông tin user và token | `{"sub":"<userId>","email":"...","role":"USER","type":"access","iat":...,"exp":...}` |
| Signature | HMAC-SHA256(header + payload, **secret**) | chuỗi ngẫu nhiên |

- Payload chỉ là base64, **ai cũng đọc được** (dán vào jwt.io là thấy). Không bao giờ để mật khẩu hay `passwordHash` trong token.
- Không ai **sửa** được payload mà không bị phát hiện: sửa xong chữ ký không còn khớp, muốn ký lại phải có secret.
- Vì vậy server **không cần lưu token vào DB**:

```
Server nhận token
  → tách header.payload và signature
  → tự tính HMAC-SHA256(header.payload, secret)
  → khớp signature?     không → từ chối (bị sửa / giả mạo)
  → exp còn hạn không?  hết hạn → từ chối
  → OK: tin payload, biết đây là user nào
```

### 2.2. Encoding, Encryption, Hashing

| | Đọc ngược được không | Dùng ở đâu |
| --- | --- | --- |
| Encoding (base64) | Ai cũng đọc được, không cần khóa | Payload JWT |
| Encryption (mã hóa) | Phải có khóa mới đọc được | Không dùng |
| Hashing (BCrypt) | Không dịch ngược được, chỉ hash lại rồi so | Mật khẩu |

JWT của nhóm được **ký** (signing), không mã hóa. Ký chống *sửa*, không chống *đọc*.

### 2.3. BCrypt và salt

Salt là chuỗi ngẫu nhiên trộn vào mật khẩu trước khi hash, nên hai người cùng mật khẩu vẫn ra hai hash khác nhau. Salt được **lưu ngay trong chuỗi hash**:

```
$2a$10$N9qo8uLOickgx2ZMRZoMye IjZAgcfl7p92ldGxad68LJZdL17lhWy
 │   │  └── salt (22 ký tự) ──┘└────── hash (31 ký tự) ──────┘
 │   └─ cost = 10 (2^10 vòng, cố tình chậm)
 └─ phiên bản BCrypt
```

`passwordEncoder.matches(matKhauNhap, hashTrongDB)`:

1. Tách salt + cost ra từ hash trong DB.
2. Hash lại mật khẩu vừa nhập với đúng salt + cost đó.
3. So kết quả với phần hash trong DB.

Không được dùng `encode()` rồi `equals()`: mỗi lần `encode` sinh salt mới nên luôn ra chuỗi khác.

### 2.4. Stateless

Server **không nhớ** ai đã đăng nhập (không session, không cookie `JSESSIONID`). Mỗi request tự mang access token để chứng minh mình là ai. Cấu hình: `SessionCreationPolicy.STATELESS`.

### 2.5. CSRF

CSRF lợi dụng việc trình duyệt **tự gửi cookie** kèm request. Nhóm gửi token trong header `Authorization`, trình duyệt không tự gắn header này, nên tắt CSRF là an toàn.

### 2.6. CORS

Origin = giao thức + domain + port. FE (`http://localhost:5174`) và BE (`http://localhost:8080`) khác port nên **khác origin**.

- CORS là luật do **trình duyệt** thực thi. Postman không phải trình duyệt nên không bị.
- Trước request thật, trình duyệt gửi `OPTIONS` (preflight) để xin phép. Server phải trả header `Access-Control-Allow-Origin` khớp origin của FE, nếu không trình duyệt chặn.

```
TRÌNH DUYỆT (trang ở localhost:5174)
  ① OPTIONS /api/auth/login   Origin: http://localhost:5174
  ② Server trả: Access-Control-Allow-Origin: http://localhost:5174
       ├─ khớp      → trình duyệt gửi tiếp POST thật
       └─ không có  → trình duyệt CHẶN, JS nhận lỗi CORS
```

### 2.7. Security là một dãy "trạm gác" trước Controller

```
Request ──▶ [CorsFilter] ──▶ [JwtAuthenticationFilter] ──▶ ... ──▶ [Kiểm tra quyền] ──▶ Controller
                                                                        │
                                                      không đủ quyền → dừng, trả 401
```

`SecurityFilterChain` trong `SecurityConfig` là chỗ cấu hình dãy trạm gác này.

---

## 3. Flow 1 – Đăng ký

`POST /api/auth/register` tạo user mới và trả luôn 2 token (đăng ký xong coi như đã đăng nhập).

```
FE  POST /api/auth/register  { email, password, displayName }
 │
 ├─ JwtAuthenticationFilter   không có header Bearer → cho đi tiếp như khách
 ├─ SecurityConfig            /api/auth/** là permitAll → cho qua
 ├─ AuthController.register   @Valid kiểm tra RegisterRequest ── sai → 400
 └─ AuthServiceImpl.register
      1. email = trim().toLowerCase()
      2. existsByEmail(email) ── đã có → 409 "Email đã được sử dụng"
      3. new UserEntity, setPasswordHash(passwordEncoder.encode(password))
      4. user = userRepository.save(user)      ← sau dòng này user mới có id
      5. createAuthResponse(user)              ← tạo access + refresh token
FE  ◀── 200 { accessToken, refreshToken, user }
```

| Hàm / annotation | Làm gì | Vì sao |
| --- | --- | --- |
| `@Valid @RequestBody RegisterRequest` | Đọc JSON thành DTO rồi kiểm tra `@NotBlank`, `@Email`, `@Size`, `@Pattern` | Thiếu `@Valid` thì mọi luật validate bị bỏ qua |
| Luật mật khẩu | 8–72 ký tự, ít nhất 1 chữ và 1 số | Excel TSK-06. Tối đa 72 vì BCrypt chỉ dùng 72 byte đầu |
| `trim().toLowerCase()` | Chuẩn hóa email | `Tho@gmail.com` và `tho@gmail.com` là một người |
| `existsByEmail` trước `encode` | Kiểm tra trùng trước | BCrypt chậm, email đã trùng thì encode là phí |
| `throw new ResponseStatusException(CONFLICT, ...)` | Dừng hàm, trả 409 | `GlobalExceptionHandler` đổi thành JSON có message |
| `user = userRepository.save(user)` | Lưu DB, lấy bản có id | Token cần id làm `subject`. Gán lại `user =` cho thành thói quen (khi update, `save` có thể trả object khác) |
| `role` không set | Dùng mặc định `USER` của entity | FE gửi kèm `"role":"ADMIN"` cũng bị bỏ qua vì DTO không có field đó |
| `new UserResponse(user)` | Chép từng field cần trả | Không chép `passwordHash` nên JSON không thể lộ nó |

---

## 4. Flow 2 – Đăng nhập

`POST /api/auth/login` kiểm tra email + mật khẩu, đúng thì trả 2 token, sai thì 401 với **cùng một câu** báo lỗi.

```
FE  POST /api/auth/login  { email, password }
 │
 ├─ SecurityConfig          /api/auth/** là permitAll → cho qua
 ├─ AuthController.login    @Valid: chỉ kiểm tra không rỗng ── sai → 400
 └─ AuthServiceImpl.login
      1. email = trim().toLowerCase()
      2. found = findByEmail(email) ── rỗng ───────────────────┐
      3. passwordEncoder.matches(password, hash) ── sai ───────┤→ 401 "Email hoặc mật khẩu không đúng"
      4. createAuthResponse(user)
FE  ◀── 200 { accessToken, refreshToken, user }
```

- **`Optional<UserEntity>`**: `findByEmail` có thể không tìm thấy. Kiểm tra `found.isEmpty()` trước, chắc chắn có rồi mới `found.get()`.
- **`matches()` thay vì `encode().equals()`**: xem mục 2.3.
- **Cùng một câu cho sai email và sai mật khẩu** (hằng số `WRONG_LOGIN_MESSAGE`): nếu báo riêng "email không tồn tại", kẻ gian dò được email nào đã có tài khoản (*user enumeration*).
- **`LoginRequest` không kiểm tra độ dài mật khẩu**: báo "mật khẩu phải ≥ 8 ký tự" ở màn login là gợi ý luật cho kẻ dò mật khẩu.
- **`createAuthResponse(user)`** (private): tạo access token + refresh token + `UserResponse`. Dùng chung cho register, login, refresh.

---

## 5. Flow 3 – Gọi API có token

Mọi API ngoài `/api/auth/**` đều cần access token. `JwtAuthenticationFilter` đọc token ở mỗi request; token hợp lệ thì ghi user vào `SecurityContext`. **Quyết định cho vào hay trả 401 là việc của luật trong `SecurityConfig`**, filter không tự trả 401.

FE gửi token trong header:

```
GET /api/hello
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOi...
```

```
Request
  │
  ▼
JwtAuthenticationFilter
  ├─ không có "Bearer ..."            → không ghi gì ─────────────┐
  ├─ parseToken lỗi (sai/hết hạn)     → không ghi gì ─────────────┤
  ├─ type != "access" (refresh token) → không ghi gì ─────────────┤
  └─ hợp lệ → SecurityContext = (userId, ROLE_USER) ──┐           │
                                                      ▼           ▼
                              SecurityConfig: anyRequest().authenticated()
                                      ├─ context có user → Controller (@AuthenticationPrincipal UUID userId)
                                      └─ context trống   → authenticationEntryPoint → 401 JSON
```

### `JwtAuthenticationFilter.doFilterInternal` từng bước

1. `request.getHeader("Authorization")` lấy header.
2. Không có header hoặc không bắt đầu bằng `"Bearer "` → `filterChain.doFilter(...)` cho đi tiếp **như khách**, rồi `return`.
3. `header.substring(7)` cắt bỏ `"Bearer "` (7 ký tự) để lấy token.
4. `jwtTokenProvider.parseToken(token)` kiểm tra chữ ký + hạn dùng. Sai → ném `JwtException`, nhảy xuống `catch`, không ghi gì.
5. Chỉ nhận token có `type = access`. Refresh token (sống 7 ngày) không được dùng để gọi API.
6. Tạo "thẻ ra vào" `new UsernamePasswordAuthenticationToken(userId, null, authorities)`: principal là `userId`, không cần mật khẩu (`null`), kèm quyền `ROLE_USER`.
7. `SecurityContextHolder.getContext().setAuthentication(...)` ghi thẻ vào context. Từ giờ tới hết request, Spring biết đây là user nào.
8. Luôn gọi `filterChain.doFilter(...)` để request đi tiếp.

### Controller lấy user hiện tại

```java
@GetMapping("/api/hello")
public String hello(@AuthenticationPrincipal UUID userId) {
    return "... Xin chào user " + userId;
}
```

**Không bao giờ nhận `userId` từ body hay URL** cho thao tác của chính mình (sửa profile, kết thúc session...). Client có thể giả mạo; luôn lấy từ `@AuthenticationPrincipal`.

### Đăng ký filter

```java
http.addFilterBefore(new JwtAuthenticationFilter(jwtTokenProvider), UsernamePasswordAuthenticationFilter.class);
```

Filter **không** gắn `@Component`: Spring Boot tự đăng ký mọi filter là bean thêm một lần nữa, khiến nó chạy hai lần. `OncePerRequestFilter` đảm bảo mỗi request chỉ chạy filter một lần.

---

## 6. Flow 4 – Refresh token

Access token sống **30 phút**. Hết hạn thì FE nhận 401, gọi `POST /api/auth/refresh` với refresh token (sống **7 ngày**) để lấy cặp token mới mà không bắt người dùng nhập lại mật khẩu.

```
FE  GET /api/rooms  + access token đã hết hạn  ──▶  401
FE  POST /api/auth/refresh  { refreshToken }
 └─ AuthServiceImpl.refresh
      1. parseToken(refreshToken) ── sai chữ ký / quá 7 ngày ──┐
      2. claims.type == "refresh"? ── không ────────────────────┤→ 401 "...vui lòng đăng nhập lại"
      3. findById(userId) ── user đã bị xóa ────────────────────┘
      4. createAuthResponse(user)   ← access mới 30 phút + refresh mới 7 ngày
FE  ◀── 200 { accessToken, refreshToken, user }
FE  gửi lại GET /api/rooms với access token mới
```

- **Vì sao cần 2 loại token?** Access token gửi kèm mọi request nên dễ lộ; cho nó sống ngắn để lộ cũng chỉ dùng được tối đa 30 phút. Refresh token chỉ gửi tới một endpoint nên ít lộ hơn, sống lâu để người dùng không phải đăng nhập lại liên tục.
- **Claim `type` chặn dùng lẫn hai chiều**: filter chỉ nhận `access` (Flow 3, bước 5), `refresh()` chỉ nhận `refresh` (bước 2).
- **Đọc lại user từ DB** (bước 3): token mới mang email/role mới nhất, và user đã bị xóa thì không xin được token mới.
- **Refresh token không lưu DB**: nó cũng là JWT, chỉ khác hạn dùng và `type`. Đơn giản, nhưng không thu hồi được (xem mục 11).
- Phía FE (TSK-08 của Phong): interceptor bắt 401, tự gọi refresh rồi gửi lại request; refresh cũng 401 thì đưa người dùng về `/login`.

---

## 7. Xử lý lỗi

Mọi lỗi trả về cùng format, FE chỉ cần đọc `message`:

```json
{ "status": 409, "message": "Email đã được sử dụng" }
```

Lỗi được xử lý ở **hai tầng** khác nhau:

```
Request ─▶ [Security filters] ──────────▶ Controller ─▶ Service
              │                                       │
              │ 401: chưa đăng nhập                   │ 400 / 401 / 409: exception ném ra
              ▼                                       ▼
   SecurityConfig.authenticationEntryPoint     GlobalExceptionHandler
   (viết tay chuỗi JSON)                       (@RestControllerAdvice)
```

Lỗi 401 "chưa đăng nhập" bị chặn ở tầng Security, **trước** khi tới controller, nên `GlobalExceptionHandler` không bao giờ thấy nó.

| Tình huống | Mã | Message | Xử lý ở đâu |
| --- | --- | --- | --- |
| Gọi API cần đăng nhập, thiếu/sai/hết hạn token | 401 | Bạn chưa đăng nhập hoặc token không hợp lệ | `SecurityConfig` |
| Validate DTO sai (`@Valid`) | 400 | Message của lỗi đầu tiên, ví dụ "Mật khẩu phải có ít nhất 1 chữ số" | `handleValidation` |
| Body không phải JSON hợp lệ | 400 | Dữ liệu gửi lên không đúng định dạng JSON | `handleBadJson` |
| Email đăng ký đã tồn tại | 409 | Email đã được sử dụng | `handleResponseStatus` |
| Login sai email hoặc mật khẩu | 401 | Email hoặc mật khẩu không đúng | `handleResponseStatus` |
| Refresh token sai / hết hạn / sai loại | 401 | Refresh token không hợp lệ hoặc đã hết hạn, vui lòng đăng nhập lại | `handleResponseStatus` |

- Trong service, lỗi "đoán trước được" luôn ném `ResponseStatusException(HttpStatus.XXX, "message")`. Ném `RuntimeException` thường sẽ thành **500**, không có message.
- `/error` được `permitAll`: Spring chuyển lỗi nội bộ sang `/error`, không mở thì mọi lỗi của khách chưa đăng nhập đều biến thành 401.
- `GlobalExceptionHandler` hiện là bản tối thiểu. Bản đầy đủ (404, 403, 500 giấu stack trace) thuộc TSK-33.

---

## 8. Hợp đồng API cho FE

Ba endpoint auth đều công khai, trả cùng dạng `AuthResponse`. Base URL local: `http://localhost:8080`.

| Endpoint | Body gửi lên | Thành công | Lỗi có thể gặp |
| --- | --- | --- | --- |
| `POST /api/auth/register` | `{ email, password, displayName }` | 200 + `AuthResponse` | 400 validate, 409 email trùng |
| `POST /api/auth/login` | `{ email, password }` | 200 + `AuthResponse` | 400 thiếu field, 401 sai email/mật khẩu |
| `POST /api/auth/refresh` | `{ refreshToken }` | 200 + `AuthResponse` (cặp token mới) | 400 thiếu field, 401 token sai/hết hạn |

`AuthResponse` mẫu:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": "e102d844-8c88-48a9-b76e-a120d461367a",
    "email": "tho@example.com",
    "displayName": "Tho",
    "avatarKey": null,
    "role": "USER"
  }
}
```

FE cần biết:

- Gọi API cần đăng nhập: gửi header `Authorization: Bearer <accessToken>`.
- Field form đăng ký phải tên là `displayName` (form hiện tại đang là `name`). `confirmPassword`, `agreeTerms` FE tự kiểm tra, không gửi lên.
- Lỗi luôn có dạng `{ status, message }`: hiện `message` vào ô báo lỗi.
- CORS đã mở cho `http://localhost:5174`. Header FE được gửi: `Authorization`, `Content-Type`. Origin khác bị từ chối (preflight trả 403).
- `openapi.yaml` của Tiên chưa khớp: thiếu prefix `/api`, thiếu `/refresh`, và `AuthResponse` đang ghi `{ user, token }`. Bảng trên là bản đúng theo code.

### Thử nhanh bằng curl

```bash
# Đăng ký
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"tho@example.com","password":"abc12345","displayName":"Tho"}'

# Gọi API cần đăng nhập (thay <AT> bằng accessToken vừa nhận)
curl http://localhost:8080/api/hello -H "Authorization: Bearer <AT>"

# Đổi refresh token lấy cặp token mới
curl -X POST http://localhost:8080/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<RT>"}'
```

---

## 9. Cấu hình và biến môi trường

Cú pháp `${TEN_BIEN:mac_dinh}` trong `application.yml`: đọc biến môi trường, không có thì dùng mặc định (chỉ hợp cho local).

```yaml
jwt:
  secret: ${JWT_SECRET:focoya-local-dev-secret-key-do-not-use-in-production}
  access-token-minutes: 30
  refresh-token-days: 7

cors:
  allowed-origin: ${CORS_ALLOWED_ORIGIN:http://localhost:5174}
```

| Key | Biến môi trường | Mặc định | Ghi chú |
| --- | --- | --- | --- |
| `jwt.secret` | `JWT_SECRET` | chuỗi dev 54 ký tự | Phải ≥ 32 ký tự (HMAC-SHA256 cần khóa 256 bit), ngắn hơn thì app không khởi động. Lên server thật **bắt buộc** đặt |
| `jwt.access-token-minutes` | – | 30 | Excel cho phép 15–60 |
| `jwt.refresh-token-days` | – | 7 | Theo Excel |
| `cors.allowed-origin` | `CORS_ALLOWED_ORIGIN` | `http://localhost:5174` | Deploy thì đổi thành domain FE thật |

- **Lộ `JWT_SECRET`** = ai cũng tự tạo được token hợp lệ cho bất kỳ user nào (đặt `sub` là id người khác, hoặc `role` là ADMIN). Xử lý: đổi secret ngay, mọi token cũ lập tức vô hiệu, ai cũng phải đăng nhập lại.
- Thuật toán ký được chỉ định rõ `Jwts.SIG.HS256`. Bỏ trống thì jjwt tự chọn theo độ dài khóa (secret 54 byte sẽ ra HS384), sai yêu cầu Excel.
- Thư viện: `io.jsonwebtoken:jjwt-api` 0.12.6 (code gọi trực tiếp), `jjwt-impl` và `jjwt-jackson` (scope runtime).

---

## 10. Câu hỏi vấn đáp hay gặp

| Câu hỏi | Trả lời ngắn |
| --- | --- |
| Vì sao tắt CSRF mà vẫn an toàn? | CSRF lợi dụng cookie trình duyệt tự gửi. Nhóm gửi JWT trong header `Authorization`, trình duyệt không tự gắn nên không bị CSRF |
| Stateless là gì? | Server không giữ session. Mỗi request tự mang token chứng minh danh tính |
| Server không lưu token, sao biết token thật? | Tự ký lại header + payload bằng secret, so với chữ ký đi kèm; rồi kiểm tra `exp` |
| Payload JWT có bị mã hóa không? | Không, chỉ base64. Ký chống sửa, không chống đọc, nên không để thông tin nhạy cảm trong token |
| BCrypt so mật khẩu thế nào khi không giải mã được? | Salt lưu trong chuỗi hash. `matches()` lấy salt ra, hash lại mật khẩu vừa nhập rồi so |
| Vì sao cần access + refresh token? | Access sống ngắn (30 phút) để lộ cũng ít hại; refresh sống lâu (7 ngày) để khỏi đăng nhập lại. Claim `type` chặn dùng lẫn |
| Thứ tự `requestMatchers` quan trọng vì sao? | Spring dùng luật khớp đầu tiên. `anyRequest()` phải nằm cuối; đặt đầu thì không ai gọi được login (Spring 6 còn không cho app khởi động) |
| Vì sao không nhận/trả thẳng Entity? | Nhận: FE có thể gửi thêm `role`, `id`. Trả: lộ `passwordHash`. DTO chỉ có field được phép |
| `UserRepository` là interface, sao chạy được? | Spring Data JPA tự tạo class cài đặt lúc chạy và sinh SQL từ tên hàm (`findByEmail`). Sai tên field thì lỗi ngay lúc khởi động |
| Vì sao sai email và sai mật khẩu báo cùng câu? | Chống user enumeration: không cho kẻ gian biết email nào đã có tài khoản |
| CORS là gì, sao Postman không bị? | Trình duyệt chặn JS đọc response từ origin khác nếu server không trả `Access-Control-Allow-Origin`. Postman không phải trình duyệt |
| 401 xử lý ở đâu, sao không nằm trong `GlobalExceptionHandler`? | Bị chặn ở tầng Security trước controller, nên viết trong `authenticationEntryPoint` của `SecurityConfig` |
| Controller lấy user hiện tại thế nào? | `@AuthenticationPrincipal UUID userId`, do filter ghi vào `SecurityContext`. Không tin `userId` từ client |
| Dependency injection qua constructor là gì? | Class khai báo cần gì trong constructor, Spring tạo sẵn và truyền vào; class không tự `new` |
| Vì sao có `/api` trong URL? | Khi deploy chung domain, reverse proxy chia request theo path: `/api/*` đi backend, còn lại đi React. Luật Security cũng gọn hơn |
| `@Valid` để làm gì? | Bật kiểm tra các annotation trong DTO. Thiếu thì validate không chạy; sai thì Spring trả 400 trước khi vào service |

---

## 11. Giới hạn hiện tại và việc còn lại

**Giới hạn (chấp nhận được cho đồ án):**

- **Logout không thu hồi được token.** Refresh token không lưu DB, nên logout chỉ là FE xóa token. Token cũ vẫn dùng được tới khi hết hạn (access 30 phút, refresh 7 ngày). Muốn thu hồi thật phải lưu refresh token vào DB.
- **Validate chỉ trả lỗi đầu tiên.** Form có nhiều field sai thì sửa xong một lỗi mới thấy lỗi tiếp theo.
- **Hai người đăng ký cùng email đúng cùng lúc** có thể lọt qua `existsByEmail`; khi đó cột `email` unique trong DB chặn lại nhưng trả 500 thay vì 409. Rất hiếm, để TSK-33 xử lý.
- **Chưa có test tự động cho controller** (register/login/refresh qua HTTP). Hiện mới có unit test cho `JwtTokenProvider` và test bằng curl. Thuộc TSK-33.

**Việc còn lại / cần chốt:**

- [ ] Báo Tiên sửa `openapi.yaml` cho khớp mục 8 (prefix `/api`, `/refresh`, `AuthResponse`).
- [ ] Báo Thảo đổi field `name` → `displayName`, và Phong (TSK-08) về luồng refresh.
- [ ] Chốt với Tiên: đăng ký có tạo luôn `GamificationProfile` (XP = 0) không.
- [ ] `GlobalExceptionHandler` bản đầy đủ (TSK-33).
- [ ] Thêm Swagger UI (springdoc) khi có nhiều controller.
