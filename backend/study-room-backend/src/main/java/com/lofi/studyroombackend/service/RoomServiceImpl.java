package com.lofi.studyroombackend.service;

import com.lofi.studyroombackend.dto.request.CreateRoomRequest;
import com.lofi.studyroombackend.dto.response.RoomResponse;
import com.lofi.studyroombackend.entity.RoomEntity;
import com.lofi.studyroombackend.entity.UserEntity;
import com.lofi.studyroombackend.entity.enums.RoomVisibility;
import com.lofi.studyroombackend.repository.RoomRepository;
import com.lofi.studyroombackend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class RoomServiceImpl implements RoomService {

    private static final int MAX_ACTIVE_PRIVATE_ROOMS = 2;
    private static final int INVITE_CODE_LENGTH = 6;
    private static final String INVITE_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    // Ảnh mặc định khi tạo phòng riêng không chọn ảnh (cùng ảnh FE dùng cho trang My Rooms).
    private static final String DEFAULT_IMAGE = "/room-assets/rainy.jpg";
    private static final String ROOM_NOT_FOUND_MESSAGE = "Phòng không tồn tại hoặc đã đóng";

    // SecureRandom thay cho Random: mã mời khó đoán hơn.
    private final SecureRandom random = new SecureRandom();
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;

    public RoomServiceImpl(RoomRepository roomRepository, UserRepository userRepository) {
        this.roomRepository = roomRepository;
        this.userRepository = userRepository;
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
    @Transactional
    public RoomResponse createPrivateRoom(CreateRoomRequest request, UUID currentUserId) {
        // 1. Chống spam: mỗi user tối đa 2 phòng riêng đang mở.
        if (roomRepository.countByOwnerIdAndActiveTrue(currentUserId) >= MAX_ACTIVE_PRIVATE_ROOMS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Bạn chỉ được có tối đa " + MAX_ACTIVE_PRIVATE_ROOMS + " phòng riêng đang hoạt động");
        }

        // 2. Chủ phòng = user trong JWT, không nhận ownerId từ client.
        Optional<UserEntity> found = userRepository.findById(currentUserId);
        if (found.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tài khoản không còn tồn tại");
        }

        // 3. Tạo phòng. visibility luôn là PRIVATE, client không chọn được.
        RoomEntity room = new RoomEntity();
        room.setOwner(found.get());
        room.setName(request.getName().trim());
        room.setDescription(request.getDescription());
        room.setThemeKey(request.getTheme());
        room.setSceneKey(request.getImage() == null ? DEFAULT_IMAGE : request.getImage());
        room.setVisibility(RoomVisibility.PRIVATE);
        room.setInviteCode(generateUniqueInviteCode());
        room.setMaxSlots(request.getMaxSlots());

        room = roomRepository.save(room);

        // 4. Người tạo là chủ phòng -> được thấy mã mời để gửi cho bạn bè.
        return new RoomResponse(room, countOnline(room), true);
    }

    @Override
    @Transactional(readOnly = true)
    public RoomResponse joinByInviteCode(String inviteCode, UUID currentUserId) {
        // FE (TSK-11) gửi chữ hoa, nhưng vẫn chuẩn hóa phòng khi người dùng gõ tay vào URL.
        String code = inviteCode.trim().toUpperCase();

        Optional<RoomEntity> found = roomRepository.findByInviteCode(code);
        if (found.isEmpty() || !found.get().isActive()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Mã phòng không tồn tại hoặc phòng đã đóng");
        }
        RoomEntity room = found.get();

        // Excel TSK-12: phòng đầy -> 400.
        int online = countOnline(room);
        if (online >= room.getMaxSlots()) {
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
    // TODO TSK-16: thay bằng presenceRegistry.countOnline(room.getId()). Tạm thời 0 (Excel TSK-12 cho phép).
    private int countOnline(RoomEntity room) {
        return 0;
    }

    // Sinh mã 6 ký tự A-Z, 0-9. Có 36^6 ≈ 2 tỷ mã nên gần như không trùng,
    // nhưng vẫn kiểm tra DB và sinh lại nếu trùng (cột invite_code cũng có UNIQUE để chặn lần cuối).
    private String generateUniqueInviteCode() {
        String code;
        do {
            StringBuilder builder = new StringBuilder();
            for (int i = 0; i < INVITE_CODE_LENGTH; i++) {
                builder.append(INVITE_CODE_CHARS.charAt(random.nextInt(INVITE_CODE_CHARS.length())));
            }
            code = builder.toString();
        } while (roomRepository.existsByInviteCode(code));
        return code;
    }
}
