package com.lofi.studyroombackend.entity;

import com.lofi.studyroombackend.entity.enums.StudySessionStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Check;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.Instant;
import java.util.UUID;

// Mỗi lần học (1 Pomodoro) là 1 dòng.
// startedAt, endedAt, durationMinutes, xpEarned đều do SERVER điền, không nhận từ client.
// Luật "mỗi user chỉ có tối đa 1 session IN_PROGRESS" phải kiểm tra trong service (TSK-20),
// vì Hibernate không tạo được unique index có điều kiện.
@Entity
@Table(
        name = "study_sessions",
        indexes = {
                // Lịch sử học / dashboard: session của 1 user trong khoảng thời gian.
                @Index(name = "idx_ss_user_started", columnList = "user_id, started_at"),
                // Thống kê theo phòng.
                @Index(name = "idx_ss_room_id", columnList = "room_id"),
                // Leaderboard tuần: session COMPLETED kết thúc trong tuần.
                @Index(name = "idx_ss_status_ended", columnList = "status, ended_at")
        }
)
@Check(name = "chk_ss_ended", constraints = "ended_at IS NULL OR ended_at >= started_at")
@Check(name = "chk_ss_xp", constraints = "xp_earned >= 0")
@Check(name = "chk_ss_duration", constraints = "duration_minutes IS NULL OR duration_minutes >= 0")
@Getter
@Setter
@NoArgsConstructor
public class StudySessionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // Xóa user thì DB tự xóa luôn lịch sử học của user đó.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private UserEntity user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "room_id", nullable = false)
    private RoomEntity room;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StudySessionStatus status = StudySessionStatus.IN_PROGRESS;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    @Column(name = "xp_earned", nullable = false)
    private int xpEarned = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
