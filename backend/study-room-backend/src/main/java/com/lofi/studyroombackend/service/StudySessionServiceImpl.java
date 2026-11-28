package com.lofi.studyroombackend.service;

import com.lofi.studyroombackend.dto.request.StartStudySessionRequest;
import com.lofi.studyroombackend.dto.response.StudySessionResponse;
import com.lofi.studyroombackend.entity.RoomEntity;
import com.lofi.studyroombackend.entity.StudySessionEntity;
import com.lofi.studyroombackend.entity.UserEntity;
import com.lofi.studyroombackend.entity.enums.RoomVisibility;
import com.lofi.studyroombackend.entity.enums.StudySessionStatus;
import com.lofi.studyroombackend.event.StudySessionCompletedEvent;
import com.lofi.studyroombackend.realtime.PresenceRegistry;
import com.lofi.studyroombackend.repository.RoomRepository;
import com.lofi.studyroombackend.repository.StudySessionRepository;
import com.lofi.studyroombackend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
public class StudySessionServiceImpl implements StudySessionService {

    // Excel TSK-20: phiên dưới 5 phút không được công nhận, để không ai bấm start/finish liên tục lấy điểm.
    private static final int MIN_SESSION_MINUTES = 5;
    // Một Pomodoro dài nhất FE cho đặt là 60 phút (Excel TSK-21).
    // Quên bấm kết thúc rồi hôm sau mới bấm thì cũng chỉ được tính 60 phút, không phải 24 giờ.
    private static final int MAX_SESSION_MINUTES = 60;
    // Excel TSK-20: 1 phút học = 1 XP.
    private static final int XP_PER_MINUTE = 1;

    private final StudySessionRepository studySessionRepository;
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    // Công cụ có sẵn của Spring để phát "tin báo" cho các class khác đang lắng nghe (xem closeSession).
    private final ApplicationEventPublisher eventPublisher;
    private final PresenceRegistry presenceRegistry;

    @Autowired
    public StudySessionServiceImpl(StudySessionRepository studySessionRepository,
                                   RoomRepository roomRepository,
                                   UserRepository userRepository,
                                   ApplicationEventPublisher eventPublisher,
                                   PresenceRegistry presenceRegistry) {
        this.studySessionRepository = studySessionRepository;
        this.roomRepository = roomRepository;
        this.userRepository = userRepository;
        this.eventPublisher = eventPublisher;
        this.presenceRegistry = presenceRegistry;
    }

    public StudySessionServiceImpl(StudySessionRepository studySessionRepository,
                                   RoomRepository roomRepository,
                                   UserRepository userRepository,
                                   ApplicationEventPublisher eventPublisher) {
        this(studySessionRepository, roomRepository, userRepository, eventPublisher, new PresenceRegistry());
    }

    // @Transactional: mọi lệnh ghi DB trong hàm này thành công cùng nhau hoặc cùng bị hủy (rollback).
    @Override
    @Transactional
    public StudySessionResponse start(StartStudySessionRequest request, UUID currentUserId) {
        // 1. User lấy từ JWT, không nhận từ client. Khóa dòng user để 2 request start gửi cùng lúc phải xếp hàng.
        UserEntity user = lockCurrentUser(currentUserId);

        // 2. Phòng phải tồn tại và đang mở.
        Optional<RoomEntity> foundRoom = roomRepository.findById(request.getRoomId());
        if (foundRoom.isEmpty() || !foundRoom.get().isActive()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Phòng không tồn tại hoặc đã đóng");
        }
        RoomEntity room = foundRoom.get();

        // 3. Phòng riêng: chỉ chủ phòng hoặc thành viên đang có mặt trong PresenceRegistry mới được bắt đầu phiên học.
        //    Kiểm tra TRƯỚC khi chốt/thay đổi phiên học đang chạy trước đó.
        if (room.getVisibility() == RoomVisibility.PRIVATE) {
            boolean owner = room.getOwner() != null && room.getOwner().getId().equals(currentUserId);
            boolean member = presenceRegistry.containsUser(room.getId(), currentUserId);
            if (!owner && !member) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Bạn phải tham gia phòng riêng trước khi bắt đầu phiên học");
            }
        }

