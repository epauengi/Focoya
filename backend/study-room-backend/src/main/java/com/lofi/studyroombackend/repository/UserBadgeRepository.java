package com.lofi.studyroombackend.repository;

import com.lofi.studyroombackend.entity.UserBadgeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UserBadgeRepository extends JpaRepository<UserBadgeEntity, UUID> {

    // SELECT COUNT(*) FROM user_badges WHERE user_id = ?  -> số badge user đã mở khóa.
    long countByUserId(UUID userId);
}
