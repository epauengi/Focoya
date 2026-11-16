package com.lofi.studyroombackend.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

// Body của POST /api/study-sessions/start.
// Chỉ có roomId. KHÔNG có userId, thời lượng hay XP: user lấy từ JWT, thời gian và XP do server tự tính.
@Getter
@Setter
public class StartStudySessionRequest {

    @NotNull(message = "roomId không được để trống")
    private UUID roomId;
}
