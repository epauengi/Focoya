package com.lofi.studyroombackend.repository;

import com.lofi.studyroombackend.entity.RoomEntity;
import com.lofi.studyroombackend.entity.enums.RoomVisibility;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoomRepository extends JpaRepository<RoomEntity, UUID> {

    // Trang Explore: các phòng đang mở, lọc theo theme và tìm theo tên (không phân biệt hoa thường).
    // Service luôn truyền chuỗi (không truyền null): theme = "" nghĩa là mọi theme, q = "" khớp mọi tên (LIKE '%%').
    // Viết JPQL (dùng tên class/field Java, không phải tên bảng/cột). Tham số :q được bind riêng nên không bị SQL injection.
    @Query("""
            SELECT r FROM RoomEntity r
            WHERE r.visibility = :visibility
              AND r.active = true
              AND (:theme = '' OR r.themeKey = :theme)
              AND LOWER(r.name) LIKE LOWER(CONCAT('%', :q, '%'))
            ORDER BY r.createdAt, r.name""")
    List<RoomEntity> searchActiveRooms(@Param("visibility") RoomVisibility visibility,
                                       @Param("theme") String theme,
                                       @Param("q") String q);

    // Vào phòng riêng bằng mã mời: SELECT * FROM rooms WHERE invite_code = ?
    Optional<RoomEntity> findByInviteCode(String inviteCode);

    // Sinh mã mời xong phải kiểm tra chưa phòng nào dùng.
    boolean existsByInviteCode(String inviteCode);

    // Đếm phòng đang mở của 1 user theo visibility (owner.id = ? AND visibility = ? AND is_active = true) -> giới hạn tối đa 2 phòng riêng.
    long countByOwnerIdAndVisibilityAndActiveTrue(UUID ownerId, RoomVisibility visibility);

    // Giữ lại để tương thích nếu có chỗ dùng chung theo owner + active.
    long countByOwnerIdAndActiveTrue(UUID ownerId);

    // Danh sách phòng riêng đang mở của chính user, thứ tự xác định.
    @Query("""
            SELECT r FROM RoomEntity r
            WHERE r.owner.id = :ownerId
              AND r.visibility = :visibility
              AND r.active = true
            ORDER BY r.createdAt ASC, r.name ASC, r.id ASC""")
    List<RoomEntity> findActiveOwnedRooms(@Param("ownerId") UUID ownerId,
                                          @Param("visibility") RoomVisibility visibility);

    // DataSeeder: phòng mẫu này đã có chưa (chống seed trùng khi restart).
    boolean existsByNameAndVisibility(String name, RoomVisibility visibility);
}
