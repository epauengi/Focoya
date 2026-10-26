package com.lofi.studyroombackend.controller;

import com.lofi.studyroombackend.dto.request.UpdateProfileRequest;
import com.lofi.studyroombackend.dto.response.PublicUserResponse;
import com.lofi.studyroombackend.dto.response.UserProfileResponse;
import com.lofi.studyroombackend.service.UserService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

// Mọi API ở đây đều cần đăng nhập (luật anyRequest().authenticated() trong SecurityConfig).
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    // GET /api/users/me  — hồ sơ đầy đủ của chính mình.
    @GetMapping("/me")
    public UserProfileResponse getMyProfile(@AuthenticationPrincipal UUID userId) {
        return userService.getMyProfile(userId);
    }

    // PUT /api/users/me  — sửa displayName, bio, avatarKey của chính mình.
    @PutMapping("/me")
    public UserProfileResponse updateMyProfile(@AuthenticationPrincipal UUID userId,
                                               @Valid @RequestBody UpdateProfileRequest request) {
        return userService.updateMyProfile(userId, request);
    }

    // GET /api/users/{userId}  — hồ sơ công khai của người khác.
    // "/me" là chữ cố định nên Spring ưu tiên nó hơn "/{userId}", không bị nhầm.
    @GetMapping("/{userId}")
    public PublicUserResponse getPublicProfile(@PathVariable UUID userId) {
        return userService.getPublicProfile(userId);
    }
}
