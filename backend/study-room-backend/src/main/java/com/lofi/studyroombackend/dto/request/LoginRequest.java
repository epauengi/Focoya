package com.lofi.studyroombackend.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

// Body của POST /api/auth/login.
// Không kiểm tra độ dài mật khẩu ở đây: sai thì cứ trả 401, không gợi ý gì cho kẻ dò mật khẩu.
@Getter
@Setter
public class LoginRequest {

    @NotBlank(message = "Email không được để trống")
    private String email;

    @NotBlank(message = "Mật khẩu không được để trống")
    private String password;
}
