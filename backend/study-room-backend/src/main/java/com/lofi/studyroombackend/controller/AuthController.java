package com.lofi.studyroombackend.controller;

import com.lofi.studyroombackend.dto.request.LoginRequest;
import com.lofi.studyroombackend.dto.request.RefreshTokenRequest;
import com.lofi.studyroombackend.dto.request.RegisterRequest;
import com.lofi.studyroombackend.dto.response.AuthResponse;
import com.lofi.studyroombackend.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Controller mỏng: nhận request, giao cho service, trả kết quả. Không chứa logic.
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    // POST /api/auth/register
    // @RequestBody: đọc JSON trong body thành RegisterRequest.
    // @Valid: kiểm tra các annotation trong RegisterRequest, sai -> 400, không vào tới service.
    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    // POST /api/auth/login
    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    // POST /api/auth/refresh  — FE gọi khi access token hết hạn (nhận 401), đổi refresh token lấy cặp token mới.
    @PostMapping("/refresh")
    public AuthResponse refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return authService.refresh(request);
    }
}
