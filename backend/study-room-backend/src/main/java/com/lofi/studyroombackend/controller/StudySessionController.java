package com.lofi.studyroombackend.controller;

import com.lofi.studyroombackend.dto.request.StartStudySessionRequest;
import com.lofi.studyroombackend.dto.response.StudySessionResponse;
import com.lofi.studyroombackend.service.StudySessionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

// Phiên học (Pomodoro). Mọi API ở đây đều cần đăng nhập (luật anyRequest().authenticated() trong SecurityConfig).
// Đồng hồ đếm ngược chạy ở FE. Backend chỉ ghi lúc bắt đầu, lúc kết thúc rồi tự tính thời lượng và XP.
@RestController
@RequestMapping("/api/study-sessions")
public class StudySessionController {

    private final StudySessionService studySessionService;

    public StudySessionController(StudySessionService studySessionService) {
        this.studySessionService = studySessionService;
    }

    // POST /api/study-sessions/start  — FE gọi khi user bấm Start. Body: { "roomId": "..." }. Trả 201 Created.
    @PostMapping("/start")
    @ResponseStatus(HttpStatus.CREATED)
    public StudySessionResponse start(@Valid @RequestBody StartStudySessionRequest request,
                                      @AuthenticationPrincipal UUID userId) {
        return studySessionService.start(request, userId);
    }

    // POST /api/study-sessions/finish  — FE gọi khi hết giờ hoặc user dừng. Không có body:
    // server tự tìm phiên đang chạy của user trong JWT.
    @PostMapping("/finish")
    public StudySessionResponse finish(@AuthenticationPrincipal UUID userId) {
        return studySessionService.finish(userId);
    }
}
