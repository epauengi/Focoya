package com.lofi.studyroombackend.event;

import lombok.Getter;

import java.util.UUID;

// "Tin báo" phát ra khi một phiên học được công nhận (COMPLETED).
// StudySessionServiceImpl phát tin này, GamificationEventListener nghe và cộng XP.
// Nhờ vậy phần lưu phiên học không cần biết XP, streak, badge được tính thế nào.
@Getter
public class StudySessionCompletedEvent {

    private final UUID sessionId;
    private final UUID userId;
    private final int durationMinutes;
    private final int xpEarned;

    public StudySessionCompletedEvent(UUID sessionId, UUID userId, int durationMinutes, int xpEarned) {
        this.sessionId = sessionId;
        this.userId = userId;
        this.durationMinutes = durationMinutes;
        this.xpEarned = xpEarned;
    }
}
