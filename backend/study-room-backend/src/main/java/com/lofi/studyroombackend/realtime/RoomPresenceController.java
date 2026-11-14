package com.lofi.studyroombackend.realtime;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Controller
public class RoomPresenceController {
    private static final Pattern UUID_PATTERN = Pattern.compile(
            "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
    private static final Set<String> ERROR_CODES = Set.of("FORBIDDEN", "ROOM_FULL", "NOT_JOINED",
            "ALREADY_IN_ROOM", "ROOM_NOT_FOUND", "USER_NOT_FOUND", "INVALID_STATUS", "INVALID_INVITE_CODE", "UNAUTHORIZED");
    private final RoomPresenceService service;

    public RoomPresenceController(RoomPresenceService service) {
        this.service = service;
    }

    @MessageMapping("/rooms/{roomId}/join")
    public void join(@DestinationVariable String roomId, @Payload(required = false) RoomPresenceService.JoinPayload payload,
                     Principal principal, SimpMessageHeaderAccessor headers) {
        service.join(session(headers), user(principal), uuid(roomId), payload);
    }

    @MessageMapping("/rooms/{roomId}/leave")
    public void leave(@DestinationVariable String roomId, Principal principal, SimpMessageHeaderAccessor headers) {
        service.leave(session(headers), user(principal), uuid(roomId));
    }

    @MessageMapping("/rooms/{roomId}/status")
    public void status(@DestinationVariable String roomId, @Payload(required = false) RoomPresenceService.StatusPayload payload,
                       Principal principal, SimpMessageHeaderAccessor headers) {
        service.updateStatus(session(headers), user(principal), uuid(roomId), payload);
    }

    @MessageExceptionHandler(Exception.class)
    @SendToUser(destinations = "/queue/errors", broadcast = false)
    public PresenceError onError(Exception exception) {
        String code = exception instanceof ResponseStatusException status && status.getReason() != null
                && ERROR_CODES.contains(status.getReason()) ? status.getReason() : "REQUEST_REJECTED";
        return new PresenceError(code, code.replace('_', ' ').toLowerCase(java.util.Locale.ROOT));
    }

    private static String session(SimpMessageHeaderAccessor headers) {
        String sessionId = headers.getSessionId();
        if (sessionId == null) throw new IllegalArgumentException("Missing session");
        return sessionId;
    }

    private static UUID user(Principal principal) {
        if (principal == null) throw new IllegalArgumentException("Missing principal");
        return uuid(principal.getName());
    }

    private static UUID uuid(String value) {
        if (value == null || !UUID_PATTERN.matcher(value).matches()) throw new IllegalArgumentException("Invalid UUID");
        return UUID.fromString(value);
    }
}
