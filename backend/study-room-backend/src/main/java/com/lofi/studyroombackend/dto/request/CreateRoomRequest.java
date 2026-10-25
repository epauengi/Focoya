package com.lofi.studyroombackend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

// Body của POST /api/rooms (tạo phòng riêng).
// Không có field visibility: trong MVP user chỉ được tạo phòng PRIVATE (Excel TSK-12), phòng PUBLIC do DataSeeder tạo.
@Getter
@Setter
public class CreateRoomRequest {

    @NotBlank(message = "Tên phòng không được để trống")
    @Size(max = 100, message = "Tên phòng tối đa 100 ký tự")
    private String name;

    @Size(max = 500, message = "Mô tả tối đa 500 ký tự")
    private String description;

    // Đúng danh sách THEMES của FE (bỏ "All Rooms" vì đó là bộ lọc, không phải theme).
    @NotBlank(message = "Theme không được để trống")
    @Pattern(regexp = "Study|Café|Nature|Gaming|Chill", message = "Theme phải là Study, Café, Nature, Gaming hoặc Chill")
    private String theme;

    // Không bắt buộc. Nếu gửi thì phải là ảnh có sẵn trong FE (thư mục public/room-assets), không nhận link ngoài.
    @Pattern(regexp = "/room-assets/[A-Za-z0-9._-]+", message = "Ảnh phải là file trong /room-assets/")
    @Size(max = 50, message = "Đường dẫn ảnh tối đa 50 ký tự")
    private String image;

    // Integer (không phải int) để thiếu field thì là null -> @NotNull báo lỗi, thay vì im lặng thành 0.
    @NotNull(message = "Số chỗ không được để trống")
    @Min(value = 10, message = "Phòng riêng tối thiểu 10 chỗ")
    @Max(value = 30, message = "Phòng riêng tối đa 30 chỗ")
    private Integer maxSlots;
}
