package com.lofi.studyroombackend.dto.response;

import lombok.Getter;

// Format lỗi chung của backend: { "status": 409, "message": "Email đã được sử dụng" }
// Giống format lỗi 401 trong SecurityConfig, để FE chỉ cần đọc field "message".
@Getter
public class ErrorResponse {

    private int status;
    private String message;

    public ErrorResponse(int status, String message) {
        this.status = status;
        this.message = message;
    }
}
