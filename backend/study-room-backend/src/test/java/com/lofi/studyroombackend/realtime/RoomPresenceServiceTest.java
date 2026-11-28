package com.lofi.studyroombackend.realtime;

import com.lofi.studyroombackend.entity.RoomEntity;
import com.lofi.studyroombackend.entity.UserEntity;
import com.lofi.studyroombackend.entity.enums.RoomVisibility;
import com.lofi.studyroombackend.repository.RoomRepository;
import com.lofi.studyroombackend.repository.UserRepository;
import com.lofi.studyroombackend.security.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RoomPresenceServiceTest {
    @Test
    void disconnectIsIdempotentAndQueuedJoinCannotResurrectPresence() {
        var rooms = mock(RoomRepository.class);
        var users = mock(UserRepository.class);
        var messaging = mock(SimpMessagingTemplate.class);
        var registry = new PresenceRegistry();
        var tokens = new JwtTokenProvider("service-test-secret-at-least-thirty-two-bytes", 30, 7);
        var security = new StompSecurityInterceptor(tokens, registry);
        var service = new RoomPresenceService(rooms, users, registry, security, messaging);
        var room = new RoomEntity();
        room.setId(UUID.randomUUID());
        room.setVisibility(RoomVisibility.PUBLIC);
        room.setMaxSlots(2);
        var user = new UserEntity();
        user.setId(UUID.randomUUID());
        user.setEmail("service@example.test");
        user.setDisplayName("Name");
        when(rooms.findById(room.getId())).thenReturn(Optional.of(room));
        when(users.findById(user.getId())).thenReturn(Optional.of(user));
        var headers = StompHeaderAccessor.create(StompCommand.CONNECT);
        headers.setSessionId("session");
        headers.setSessionAttributes(new HashMap<>());
        headers.setNativeHeader("Authorization", "Bearer " + tokens.generateAccessToken(user));
        headers.setLeaveMutable(true);
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders());
        security.preSend(message, null);
        service.join("session", user.getId(), room.getId(), new RoomPresenceService.JoinPayload(null));
        assertThat(registry.countOnline(room.getId())).isEqualTo(1);
        verify(messaging).convertAndSendToUser(eq(user.getId().toString()), eq("/queue/presence"),
                any(PresenceEvent.class), argThat((Map<String, Object> ackHeaders) ->
                        "session".equals(ackHeaders.get(SimpMessageHeaderAccessor.SESSION_ID_HEADER))));
        clearInvocations(messaging);
        var disconnect = new SessionDisconnectEvent(this, message, "session", CloseStatus.NORMAL);
        service.onDisconnect(disconnect);
        service.onDisconnect(disconnect);
        assertThat(registry.countOnline(room.getId())).isZero();
        verify(messaging, times(1)).convertAndSend(eq("/topic/rooms/" + room.getId() + "/presence"),
                any(PresenceEvent.class));
        assertThatThrownBy(() -> service.join("session", user.getId(), room.getId(), null))
                .hasMessageContaining("UNAUTHORIZED");
        assertThat(registry.countOnline(room.getId())).isZero();
        verify(rooms, never()).save(any());
        verify(users, never()).save(any());
    }

    @Test
    void joinRejectsNonAsciiCharactersThatUppercaseToAscii() {
        var rooms = mock(RoomRepository.class);
        var users = mock(UserRepository.class);
        var messaging = mock(SimpMessagingTemplate.class);
        var registry = new PresenceRegistry();
        var tokens = new JwtTokenProvider("service-test-secret-at-least-thirty-two-bytes", 30, 7);
        var security = new StompSecurityInterceptor(tokens, registry);
        var service = new RoomPresenceService(rooms, users, registry, security, messaging);
        var room = new RoomEntity();
        room.setId(UUID.randomUUID());
        room.setVisibility(com.lofi.studyroombackend.entity.enums.RoomVisibility.PRIVATE);
        room.setInviteCode("SBC123");
        room.setMaxSlots(2);
        room.setActive(true);
        var owner = new UserEntity();
        owner.setId(UUID.randomUUID());
        room.setOwner(owner);
        when(rooms.findById(room.getId())).thenReturn(Optional.of(room));

        assertThatThrownBy(() -> service.join("session", UUID.randomUUID(), room.getId(),
                new RoomPresenceService.JoinPayload("\u017FBC123")))
                .hasMessageContaining("INVALID_INVITE_CODE");
    }
}
