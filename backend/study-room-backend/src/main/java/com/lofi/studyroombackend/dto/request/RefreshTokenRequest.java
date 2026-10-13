package com.lofi.studyroombackend.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

// Body của POST /api/auth/refresh.
@Getter
@Setter
public class RefreshTokenRequest {

    @NotBlank(message = "Thiếu refresh token")
    private String refreshToken;
}
