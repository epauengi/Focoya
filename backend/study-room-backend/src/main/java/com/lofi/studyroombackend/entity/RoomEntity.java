package com.lofi.studyroombackend.entity;

import com.lofi.studyroombackend.entity.enums.RoomVisibility;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "rooms")
@Getter
@Setter
@NoArgsConstructor
public class RoomEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // NULL với public room seed sẵn.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private UserEntity owner;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "theme_key", nullable = false, length = 50)
    private String themeKey;

    @Column(name = "scene_key", length = 50)
    private String sceneKey;

    @Column(name = "ambient_track_key", length = 50)
    private String ambientTrackKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private RoomVisibility visibility;

    @Column(name = "invite_code", unique = true, length = 6)
    private String inviteCode;

    @Column(name = "max_slots", nullable = false)
    private int maxSlots;

    // Không xóa cứng room, chỉ tắt active để lịch sử study_sessions vẫn trỏ tới được.
    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
