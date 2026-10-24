package com.lofi.studyroombackend.service;

import com.lofi.studyroombackend.dto.request.LoginRequest;
import com.lofi.studyroombackend.dto.request.RefreshTokenRequest;
import com.lofi.studyroombackend.dto.request.RegisterRequest;
import com.lofi.studyroombackend.dto.response.AuthResponse;

// Interface: chỉ khai báo "làm được gì". Cách làm nằm trong AuthServiceImpl.
public interface AuthService {

    AuthResponse register(RegisterRequest request);

    AuthResponse login(LoginRequest request);

    AuthResponse refresh(RefreshTokenRequest request);
}