        // 4. Luật "mỗi user chỉ có 1 phiên đang chạy": còn phiên cũ chưa kết thúc thì chốt nó trước
        //    (theo đúng luật của finish). Vì vậy start luôn thành công, FE không bị kẹt khi user đóng tab giữa chừng.
        Instant now = Instant.now();
        Optional<StudySessionEntity> running = findRunningSession(currentUserId);
        if (running.isPresent()) {
            closeSession(running.get(), now);
        }

        // 5. Tạo phiên mới. startedAt là giờ SERVER. status mặc định IN_PROGRESS (khai báo trong entity).
        StudySessionEntity session = new StudySessionEntity();
        session.setUser(user);
        session.setRoom(room);
        session.setStartedAt(now);

        session = studySessionRepository.save(session);
        return new StudySessionResponse(session);
    }

    @Override
    @Transactional
    public StudySessionResponse finish(UUID currentUserId) {
        // 1. Khóa dòng user: bấm đúp nút kết thúc -> request thứ 2 phải chờ request thứ 1 xong,
        //    lúc đó không còn phiên đang chạy nên nhận 404. XP không bị cộng 2 lần.
        lockCurrentUser(currentUserId);

        // 2. Không nhận sessionId từ client: luôn chốt phiên đang chạy của CHÍNH user trong JWT,
        //    nên không thể kết thúc hộ phiên của người khác (chống IDOR).
        Optional<StudySessionEntity> running = findRunningSession(currentUserId);
        if (running.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Bạn không có phiên học nào đang diễn ra");
        }

        StudySessionEntity session = closeSession(running.get(), Instant.now());
        return new StudySessionResponse(session);
    }

    // Chốt một phiên đang chạy. Dùng chung cho finish() và cho start() khi còn phiên cũ.
    private StudySessionEntity closeSession(StudySessionEntity session, Instant now) {
        // Thời lượng = giờ server lúc chốt - giờ server lúc start. toMinutes() làm tròn xuống: 5 phút 59 giây -> 5.
        long minutes = Duration.between(session.getStartedAt(), now).toMinutes();
        if (minutes > MAX_SESSION_MINUTES) {
            minutes = MAX_SESSION_MINUTES;
        }

        session.setEndedAt(now);
        session.setDurationMinutes((int) minutes);

        // Chưa đủ 5 phút: hủy, không có XP, không phát tin báo.
        if (minutes < MIN_SESSION_MINUTES) {
            session.setStatus(StudySessionStatus.CANCELLED);
            session.setXpEarned(0);
            return studySessionRepository.saveAndFlush(session);
        }

        session.setStatus(StudySessionStatus.COMPLETED);
        session.setXpEarned((int) minutes * XP_PER_MINUTE);

        // saveAndFlush: gửi lệnh UPDATE xuống DB NGAY (save thường thì Hibernate để dành tới cuối transaction).
        // Nhờ vậy phiên học được lưu xong rồi mới tới bước cộng XP, đúng thứ tự Excel yêu cầu.
        session = studySessionRepository.saveAndFlush(session);

        // Phát tin "phiên học đã hoàn thành". GamificationEventListener nghe tin này và cộng XP.
        // Listener chạy ngay tại đây, trong CÙNG transaction: cộng XP lỗi thì phiên học cũng bị rollback,
        // nên không bao giờ có phiên COMPLETED mà XP chưa được cộng.
        eventPublisher.publishEvent(new StudySessionCompletedEvent(
                session.getId(), session.getUser().getId(), session.getDurationMinutes(), session.getXpEarned()));

        return session;
    }

    private Optional<StudySessionEntity> findRunningSession(UUID userId) {
        return studySessionRepository.findFirstByUserIdAndStatusOrderByStartedAtDesc(
                userId, StudySessionStatus.IN_PROGRESS);
    }

    // Token hợp lệ nhưng user đã bị xóa khỏi DB -> coi như chưa đăng nhập.
    private UserEntity lockCurrentUser(UUID currentUserId) {
        Optional<UserEntity> found = userRepository.findByIdForUpdate(currentUserId);
        if (found.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tài khoản không còn tồn tại");
        }
        return found.get();
    }
}
