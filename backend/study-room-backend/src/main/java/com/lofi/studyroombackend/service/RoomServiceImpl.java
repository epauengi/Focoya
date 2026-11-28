package com.lofi.studyroombackend.service;

import com.lofi.studyroombackend.dto.request.CreateRoomRequest;
import com.lofi.studyroombackend.dto.response.RoomResponse;
import com.lofi.studyroombackend.entity.RoomEntity;
import com.lofi.studyroombackend.entity.UserEntity;
import com.lofi.studyroombackend.entity.enums.RoomVisibility;
import com.lofi.studyroombackend.repository.RoomRepository;
import com.lofi.studyroombackend.repository.UserRepository;
import com.lofi.studyroombackend.realtime.PresenceRegistry;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class RoomServiceImpl implements RoomService {

    private static final int MAX_ACTIVE_PRIVATE_ROOMS = 2;
    private static final int INVITE_CODE_LENGTH = 6;
    private static final int MAX_INVITE_GENERATION_ATTEMPTS = 10;
    private static final int MAX_CREATE_COLLISION_RETRIES = 5;
    private static final String INVITE_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final Pattern RAW_INVITE_CODE_PATTERN = Pattern.compile("^[A-Za-z0-9]{6}$");
    // Hibernate-generated unique constraint name for rooms.invite_code in PostgreSQL.
    private static final String INVITE_CODE_CONSTRAINT = "ukkhtp891c64djg4uv3cs15br74";
    // Ảnh mặc định khi tạo phòng riêng không chọn ảnh (cùng ảnh FE dùng cho trang My Rooms).
    private static final String DEFAULT_IMAGE = "/room-assets/rainy.jpg";
    private static final String ROOM_NOT_FOUND_MESSAGE = "Phòng không tồn tại hoặc đã đóng";

    // SecureRandom thay cho Random: mã mời khó đoán hơn.
    private final SecureRandom random = new SecureRandom();
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final PresenceRegistry presenceRegistry;
    private final TransactionOperations transactionOperations;

    @Autowired
    public RoomServiceImpl(RoomRepository roomRepository, UserRepository userRepository,
                           PresenceRegistry presenceRegistry,
                           PlatformTransactionManager transactionManager) {
        this.roomRepository = roomRepository;
        this.userRepository = userRepository;
        this.presenceRegistry = presenceRegistry;
        this.transactionOperations = new TransactionTemplate(
                Objects.requireNonNull(transactionManager, "transactionManager must not be null"));
    }

    // Fallback for Mockito unit tests without Spring transaction infrastructure; production uses @Autowired above.
    public RoomServiceImpl(RoomRepository roomRepository, UserRepository userRepository,
                           PresenceRegistry presenceRegistry) {
        this.roomRepository = roomRepository;
        this.userRepository = userRepository;
        this.presenceRegistry = presenceRegistry;
        this.transactionOperations = TransactionOperations.withoutTransaction();
    }

    @Override
    public List<RoomResponse> getPublicRooms(String theme, String q) {
        // FE không gửi param thì nhận null -> đổi thành "" (xem giải thích trong RoomRepository).
        String themeFilter = theme == null ? "" : theme.trim();
        String keyword = q == null ? "" : q.trim();

        List<RoomEntity> rooms = roomRepository.searchActiveRooms(RoomVisibility.PUBLIC, themeFilter, keyword);

        List<RoomResponse> result = new ArrayList<>();
        for (RoomEntity room : rooms) {
            result.add(new RoomResponse(room, countOnline(room), false));
        }
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoomResponse> getMyPrivateRooms(UUID currentUserId) {
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Bạn chưa đăng nhập");
        }
        List<RoomEntity> rooms = roomRepository.findActiveOwnedRooms(currentUserId, RoomVisibility.PRIVATE);
        List<RoomResponse> result = new ArrayList<>(rooms.size());
        for (RoomEntity room : rooms) {
            result.add(new RoomResponse(room, countOnline(room), true));
        }
        return result;
    }

    // readOnly: chỉ đọc, gom các câu SELECT trong 1 transaction.
    // isOwner() đụng tới room.getOwner() (quan hệ LAZY); open-in-view đang tắt nên đọc LAZY trong transaction cho an toàn.
    @Override
    @Transactional(readOnly = true)
    public RoomResponse getRoom(UUID roomId, UUID currentUserId) {
        RoomEntity room = findActiveRoom(roomId);
        boolean owner = isOwner(room, currentUserId);

        // Phòng riêng: chỉ chủ phòng xem bằng id. Người khác phải vào bằng mã mời (joinByInviteCode).
        // Không dựa vào việc "UUID khó đoán": luôn kiểm tra quyền ở server (chống IDOR).
        if (room.getVisibility() == RoomVisibility.PRIVATE && !owner) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Đây là phòng riêng, hãy vào bằng mã mời");
        }

        // Không chặn phòng đầy ở đây: trang Preview vẫn cần thông tin để hiện "Phòng đã đầy".
        return new RoomResponse(room, countOnline(room), owner);
    }

    @Override
    public RoomResponse createPrivateRoom(CreateRoomRequest request, UUID currentUserId) {
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Bạn chưa đăng nhập");
        }
        for (int attempt = 0; attempt < MAX_CREATE_COLLISION_RETRIES; attempt++) {
            try {
                return transactionOperations.execute(status -> createPrivateRoomAttempt(request, currentUserId));
            } catch (DataIntegrityViolationException ex) {
                if (!isInviteCodeCollision(ex)) {
                    throw ex;
                }
                if (attempt == MAX_CREATE_COLLISION_RETRIES - 1) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Không thể tạo mã mời duy nhất, vui lòng thử lại");
                }
            }
        }
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Không thể tạo mã mời duy nhất, vui lòng thử lại");
    }

    private RoomResponse createPrivateRoomAttempt(CreateRoomRequest request, UUID currentUserId) {
        // 1. Khóa dòng user trước để các request tạo phòng đồng thời của cùng user xếp hàng nguyên tử.
        UserEntity owner = userRepository.findByIdForUpdate(currentUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tài khoản không còn tồn tại"));

        // 2. Chống spam: mỗi user tối đa 2 phòng riêng đang mở.
        if (roomRepository.countByOwnerIdAndVisibilityAndActiveTrue(currentUserId, RoomVisibility.PRIVATE) >= MAX_ACTIVE_PRIVATE_ROOMS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Bạn chỉ được có tối đa " + MAX_ACTIVE_PRIVATE_ROOMS + " phòng riêng đang hoạt động");
        }

        // 3. Tạo phòng. visibility luôn là PRIVATE, client không chọn được.
        RoomEntity room = new RoomEntity();
        room.setOwner(owner);
        room.setName(request.getName().trim());
        room.setDescription(request.getDescription());
        room.setThemeKey(request.getTheme());
        room.setSceneKey(request.getImage() == null ? DEFAULT_IMAGE : request.getImage());
        room.setVisibility(RoomVisibility.PRIVATE);
        room.setInviteCode(generateUniqueInviteCode());
        room.setMaxSlots(request.getMaxSlots());

        room = roomRepository.saveAndFlush(room);

        // 4. Người tạo là chủ phòng -> được thấy mã mời để gửi cho bạn bè.
        return new RoomResponse(room, countOnline(room), true);
    }

    @Override
    @Transactional(readOnly = true)
    public RoomResponse joinByInviteCode(String inviteCode, UUID currentUserId) {
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Bạn chưa đăng nhập");
        }
        if (inviteCode == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mã mời phải gồm đúng 6 ký tự chữ hoặc số");
        }
        // Kiểm tra ASCII [A-Za-z0-9]{6} TRƯỚC khi uppercase để chặn ký tự Unicode (vd: 'ſ' -> 'S').
        String trimmed = inviteCode.trim();
        if (!RAW_INVITE_CODE_PATTERN.matcher(trimmed).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mã mời phải gồm đúng 6 ký tự chữ hoặc số");
        }
        String code = trimmed.toUpperCase(Locale.ROOT);

        Optional<RoomEntity> found = roomRepository.findByInviteCode(code);
        if (found.isEmpty() || !found.get().isActive()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Mã phòng không tồn tại hoặc phòng đã đóng");
        }
        RoomEntity room = found.get();

        // Excel TSK-12: phòng đầy -> 400. Nếu chính user đã có mặt trong PresenceRegistry thì vẫn cho qua.
        int online = countOnline(room);
        boolean alreadyPresent = presenceRegistry.containsUser(room.getId(), currentUserId);
        if (!alreadyPresent && online >= room.getMaxSlots()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phòng đã đủ chỗ ngồi");
        }

        return new RoomResponse(room, online, isOwner(room, currentUserId));
    }

    private RoomEntity findActiveRoom(UUID roomId) {
        Optional<RoomEntity> found = roomRepository.findById(roomId);
        // Phòng đã tắt (is_active = false) coi như không tồn tại với người dùng.
        if (found.isEmpty() || !found.get().isActive()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, ROOM_NOT_FOUND_MESSAGE);
        }
        return found.get();
    }

    // currentUserId = null (khách) -> luôn false. Phòng public không có chủ -> luôn false.
    private boolean isOwner(RoomEntity room, UUID currentUserId) {
        return room.getOwner() != null && room.getOwner().getId().equals(currentUserId);
    }

    // Số người đang ở trong phòng là dữ liệu realtime -> giữ trong RAM (PresenceRegistry), KHÔNG lưu DB.
    private int countOnline(RoomEntity room) {
        return presenceRegistry.countOnline(room.getId());
    }

    // Sinh mã 6 ký tự A-Z, 0-9. Có 36^6 ≈ 2 tỷ mã nên gần như không trùng,
    // nhưng vẫn kiểm tra DB trong vòng lặp giới hạn và xử lý trùng ở transaction boundary nếu race condition xảy ra.
    private String generateUniqueInviteCode() {
        for (int attempt = 0; attempt < MAX_INVITE_GENERATION_ATTEMPTS; attempt++) {
            StringBuilder builder = new StringBuilder(INVITE_CODE_LENGTH);
            for (int i = 0; i < INVITE_CODE_LENGTH; i++) {
                builder.append(INVITE_CODE_CHARS.charAt(random.nextInt(INVITE_CODE_CHARS.length())));
            }
            String code = builder.toString();
            if (!roomRepository.existsByInviteCode(code)) {
                return code;
            }
        }
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Không thể tạo mã mời duy nhất, vui lòng thử lại");
    }

    private static boolean isInviteCodeCollision(DataIntegrityViolationException ex) {
        Throwable current = ex;
        while (current != null) {
            if (current instanceof ConstraintViolationException cve) {
                boolean isUniqueViolation = cve.getSQLState() == null || "23505".equals(cve.getSQLState());
                if (isUniqueViolation && (isInviteConstraintName(cve.getConstraintName())
                        || mentionsInviteCode(cve.getMessage())
                        || (cve.getSQLException() != null && mentionsInviteCode(cve.getSQLException().getMessage())))) {
                    return true;
                }
            } else if (current instanceof SQLException sqlEx) {
                if ("23505".equals(sqlEx.getSQLState()) && mentionsInviteCode(sqlEx.getMessage())) {
                    return true;
                }
            } else if (mentionsInviteCode(current.getMessage())) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private static boolean isInviteConstraintName(String constraintName) {
        if (constraintName == null) {
            return false;
        }
        String lower = constraintName.toLowerCase(Locale.ROOT);
        return lower.equals(INVITE_CODE_CONSTRAINT) || lower.contains("invite_code");
    }

    private static boolean mentionsInviteCode(String message) {
        if (message == null) {
            return false;
        }
        String lower = message.toLowerCase(Locale.ROOT);
        return lower.contains(INVITE_CODE_CONSTRAINT)
                || lower.contains("(invite_code)")
                || lower.contains("invite_code");
    }
}
