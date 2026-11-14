package com.lofi.studyroombackend.realtime;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.support.ExecutorChannelInterceptor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ConcurrentMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class OutboundPresenceGuard implements ExecutorChannelInterceptor {
    private static final Pattern TOPIC = Pattern.compile(
            "^/topic/rooms/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/presence$");
    private final PresenceRegistry presenceRegistry;
    private final ConcurrentMap<String, Instant> sessionExpirations;

    public OutboundPresenceGuard(PresenceRegistry presenceRegistry, StompSecurityInterceptor security) {
        this.presenceRegistry = presenceRegistry;
        this.sessionExpirations = security.sessionExpirations();
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        return guard(message);
    }

    @Override
    public Message<?> beforeHandle(Message<?> message, MessageChannel channel, MessageHandler handler) {
        return guard(message);
    }

    private Message<?> guard(Message<?> message) {
        SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.wrap(message);
        String destination = accessor.getDestination();
        Matcher topic = destination == null ? null : TOPIC.matcher(destination);
        if (topic == null || !topic.matches()) return message;

        String sessionId = accessor.getSessionId();
        Instant expiresAt = sessionId == null ? null : sessionExpirations.get(sessionId);
        return expiresAt != null && expiresAt.isAfter(Instant.now())
                && presenceRegistry.contains(sessionId, UUID.fromString(topic.group(1))) ? message : null;
    }
}
