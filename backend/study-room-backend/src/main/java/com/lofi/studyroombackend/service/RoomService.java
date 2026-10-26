package com.lofi.studyroombackend.service;

import com.lofi.studyroombackend.dto.request.CreateRoomRequest;
import com.lofi.studyroombackend.dto.response.RoomResponse;

import java.util.List;
import java.util.UUID;

public interface RoomService {

    List<RoomResponse> getPublicRooms(String theme, String q);

    // currentUserId = null nghĩa là khách chưa đăng nhập.
    RoomResponse getRoom(UUID roomId, UUID currentUserId);

    RoomResponse createPrivateRoom(CreateRoomRequest request, UUID currentUserId);

    RoomResponse joinByInviteCode(String inviteCode, UUID currentUserId);
}
