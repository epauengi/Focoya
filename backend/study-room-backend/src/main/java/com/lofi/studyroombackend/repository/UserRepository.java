package com.lofi.studyroombackend.repository;

import com.lofi.studyroombackend.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

// JpaRepository<UserEntity, UUID>: làm việc với bảng users, khóa chính kiểu UUID.
// Có sẵn save, findById, findAll, deleteById... không cần viết.
public interface UserRepository extends JpaRepository<UserEntity, UUID> {

    // Spring tự sinh SQL từ tên hàm: SELECT * FROM users WHERE email = ?
    Optional<UserEntity> findByEmail(String email);

    // SELECT COUNT(*) > 0 FROM users WHERE email = ?  -> dùng khi đăng ký để chặn email trùng.
    boolean existsByEmail(String email);
}
