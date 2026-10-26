package com.lofi.studyroombackend.repository;

import com.lofi.studyroombackend.entity.StudySessionEntity;
import com.lofi.studyroombackend.entity.enums.StudySessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface StudySessionRepository extends JpaRepository<StudySessionEntity, UUID> {

    // Tổng số phút học của 1 user, chỉ tính session có trạng thái truyền vào (thường là COMPLETED).
    // Chưa có session nào thì SUM trả NULL -> COALESCE đổi thành 0.
    @Query("""
            SELECT COALESCE(SUM(s.durationMinutes), 0L) FROM StudySessionEntity s
            WHERE s.user.id = :userId AND s.status = :status""")
    long sumDurationMinutes(@Param("userId") UUID userId, @Param("status") StudySessionStatus status);
}
