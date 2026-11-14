package com.lofi.studyroombackend.realtime;

import com.lofi.studyroombackend.security.JwtTokenProvider;
import io.jsonwebtoken.Claims;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class StompSecurityInterceptor implements ChannelInterceptor {
    private static final Pattern ROOM_DESTINATION = Pattern.compile(
            "^/app/rooms/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/(join|leave|status)$");
    private static final Pattern PRESENCE_TOPIC = Pattern.compile(
            "^/topic/rooms/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/presence$");

    private final JwtTokenProvider jwtTokenProvider;
    private final PresenceRegistry presenceRegistry;
    private final ConcurrentMap<String, Instant> sessionExpirations = new ConcurrentHashMap<>();

    ConcurrentMap<String, Instant> sessionExpirations() {
        return sessionExpirations;
    }

    public StompSecurityInterceptor(JwtTokenProvider jwtTokenProvider, PresenceRegistry presenceRegistry) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.presenceRegistry = presenceRegistry;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) return message;

        StompCommand command = accessor.getCommand();
        if (command == StompCommand.CONNECT || command == StompCommand.STOMP) {
            authenticate(accessor);
            return message;
        }
        if (command == StompCommand.DISCONNECT) return message;
        if (command == null && accessor.getMessageType() == SimpMessageType.HEARTBEAT) {
            if (!isUnexpired(accessor.getSessionId())) throw unauthorized();
            return message;
        }
        if (command != StompCommand.SEND && command != StompCommand.SUBSCRIBE
                && command != StompCommand.UNSUBSCRIBE) throw forbidden();

        String sessionId = accessor.getSessionId();
        if (!isUnexpired(sessionId)) throw unauthorized();
        String destination = accessor.getDestination();

        if (command == StompCommand.SEND) {
            if (destination == null || !ROOM_DESTINATION.matcher(destination).matches()) throw forbidden();
        } else if (command == StompCommand.SUBSCRIBE) {
            if ("/user/queue/presence".equals(destination) || "/user/queue/errors".equals(destination)) return message;
            Matcher topic = destination == null ? null : PRESENCE_TOPIC.matcher(destination);
            if (topic == null || !topic.matches()
                    || !presenceRegistry.contains(sessionId, UUID.fromString(topic.group(1)))) throw forbidden();
        }
        return message;
    }

    private void authenticate(StompHeaderAccessor accessor) {
        String sessionId = accessor.getSessionId();
        List<String> values = accessor.getNativeHeader("Authorization");
        String authorization = values == null || values.size() != 1 ? null : values.getFirst();
        accessor.removeNativeHeader("Authorization");
        if (sessionId == null || sessionExpirations.containsKey(sessionId) || authorization == null
                || !authorization.startsWith("Bearer ") || authorization.length() <= 7
                || authorization.substring(7).isBlank()
                || authorization.substring(7).chars().anyMatch(Character::isWhitespace)) throw unauthorized();

        Claims claims;
        try {
            claims = jwtTokenProvider.parseToken(authorization.substring(7));
        } catch (RuntimeException ignored) {
            throw unauthorized();
        }

        Date expiration = claims.getExpiration();
        UUID userId;
        try {
            if (!"access".equals(claims.get("type", String.class)) || expiration == null) throw unauthorized();
            userId = UUID.fromString(claims.getSubject());
        } catch (RuntimeException ignored) {
            throw unauthorized();
        }
        Instant expiresAt = expiration.toInstant();
        if (!expiresAt.isAfter(Instant.now()) || accessor.getSessionAttributes() == null) throw unauthorized();

        accessor.setUser(new UsernamePasswordAuthenticationToken(userId, null, List.of()));
        sessionExpirations.put(sessionId, expiresAt);
    }

    private boolean isUnexpired(String sessionId) {
        Instant expiration = sessionId == null ? null : sessionExpirations.get(sessionId);
        return expiration != null && expiration.isAfter(Instant.now());
    }

    public synchronized boolean isActive(String sessionId) {
        return isUnexpired(sessionId);
    }

    public synchronized void expireSession(String sessionId) {
        sessionExpirations.remove(sessionId);
    }

    @EventListener
    public synchronized void onDisconnect(SessionDisconnectEvent event) {
        expireSession(event.getSessionId());
    }

    private static MessageDeliveryException unauthorized() {
        return new MessageDeliveryException("Authentication failed");
    }

    private static MessageDeliveryException forbidden() {
        return new MessageDeliveryException("Forbidden");
    }
}
