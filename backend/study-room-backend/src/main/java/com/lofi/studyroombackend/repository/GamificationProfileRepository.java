package com.lofi.studyroombackend.repository;

import com.lofi.studyroombackend.entity.GamificationProfileEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface GamificationProfileRepository extends JpaRepository<GamificationProfileEntity, UUID> {

    // SELECT * FROM gamification_profiles WHERE user_id = ?
    // Optional vì user mới đăng ký có thể chưa có profile (chưa chốt register có tạo luôn hay không).
    Optional<GamificationProfileEntity> findByUserId(UUID userId);
}
