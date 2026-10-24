# Focoya — Không Gian Học Tập Trực Tuyến
> Đề tài thực hành môn học SE347 - Công nghệ Web & Ứng dụng (UIT)  
> Module: Explore Rooms (TSK-11) + Room Preview & Focus Mode (TSK-14)

---

## 📌 Hướng dẫn khởi chạy
- Mở trực tiếp file `index.html` trên bất kỳ trình duyệt web nào (Chrome, Edge, Firefox, Safari).
- Không yêu cầu cài đặt môi trường build hay thư viện ngoài (Vanilla JS, HTML5, CSS3 thuần).

---

## 🧭 Cấu trúc điều hướng (Routing)
Hệ thống sử dụng Hash Routing trực tiếp trên trình duyệt:
- `#/`: Trang khám phá danh sách các phòng học (Explore Rooms).
- `#/rooms/:id`: Xem trước thông tin chi tiết phòng học (Room Preview).
- `#/room/:id`: Không gian phòng học tập trung (Focus Room - đồng hồ thực tế, Pomodoro, danh sách task).
- `#/my-rooms`: Phòng học cá nhân.
- `#/login`: Modal đăng nhập tài khoản.

---

## 📂 Cấu trúc thư mục dự án
```text
├── assets/         # Hình ảnh nền, icon SVG trích xuất từ thiết kế Figma
├── css/
│   └── styles.css  # Toàn bộ mã nguồn CSS (Giao diện chuẩn, bố cục Responsive)
├── data/
│   └── rooms.js    # Dữ liệu giả lập danh sách phòng học (Mock Data)
├── js/
│   ├── app.js      # Logic lọc, tìm kiếm, điều hướng route & bộ đếm Pomodoro
│   └── ui.js       # Xử lý tương tác giao diện, Dropdown Menu, Modal Cài đặt & Đăng nhập
├── index.html      # Khung xương HTML chính của ứng dụng
└── README.md       # Tài liệu hướng dẫn đồ án
```

---

## ✨ Các tính năng đã hoàn thiện
1. **Explore Rooms**:
   - Tìm kiếm phòng theo tên tức thì.
   - Lọc danh mục theo chủ đề (*Study, Café, Nature, Gaming, Chill*).
   - Hiệu ứng Skeleton Loading chân thực khi tải dữ liệu.
2. **Room Preview**:
   - Hiển thị ảnh bìa động, số lượng thành viên đang trực tuyến và số chỗ còn trống.
   - Nút hành động vào phòng học.
3. **Focus Room**:
   - Đồng hồ thời gian thực kèm lời chào thay đổi theo buổi trong ngày.
   - Bộ đếm thời gian kỹ thuật Pomodoro (*25p Tập trung, 5p Nghỉ ngắn, 15p Nghỉ dài*).
   - Quản lý danh sách nhiệm vụ cần làm (Todo List: thêm, check hoàn thành, xóa).
   - Chế độ toàn màn hình (Fullscreen).
4. **Cài đặt & Tài khoản**:
   - Thay đổi hình nền phòng học trực tiếp.
   - Bảng theo dõi chuỗi ngày học tập và bản đồ nhiệt tập trung theo giờ (Heatmap).
   - Hướng dẫn và câu hỏi thường gặp (FAQ).
