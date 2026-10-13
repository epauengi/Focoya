package com.lofi.studyroombackend.dto.response;

import lombok.Getter;

// Kết quả của register / login / refresh.
// JSON trả về: { "accessToken": "...", "refreshToken": "...", "user": { "id": ..., "email": ..., ... } }
@Getter
public class AuthResponse {

    private String accessToken;
    private String refreshToken;
    private UserResponse user;

    public AuthResponse(String accessToken, String refreshToken, UserResponse user) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.user = user;
    }
}
