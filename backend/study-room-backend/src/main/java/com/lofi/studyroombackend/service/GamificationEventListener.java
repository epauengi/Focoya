package com.lofi.studyroombackend.service;

import com.lofi.studyroombackend.entity.GamificationProfileEntity;
import com.lofi.studyroombackend.entity.UserEntity;
import com.lofi.studyroombackend.event.StudySessionCompletedEvent;
import com.lofi.studyroombackend.repository.GamificationProfileRepository;
import com.lofi.studyroombackend.repository.UserRepository;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

// "XP hook" của TSK-20: nghe tin phiên học hoàn thành rồi cộng XP vào hồ sơ gamification.
// Phần tiếp theo thuộc Tiên (TSK-25): streak, bonus daily goal, kiểm tra lên cấp. Thêm vào hàm bên dưới
// hoặc chuyển sang GamificationService, không cần sửa StudySessionServiceImpl.
@Component
public class GamificationEventListener {

    private final GamificationProfileRepository gamificationProfileRepository;
    private final UserRepository userRepository;

    public GamificationEventListener(GamificationProfileRepository gamificationProfileRepository,
                                     UserRepository userRepository) {
        this.gamificationProfileRepository = gamificationProfileRepository;
        this.userRepository = userRepository;
    }

    // Spring gọi hàm này mỗi khi có ai publishEvent(new StudySessionCompletedEvent(...)).
    // @EventListener thường chạy ngay lập tức, trong cùng transaction với nơi phát tin (finish/start).
    @EventListener
    public void onStudySessionCompleted(StudySessionCompletedEvent event) {
        GamificationProfileEntity profile = findOrCreateProfile(event);
        profile.setTotalXp(profile.getTotalXp() + event.getXpEarned());
        gamificationProfileRepository.save(profile);
    }

    // User chưa có hồ sơ gamification (lúc đăng ký chưa tạo) -> tạo mới với 0 XP.
    private GamificationProfileEntity findOrCreateProfile(StudySessionCompletedEvent event) {
        Optional<GamificationProfileEntity> found = gamificationProfileRepository.findByUserId(event.getUserId());
        if (found.isPresent()) {
            return found.get();
        }

        Optional<UserEntity> user = userRepository.findById(event.getUserId());
        if (user.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tài khoản không còn tồn tại");
        }

        GamificationProfileEntity profile = new GamificationProfileEntity();
        profile.setUser(user.get());
        return profile;
    }
}
