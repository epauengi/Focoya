package com.lofi.studyroombackend.realtime;

import com.lofi.studyroombackend.config.SecurityConfig;
import com.lofi.studyroombackend.controller.RoomController;
import com.lofi.studyroombackend.entity.UserEntity;
import com.lofi.studyroombackend.exception.GlobalExceptionHandler;
import com.lofi.studyroombackend.security.JwtTokenProvider;
import com.lofi.studyroombackend.service.RoomService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
                .andExpect(status().isOk());
        verify(rooms).joinByInviteCode("ABC123", user.getId());
    }

    @Test
    void privateRoomRestDenialRemains403AndWebSocketPermissionDoesNotOpenOtherUrls() throws Exception {
        UUID roomId = UUID.randomUUID();
        when(rooms.getRoom(roomId, null)).thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN));
        mvc.perform(get("/api/rooms/" + roomId)).andExpect(status().isForbidden());
        mvc.perform(get("/api/users/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/ws-room/unrelated")).andExpect(status().isUnauthorized());
    }
}
