package com.lofi.studyroombackend.service;

import com.lofi.studyroombackend.dto.request.UpdateProfileRequest;
import com.lofi.studyroombackend.dto.response.PublicUserResponse;
import com.lofi.studyroombackend.dto.response.UserProfileResponse;
import com.lofi.studyroombackend.entity.GamificationProfileEntity;
import com.lofi.studyroombackend.entity.UserEntity;
import com.lofi.studyroombackend.entity.enums.StudySessionStatus;
import com.lofi.studyroombackend.repository.GamificationProfileRepository;
import com.lofi.studyroombackend.repository.StudySessionRepository;
import com.lofi.studyroombackend.repository.UserBadgeRepository;
import com.lofi.studyroombackend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.UUID;

@Service
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final GamificationProfileRepository gamificationProfileRepository;
    private final StudySessionRepository studySessionRepository;
    private final UserBadgeRepository userBadgeRepository;

    public UserServiceImpl(UserRepository userRepository,
                           GamificationProfileRepository gamificationProfileRepository,
                           StudySessionRepository studySessionRepository,
                           UserBadgeRepository userBadgeRepository) {
        this.userRepository = userRepository;
        this.gamificationProfileRepository = gamificationProfileRepository;
        this.studySessionRepository = studySessionRepository;
        this.userBadgeRepository = userBadgeRepository;
    }

    // currentUserId lấy từ JWT, không nhận từ client -> không ai xem/sửa nhầm hồ sơ người khác qua /me.
    @Override
    public UserProfileResponse getMyProfile(UUID currentUserId) {
        UserEntity user = findCurrentUser(currentUserId);
        return toProfileResponse(user);
    }

    @Override
    public UserProfileResponse updateMyProfile(UUID currentUserId, UpdateProfileRequest request) {
        UserEntity user = findCurrentUser(currentUserId);

        // Chỉ sửa 3 field này. Chuỗi rỗng/toàn khoảng trắng ở bio, avatarKey -> lưu null.
        user.setDisplayName(request.getDisplayName().trim());
        user.setBio(trimToNull(request.getBio()));
        user.setAvatarKey(trimToNull(request.getAvatarKey()));

        // save() với entity đã có id -> UPDATE. Trả về bản ghi mới (Excel: "trả về bản ghi mới").
        user = userRepository.save(user);
        return toProfileResponse(user);
    }

    @Override
    public PublicUserResponse getPublicProfile(UUID userId) {
        Optional<UserEntity> found = userRepository.findById(userId);
        if (found.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng");
        }
        UserEntity user = found.get();

        int totalXp = 0;
        Optional<GamificationProfileEntity> profile = gamificationProfileRepository.findByUserId(userId);
        if (profile.isPresent()) {
            totalXp = profile.get().getTotalXp();
        }

        return new PublicUserResponse(user, calculateLevel(totalXp),
                calculateTotalStudyHours(userId), userBadgeRepository.countByUserId(userId));
    }

    // Token hợp lệ nhưng user đã bị xóa khỏi DB -> coi như chưa đăng nhập.
    private UserEntity findCurrentUser(UUID currentUserId) {
        Optional<UserEntity> found = userRepository.findById(currentUserId);
        if (found.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tài khoản không còn tồn tại");
        }
        return found.get();
    }

    private UserProfileResponse toProfileResponse(UserEntity user) {
        // User chưa có GamificationProfile (vd mới đăng ký) -> coi như XP = 0, streak = 0.
        int totalXp = 0;
        int currentStreak = 0;
        int longestStreak = 0;
        Optional<GamificationProfileEntity> profile = gamificationProfileRepository.findByUserId(user.getId());
        if (profile.isPresent()) {
            totalXp = profile.get().getTotalXp();
            currentStreak = profile.get().getCurrentStreak();
            longestStreak = profile.get().getLongestStreak();
        }

        return new UserProfileResponse(user, totalXp, calculateLevel(totalXp), currentStreak, longestStreak,
                calculateTotalStudyHours(user.getId()), userBadgeRepository.countByUserId(user.getId()));
    }

    // Công thức đã chốt: Level = floor(sqrt(xp / 100)) + 1. Không lưu DB, lần nào cần thì tính lại từ totalXp.
    // Ví dụ: 0 XP -> Lv1, 100 XP -> Lv2, 400 XP -> Lv3, 900 XP -> Lv4.
    // Khi Tiên làm phần gamification (TSK-25) thì chuyển hàm này sang đó để dùng chung.
    private int calculateLevel(int totalXp) {
        return (int) Math.floor(Math.sqrt(totalXp / 100.0)) + 1;
    }

    // Tổng phút của các session đã hoàn thành, đổi ra giờ, làm tròn 1 chữ số thập phân. Ví dụ 95 phút -> 1.6 giờ.
    private double calculateTotalStudyHours(UUID userId) {
        long minutes = studySessionRepository.sumDurationMinutes(userId, StudySessionStatus.COMPLETED);
        return Math.round(minutes / 6.0) / 10.0;
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
