package com.lofi.studyroombackend.service;

import com.lofi.studyroombackend.dto.request.StartStudySessionRequest;
import com.lofi.studyroombackend.dto.response.StudySessionResponse;

import java.util.UUID;

public interface StudySessionService {

    // Bắt đầu một phiên học trong phòng. Phiên cũ chưa kết thúc (nếu có) được chốt trước.
    StudySessionResponse start(StartStudySessionRequest request, UUID currentUserId);

    // Chốt phiên đang chạy của user: server tự tính thời lượng và XP.
    StudySessionResponse finish(UUID currentUserId);
}
