package com.lofi.studyroombackend.dto.response;

import com.lofi.studyroombackend.entity.RoomEntity;
import lombok.Getter;

import java.util.UUID;

// Thông tin phòng trả cho FE. Tên field đặt ĐÚNG như type Room của FE (frontend/src/features/rooms/rooms.ts)
// để FE chỉ cần thay mock bằng dữ liệu API, không phải đổi tên gì.
@Getter
public class RoomResponse {

    private UUID id;
    private String name;
    private String theme;        // lấy từ cột theme_key, ví dụ "Café"
    private int online;          // số người đang trong phòng, KHÔNG lưu DB (realtime, xem RoomServiceImpl)
    private int maxSlots;
    private String image;        // lấy từ cột scene_key, ví dụ "/room-assets/rainy.jpg"
    private String description;
    private String visibility;   // PUBLIC hoặc PRIVATE
    private String inviteCode;   // chỉ chủ phòng mới thấy, người khác nhận null

    public RoomResponse(RoomEntity room, int online, boolean showInviteCode) {
        this.id = room.getId();
        this.name = room.getName();
        this.theme = room.getThemeKey();
        this.online = online;
        this.maxSlots = room.getMaxSlots();
        this.image = room.getSceneKey();
        this.description = room.getDescription();
        this.visibility = room.getVisibility().name();
        this.inviteCode = showInviteCode ? room.getInviteCode() : null;
    }
}
