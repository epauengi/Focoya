package com.lofi.studyroombackend.controller;

import com.lofi.studyroombackend.dto.request.CreateRoomRequest;
import com.lofi.studyroombackend.dto.response.RoomResponse;
import com.lofi.studyroombackend.service.RoomService;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

// @AuthenticationPrincipal UUID userId: lấy userId mà JwtAuthenticationFilter đã ghi vào SecurityContext.
// Khách chưa đăng nhập -> userId = null.
@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    // GET /api/rooms?theme=Café&q=cozy  — trang Explore. Khách cũng xem được (mở trong SecurityConfig).
    // Hai param đều không bắt buộc.
    @GetMapping
    public List<RoomResponse> getPublicRooms(@RequestParam(required = false) String theme,
                                             @RequestParam(required = false) String q) {
        return roomService.getPublicRooms(theme, q);
    }

    // GET /api/rooms/me  — danh sách phòng riêng đang mở của chính user. Cần đăng nhập.
    @GetMapping("/me")
    public ResponseEntity<List<RoomResponse>> getMyRooms(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(roomService.getMyPrivateRooms(userId));
    }

    // GET /api/rooms/{roomId}  — trang Preview / Focus room. Khách cũng xem được phòng public.
    @GetMapping("/{roomId}")
    public ResponseEntity<RoomResponse> getRoom(@PathVariable UUID roomId, @AuthenticationPrincipal UUID userId) {
        RoomResponse room = roomService.getRoom(roomId, userId);
        if (room != null && "PRIVATE".equals(room.getVisibility())) {
            return ResponseEntity.ok()
                    .cacheControl(CacheControl.noStore())
                    .body(room);
        }
        return ResponseEntity.ok(room);
    }

    // POST /api/rooms  — tạo phòng riêng, trả 201 Created kèm inviteCode. Cần đăng nhập.
    @PostMapping
    public ResponseEntity<RoomResponse> createRoom(@Valid @RequestBody CreateRoomRequest request,
                                                   @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .cacheControl(CacheControl.noStore())
                .body(roomService.createPrivateRoom(request, userId));
    }

    // GET /api/rooms/join/{inviteCode}  — vào phòng riêng bằng mã mời. Cần đăng nhập.
    @GetMapping("/join/{inviteCode}")
    public ResponseEntity<RoomResponse> joinByInviteCode(@PathVariable String inviteCode,
                                                         @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(roomService.joinByInviteCode(inviteCode, userId));
    }
}
