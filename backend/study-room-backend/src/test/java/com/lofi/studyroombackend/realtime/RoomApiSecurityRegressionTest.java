package com.lofi.studyroombackend.realtime;

import com.lofi.studyroombackend.config.SecurityConfig;
import com.lofi.studyroombackend.controller.RoomController;
import com.lofi.studyroombackend.dto.request.CreateRoomRequest;
import com.lofi.studyroombackend.dto.response.RoomResponse;
import com.lofi.studyroombackend.entity.RoomEntity;
import com.lofi.studyroombackend.entity.UserEntity;
import com.lofi.studyroombackend.entity.enums.RoomVisibility;
import com.lofi.studyroombackend.exception.GlobalExceptionHandler;
import com.lofi.studyroombackend.security.JwtTokenProvider;
import com.lofi.studyroombackend.service.RoomService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = RoomController.class, properties = {
        "jwt.secret=realtime-regression-test-secret-at-least-32-bytes",
        "jwt.access-token-minutes=30", "jwt.refresh-token-days=7",
        "cors.allowed-origin=http://localhost:5174"
})
@Import({SecurityConfig.class, JwtTokenProvider.class, GlobalExceptionHandler.class})
class RoomApiSecurityRegressionTest {
    @Autowired MockMvc mvc;
    @Autowired JwtTokenProvider tokens;
    @MockitoBean RoomService rooms;

    @Test
    void publicRoomListRemainsAnonymousWhileInviteEndpointStillRequiresAccessToken() throws Exception {
        when(rooms.getPublicRooms(null, null)).thenReturn(List.of());
        mvc.perform(get("/api/rooms")).andExpect(status().isOk());
        mvc.perform(get("/api/rooms/join/ABC123")).andExpect(status().isUnauthorized());
        var user = new UserEntity();
        user.setId(UUID.randomUUID());
        user.setEmail("regression@example.test");
        mvc.perform(get("/api/rooms/join/ABC123")
                        .header("Authorization", "Bearer " + tokens.generateRefreshToken(user)))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/rooms/join/ABC123")
                        .header("Authorization", "Bearer " + tokens.generateAccessToken(user)))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")));
        verify(rooms).joinByInviteCode("ABC123", user.getId());
    }

    @Test
    void privateRoomRestDenialRemains403AndWebSocketPermissionDoesNotOpenOtherUrls() throws Exception {
        UUID roomId = UUID.randomUUID();
        when(rooms.getRoom(roomId, null)).thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN));
        mvc.perform(get("/api/rooms/" + roomId)).andExpect(status().isForbidden());
        mvc.perform(get("/api/users/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/ws-room/unrelated")).andExpect(status().isUnauthorized());

        var owner = new UserEntity();
        owner.setId(UUID.randomUUID());
        owner.setEmail("owner-detail@example.test");
        var privEntity = new RoomEntity();
        privEntity.setId(roomId);
        privEntity.setName("Private Detail");
        privEntity.setThemeKey("Study");
        privEntity.setVisibility(RoomVisibility.PRIVATE);
        privEntity.setInviteCode("XYZ999");
        privEntity.setMaxSlots(10);
        when(rooms.getRoom(roomId, owner.getId())).thenReturn(new RoomResponse(privEntity, 0, true));

        mvc.perform(get("/api/rooms/" + roomId)
                        .header("Authorization", "Bearer " + tokens.generateAccessToken(owner)))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")));
    }

    @Test
    void myRoomsRequiresAccessTokenBeforePublicRoomDetailMatcher() throws Exception {
        mvc.perform(get("/api/rooms/me")).andExpect(status().isUnauthorized());
        var user = new UserEntity();
        user.setId(UUID.randomUUID());
        user.setEmail("owner@example.test");
        mvc.perform(get("/api/rooms/me")
                        .header("Authorization", "Bearer " + tokens.generateRefreshToken(user)))
                .andExpect(status().isUnauthorized());
        when(rooms.getMyPrivateRooms(user.getId())).thenReturn(List.of());
        mvc.perform(get("/api/rooms/me")
                        .header("Authorization", "Bearer " + tokens.generateAccessToken(user)))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")));
        verify(rooms).getMyPrivateRooms(user.getId());
        verify(rooms, never()).getRoom(any(), any());
    }

    @Test
    void createRoomRequiresAccessTokenAndValidatesRequestBody() throws Exception {
        String validBody = """
                {"name":"Deep Work","theme":"Study","maxSlots":15}
                """;
        mvc.perform(post("/api/rooms")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBody))
                .andExpect(status().isUnauthorized());

        var user = new UserEntity();
        user.setId(UUID.randomUUID());
        user.setEmail("creator@example.test");
        String accessToken = tokens.generateAccessToken(user);

        mvc.perform(post("/api/rooms")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Too Small","theme":"Study","maxSlots":5}
                                """))
                .andExpect(status().isBadRequest());

        mvc.perform(post("/api/rooms")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBody))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")));
        verify(rooms).createPrivateRoom(any(CreateRoomRequest.class), eq(user.getId()));
    }

    @Test
    void createRoomValidatesBundledRoomAssetAllowlistAndPreservesNullImage() throws Exception {
        var user = new UserEntity();
        user.setId(UUID.randomUUID());
        user.setEmail("assets@example.test");
        String accessToken = tokens.generateAccessToken(user);

        for (String invalidImage : List.of("/room-assets/..", "/room-assets/arbitrary.svg")) {
            mvc.perform(post("/api/rooms")
                            .header("Authorization", "Bearer " + accessToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"name":"Bad Asset","theme":"Study","image":"%s","maxSlots":15}
                                    """.formatted(invalidImage)))
                    .andExpect(status().isBadRequest());
        }
        verify(rooms, never()).createPrivateRoom(any(CreateRoomRequest.class), eq(user.getId()));

        List<String> validImages = List.of(
                "/room-assets/rainy.jpg",
                "/room-assets/midnight.png",
                "/room-assets/autumn.png",
                "/room-assets/sunset.jpg",
                "/room-assets/bg.png"
        );
        for (String validImage : validImages) {
            mvc.perform(post("/api/rooms")
                            .header("Authorization", "Bearer " + accessToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"name":"Valid Asset","theme":"Study","image":"%s","maxSlots":15}
                                    """.formatted(validImage)))
                    .andExpect(status().isCreated());
        }
        verify(rooms, times(validImages.size())).createPrivateRoom(any(CreateRoomRequest.class), eq(user.getId()));
    }
}
