package com.lofi.studyroombackend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Check;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

// XP / streak của 1 user (quan hệ 1-1). Level không lưu, tính từ totalXp.
@Entity
@Table(name = "gamification_profiles")
@Check(name = "chk_gp_total_xp", constraints = "total_xp >= 0")
@Check(name = "chk_gp_streak", constraints = "current_streak >= 0 AND longest_streak >= 0")
@Getter
@Setter
@NoArgsConstructor
public class GamificationProfileEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // unique = true biến quan hệ thành 1-1. Xóa user thì DB tự xóa profile.
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private UserEntity user;

    @Column(name = "total_xp", nullable = false)
    private int totalXp = 0;

    @Column(name = "current_streak", nullable = false)
    private int currentStreak = 0;

    @Column(name = "longest_streak", nullable = false)
    private int longestStreak = 0;

    @Column(name = "last_study_date")
    private LocalDate lastStudyDate;

    @Column(name = "daily_goal_minutes", nullable = false)
    private int dailyGoalMinutes = 60;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
