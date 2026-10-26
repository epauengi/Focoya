package com.lofi.studyroombackend.dto.response;

import com.lofi.studyroombackend.entity.UserEntity;
import lombok.Getter;

import java.util.UUID;

// Hồ sơ ĐẦY ĐỦ của chính mình (GET/PUT /api/users/me). Không có passwordHash.
@Getter
public class UserProfileResponse {

    private UUID id;
    private String email;
    private String displayName;
    private String avatarKey;
    private String bio;
    private String role;

    // Thống kê cơ bản. Không lưu trong bảng users, service tính/đọc từ các bảng khác rồi truyền vào.
    private int totalXp;
    private int level;
    private int currentStreak;
    private int longestStreak;
    private double totalStudyHours;
    private long badgesCount;

    public UserProfileResponse(UserEntity user, int totalXp, int level, int currentStreak,
                               int longestStreak, double totalStudyHours, long badgesCount) {
        this.id = user.getId();
        this.email = user.getEmail();
        this.displayName = user.getDisplayName();
        this.avatarKey = user.getAvatarKey();
        this.bio = user.getBio();
        this.role = user.getRole().name();
        this.totalXp = totalXp;
        this.level = level;
        this.currentStreak = currentStreak;
        this.longestStreak = longestStreak;
        this.totalStudyHours = totalStudyHours;
        this.badgesCount = badgesCount;
    }
}
