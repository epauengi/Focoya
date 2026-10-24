package com.lofi.studyroombackend.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class TestController {

    // Cần đăng nhập. @AuthenticationPrincipal lấy userId mà JwtAuthenticationFilter đã ghi vào SecurityContext.
    @GetMapping("/api/hello")
    public String hello(@AuthenticationPrincipal UUID userId) {
        return "Lo-fi Study Room API đang chạy! Xin chào user " + userId;
    }
}
