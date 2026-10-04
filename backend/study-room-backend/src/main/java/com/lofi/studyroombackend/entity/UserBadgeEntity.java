package com.lofi.studyroombackend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

// Bảng nối n-n giữa user và badge. UNIQUE(user_id, badge_id) đảm bảo mỗi badge chỉ mở khóa 1 lần.
@Entity
@Table(
        name = "user_badges",
        uniqueConstraints = @UniqueConstraint(name = "uq_user_badges_user_badge", columnNames = {"user_id", "badge_id"})
)
@Getter
@Setter
@NoArgsConstructor
public class UserBadgeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "badge_id", nullable = false)
    private BadgeEntity badge;

    @CreationTimestamp
    @Column(name = "unlocked_at", nullable = false, updatable = false)
    private Instant unlockedAt;
}
