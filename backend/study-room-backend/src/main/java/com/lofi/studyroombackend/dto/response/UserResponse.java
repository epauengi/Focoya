package com.lofi.studyroombackend.dto.response;

import com.lofi.studyroombackend.entity.UserEntity;
import lombok.Getter;

import java.util.UUID;

// Thông tin user trả cho FE. KHÔNG có passwordHash: đó là lý do không trả thẳng UserEntity.
@Getter
public class UserResponse {

    private UUID id;
    private String email;
    private String displayName;
    private String avatarKey;
    private String role;

    // Chép từng field cần thiết từ entity sang.
    public UserResponse(UserEntity user) {
        this.id = user.getId();
        this.email = user.getEmail();
        this.displayName = user.getDisplayName();
        this.avatarKey = user.getAvatarKey();
        this.role = user.getRole().name();
    }
}
