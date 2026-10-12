package com.lofi.studyroombackend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

// Body của POST /api/auth/register. Các annotation bên dưới chỉ có tác dụng khi controller dùng @Valid.
@Getter
@Setter
public class RegisterRequest {

    @NotBlank(message = "Email không được để trống")
    @Email(message = "Email không hợp lệ")
    private String email;

    // Excel TSK-06: tối thiểu 8 ký tự, có cả chữ và số.
    // Tối đa 72 vì BCrypt chỉ xử lý được 72 byte đầu của mật khẩu.
    @NotBlank(message = "Mật khẩu không được để trống")
    @Size(min = 8, max = 72, message = "Mật khẩu phải từ 8 đến 72 ký tự")
    @Pattern(regexp = ".*[A-Za-z].*", message = "Mật khẩu phải có ít nhất 1 chữ cái")
    @Pattern(regexp = ".*[0-9].*", message = "Mật khẩu phải có ít nhất 1 chữ số")
    private String password;

    // Khớp với cột display_name (length = 50) và Excel TSK-09 (2–50 ký tự).
    @NotBlank(message = "Tên hiển thị không được để trống")
    @Size(min = 2, max = 50, message = "Tên hiển thị phải từ 2 đến 50 ký tự")
    private String displayName;
}
