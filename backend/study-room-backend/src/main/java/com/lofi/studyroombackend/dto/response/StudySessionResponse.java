package com.lofi.studyroombackend.dto.response;

import com.lofi.studyroombackend.entity.StudySessionEntity;
import lombok.Getter;

import java.time.Instant;
import java.util.UUID;

// Một phiên học trả cho FE. Tên field giống schema StudySession trong openapi.yaml.
@Getter
public class StudySessionResponse {

    private UUID id;
    private UUID userId;
    private UUID roomId;
    private String status;            // IN_PROGRESS, COMPLETED hoặc CANCELLED
    private Instant startedAt;        // giờ server lúc bấm start, FE dùng để tự đếm ngược
    private Instant endedAt;          // null khi phiên đang chạy
    private Integer durationMinutes;  // null khi phiên đang chạy
    private int xpEarned;             // 0 nếu phiên đang chạy hoặc bị hủy

    public StudySessionResponse(StudySessionEntity session) {
        this.id = session.getId();
        this.userId = session.getUser().getId();
        this.roomId = session.getRoom().getId();
        this.status = session.getStatus().name();
        this.startedAt = session.getStartedAt();
        this.endedAt = session.getEndedAt();
        this.durationMinutes = session.getDurationMinutes();
        this.xpEarned = session.getXpEarned();
    }
}
