package com.lofi.studyroombackend.realtime;

import com.lofi.studyroombackend.entity.RoomEntity;
import com.lofi.studyroombackend.entity.UserEntity;
import com.lofi.studyroombackend.entity.enums.RoomVisibility;
import com.lofi.studyroombackend.repository.RoomRepository;
import com.lofi.studyroombackend.repository.UserRepository;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class RoomPresenceService {
    private static final Pattern INVITE_CODE = Pattern.compile("[A-Z0-9]{6}");
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final PresenceRegistry presenceRegistry;
    private final StompSecurityInterceptor security;
    private final SimpMessagingTemplate messaging;

    public RoomPresenceService(RoomRepository roomRepository, UserRepository userRepository,
                               PresenceRegistry presenceRegistry, StompSecurityInterceptor security,
                               SimpMessagingTemplate messaging) {
        this.roomRepository = roomRepository;
        this.userRepository = userRepository;
        this.presenceRegistry = presenceRegistry;
        this.security = security;
        this.messaging = messaging;
    }

    @Transactional(readOnly = true)
    public synchronized PresenceEvent join(String sessionId, UUID userId, UUID roomId, JoinPayload payload) {
        RoomEntity room = findActiveRoom(roomId);
        validateInvite(payload);
        boolean owner = room.getOwner() != null && userId.equals(room.getOwner().getId());
        String inviteCode = payload == null || payload.inviteCode() == null
                ? null : payload.inviteCode().trim().toUpperCase(Locale.ROOT);
        if (room.getVisibility() == RoomVisibility.PRIVATE && !owner
                && !room.getInviteCode().equals(inviteCode)) throw failure(HttpStatus.FORBIDDEN, "FORBIDDEN");

        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> failure(HttpStatus.UNAUTHORIZED, "USER_NOT_FOUND"));
        requireActive(sessionId);
        PresenceRegistry.Snapshot snapshot = presenceRegistry.join(sessionId, roomId, userId,
                user.getDisplayName(), user.getAvatarKey(), room.getMaxSlots());
        PresenceEvent event = PresenceEvent.from(snapshot);
        publish(event, sessionId, userId);
        return event;
    }

    public synchronized PresenceEvent leave(String sessionId, UUID userId, UUID roomId) {
        requireActive(sessionId);
        PresenceRegistry.Snapshot snapshot = presenceRegistry.leave(sessionId, roomId);
        if (snapshot == null) throw failure(HttpStatus.FORBIDDEN, "NOT_JOINED");
        PresenceEvent event = PresenceEvent.from(snapshot);
        publish(event, sessionId, userId);
        return event;
    }

    public synchronized PresenceEvent updateStatus(String sessionId, UUID userId, UUID roomId, StatusPayload payload) {
        if (payload == null || payload.status() == null) throw failure(HttpStatus.BAD_REQUEST, "INVALID_STATUS");
        requireActive(sessionId);
        PresenceRegistry.Snapshot snapshot = presenceRegistry.updateStatus(sessionId, roomId, payload.status());
        PresenceEvent event = PresenceEvent.from(snapshot);
        publish(event, sessionId, userId);
        return event;
    }

    @EventListener
    public synchronized void onDisconnect(SessionDisconnectEvent event) {
        security.expireSession(event.getSessionId());
        PresenceRegistry.Snapshot snapshot = presenceRegistry.disconnect(event.getSessionId());
        if (snapshot != null) messaging.convertAndSend(topic(snapshot.roomId()), PresenceEvent.from(snapshot));
    }

    private void requireActive(String sessionId) {
        if (!security.isActive(sessionId)) throw failure(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
    }

    private RoomEntity findActiveRoom(UUID roomId) {
        RoomEntity room = roomRepository.findById(roomId)
                .orElseThrow(() -> failure(HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND"));
        if (!room.isActive()) throw failure(HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND");
        return room;
    }

    private void validateInvite(JoinPayload payload) {
        if (payload != null && payload.inviteCode() != null) {
            String normalized = payload.inviteCode().trim().toUpperCase(Locale.ROOT);
            if (!INVITE_CODE.matcher(normalized).matches()) throw failure(HttpStatus.BAD_REQUEST, "INVALID_INVITE_CODE");
        }
    }

    private void publish(PresenceEvent event, String sessionId, UUID userId) {
        messaging.convertAndSend(topic(event.roomId()), event);
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        headers.setSessionId(sessionId);
        headers.setLeaveMutable(true);
        messaging.convertAndSendToUser(userId.toString(), "/queue/presence", event, headers.getMessageHeaders());
    }

    private static String topic(UUID roomId) {
        return "/topic/rooms/" + roomId + "/presence";
    }

    private static ResponseStatusException failure(HttpStatus status, String code) {
        return new ResponseStatusException(status, code);
    }

    public record JoinPayload(String inviteCode) {}
    public record StatusPayload(PresenceRegistry.Status status) {}
}
