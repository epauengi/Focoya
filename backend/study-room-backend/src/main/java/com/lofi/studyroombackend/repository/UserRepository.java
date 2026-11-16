package com.lofi.studyroombackend.repository;

import com.lofi.studyroombackend.entity.UserEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

// JpaRepository<UserEntity, UUID>: làm việc với bảng users, khóa chính kiểu UUID.
// Có sẵn save, findById, findAll, deleteById... không cần viết.
public interface UserRepository extends JpaRepository<UserEntity, UUID> {

    // Spring tự sinh SQL từ tên hàm: SELECT * FROM users WHERE email = ?
    Optional<UserEntity> findByEmail(String email);

    // SELECT COUNT(*) > 0 FROM users WHERE email = ?  -> dùng khi đăng ký để chặn email trùng.
    boolean existsByEmail(String email);

    // Lấy user và KHÓA dòng đó trong DB cho tới khi transaction kết thúc (SQL: SELECT ... FOR UPDATE).
    // Request khác của cùng user gọi hàm này sẽ phải chờ. Dùng ở start/finish phiên học để hai request
    // gửi cùng lúc (bấm đúp) không tạo ra 2 phiên đang chạy hoặc cộng XP 2 lần.
    // Chỉ gọi được bên trong hàm có @Transactional.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM UserEntity u WHERE u.id = :id")
    Optional<UserEntity> findByIdForUpdate(@Param("id") UUID id);
}
