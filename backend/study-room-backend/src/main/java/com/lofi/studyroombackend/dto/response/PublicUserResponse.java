package com.lofi.studyroombackend.dto.response;

import com.lofi.studyroombackend.entity.UserEntity;
import lombok.Getter;

import java.util.UUID;

// Hồ sơ CÔNG KHAI khi xem người khác (GET /api/users/{id}).
// Excel TSK-09: chỉ trả đúng 6 field này, không lộ email hay thông tin nhạy cảm.
@Getter
public class PublicUserResponse {

    private UUID id;
    private String displayName;
    private String avatarKey;
    private int level;
    private double totalStudyHours;
    private long badgesCount;

    public PublicUserResponse(UserEntity user, int level, double totalStudyHours, long badgesCount) {
        this.id = user.getId();
        this.displayName = user.getDisplayName();
        this.avatarKey = user.getAvatarKey();
        this.level = level;
        this.totalStudyHours = totalStudyHours;
        this.badgesCount = badgesCount;
    }
}
