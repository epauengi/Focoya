package com.lofi.studyroombackend.controller;

import com.lofi.studyroombackend.dto.request.CreateRoomRequest;
import com.lofi.studyroombackend.dto.response.RoomResponse;
import com.lofi.studyroombackend.service.RoomService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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

    // GET /api/rooms/{roomId}  — trang Preview / Focus room. Khách cũng xem được phòng public.
    @GetMapping("/{roomId}")
    public RoomResponse getRoom(@PathVariable UUID roomId, @AuthenticationPrincipal UUID userId) {
        return roomService.getRoom(roomId, userId);
    }

    // POST /api/rooms  — tạo phòng riêng, trả 201 Created kèm inviteCode. Cần đăng nhập.
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoomResponse createRoom(@Valid @RequestBody CreateRoomRequest request,
                                   @AuthenticationPrincipal UUID userId) {
        return roomService.createPrivateRoom(request, userId);
    }

    // GET /api/rooms/join/{inviteCode}  — vào phòng riêng bằng mã mời. Cần đăng nhập.
    @GetMapping("/join/{inviteCode}")
    public RoomResponse joinByInviteCode(@PathVariable String inviteCode, @AuthenticationPrincipal UUID userId) {
        return roomService.joinByInviteCode(inviteCode, userId);
    }
}
