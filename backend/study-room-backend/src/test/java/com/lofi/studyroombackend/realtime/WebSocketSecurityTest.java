package com.lofi.studyroombackend.realtime;

import com.lofi.studyroombackend.entity.UserEntity;
import com.lofi.studyroombackend.security.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.MessageHandler;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;

import java.time.Instant;
import java.util.HashMap;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class WebSocketSecurityTest {
    private static final String SECRET = "test-secret-key-for-unit-test-at-least-32-bytes";

    @Test
    void connectAuthenticatesAccessJwtAndRemovesAuthorizationHeader() {
        JwtTokenProvider jwt = new JwtTokenProvider(SECRET, 30, 7);
        UserEntity user = user();
        PresenceRegistry registry = new PresenceRegistry();
        StompSecurityInterceptor interceptor = new StompSecurityInterceptor(jwt, registry);
        StompHeaderAccessor headers = frame(StompCommand.CONNECT, "s1", null);
        headers.setNativeHeader("Authorization", "Bearer " + jwt.generateAccessToken(user));
        Message<byte[]> message = frameMessage(headers);

        assertSame(message, interceptor.preSend(message, null));
        assertEquals(user.getId().toString(), headers.getUser().getName());
        assertNull(headers.getNativeHeader("Authorization"));
    }

    @Test
    void connectRejectsMissingMalformedRefreshAndExpiredTokensWithoutRetainingHeader() {
        JwtTokenProvider jwt = new JwtTokenProvider(SECRET, 30, 7);
        StompSecurityInterceptor interceptor = new StompSecurityInterceptor(jwt, new PresenceRegistry());
        assertRejected(interceptor, null);
        assertRejected(interceptor, "Bearer malformed");
        assertRejected(interceptor, "Bearer " + jwt.generateRefreshToken(user()));
        assertRejected(interceptor, "Bearer " + new JwtTokenProvider(SECRET, -1, 7).generateAccessToken(user()));
    }

    @Test
    void sendAndSubscriptionOutsidePresenceAllowlistAreRejected() {
        JwtTokenProvider jwt = new JwtTokenProvider(SECRET, 30, 7);
        PresenceRegistry registry = new PresenceRegistry();
        StompSecurityInterceptor interceptor = authenticated(jwt, registry, "s1", user());
        UUID roomId = UUID.randomUUID();
        assertThrows(MessageDeliveryException.class,
                () -> interceptor.preSend(frameMessage(frame(StompCommand.SEND, "s1", "/topic/rooms/" + roomId + "/presence")), null));
        assertThrows(MessageDeliveryException.class,
                () -> interceptor.preSend(frameMessage(frame(StompCommand.SUBSCRIBE, "s1", "/topic/rooms/" + roomId + "/presence")), null));
    }

    @Test
    void queuedOutboundPresenceIsRecheckedAfterLeaveAndExpiry() {
        JwtTokenProvider jwt = new JwtTokenProvider(SECRET, 30, 7);
        PresenceRegistry registry = new PresenceRegistry();
        UserEntity user = user();
        StompSecurityInterceptor security = authenticated(jwt, registry, "s1", user);
        OutboundPresenceGuard guard = new OutboundPresenceGuard(registry, security);
        UUID roomId = UUID.randomUUID();
        registry.join("s1", roomId, user.getId(), "User", "avatar", 2);
        Message<byte[]> outbound = outbound("s1", "/topic/rooms/" + roomId + "/presence");
        MessageHandler handler = message -> {};

        assertSame(outbound, guard.beforeHandle(outbound, null, handler));
        registry.leave("s1", roomId);
        assertNull(guard.beforeHandle(outbound, null, handler));

        registry.join("s1", roomId, user.getId(), "User", "avatar", 2);
        security.sessionExpirations().put("s1", Instant.EPOCH);
        assertNull(guard.beforeHandle(outbound, null, handler));
    }

    @Test
    void heartbeatAndJoinedTopicAllowedButExpiredInboundAndWildcardTopicsRejected() {
        var jwt = new JwtTokenProvider(SECRET, 30, 7);
        var registry = new PresenceRegistry();
        var user = user();
        var security = authenticated(jwt, registry, "s1", user);
        UUID roomId = UUID.randomUUID();
        registry.join("s1", roomId, user.getId(), "Name", null, 1);
        var subscribed = frameMessage(frame(StompCommand.SUBSCRIBE, "s1", "/topic/rooms/" + roomId + "/presence"));
        assertSame(subscribed, security.preSend(subscribed, null));
        var heartbeatHeaders = StompHeaderAccessor.createForHeartbeat();
        heartbeatHeaders.setSessionId("s1");
        heartbeatHeaders.setLeaveMutable(true);
        var heartbeat = frameMessage(heartbeatHeaders);
        assertSame(heartbeat, security.preSend(heartbeat, null));
        for (String destination : java.util.List.of("/topic/**", "/queue/presence", "/user/other/queue/presence")) {
            assertThrows(MessageDeliveryException.class, () -> security.preSend(
                    frameMessage(frame(StompCommand.SUBSCRIBE, "s1", destination)), null));
        }
        security.sessionExpirations().put("s1", Instant.EPOCH);
        assertThrows(MessageDeliveryException.class, () -> security.preSend(subscribed, null));
        assertThrows(MessageDeliveryException.class, () -> security.preSend(heartbeat, null));
        assertThrows(MessageDeliveryException.class, () -> security.preSend(
                frameMessage(frame(StompCommand.SEND, "s1", "/app/rooms/" + roomId + "/status")), null));
    }

    private static StompSecurityInterceptor authenticated(JwtTokenProvider jwt, PresenceRegistry registry,
                                                           String session, UserEntity user) {
        StompSecurityInterceptor interceptor = new StompSecurityInterceptor(jwt, registry);
        StompHeaderAccessor headers = frame(StompCommand.CONNECT, session, null);
        headers.setNativeHeader("Authorization", "Bearer " + jwt.generateAccessToken(user));
        Message<byte[]> message = frameMessage(headers);
        interceptor.preSend(message, null);
        return interceptor;
    }

    private static void assertRejected(StompSecurityInterceptor interceptor, String token) {
        StompHeaderAccessor headers = frame(StompCommand.CONNECT, UUID.randomUUID().toString(), null);
        if (token != null) headers.setNativeHeader("Authorization", token);
        Message<byte[]> message = frameMessage(headers);
        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(message, null));
        assertNull(headers.getNativeHeader("Authorization"));
    }

    private static StompHeaderAccessor frame(StompCommand command, String session, String destination) {
        StompHeaderAccessor headers = StompHeaderAccessor.create(command);
        headers.setSessionId(session);
        headers.setSessionAttributes(new HashMap<>());
        if (destination != null) headers.setDestination(destination);
        headers.setLeaveMutable(true);
        return headers;
    }

    private static Message<byte[]> frameMessage(StompHeaderAccessor headers) {
        return MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders());
    }

    private static Message<byte[]> outbound(String session, String destination) {
        StompHeaderAccessor headers = StompHeaderAccessor.create(StompCommand.MESSAGE);
        headers.setSessionId(session);
        headers.setDestination(destination);
        headers.setLeaveMutable(true);
        return frameMessage(headers);
    }

    private static UserEntity user() {
        UserEntity user = new UserEntity();
        user.setId(UUID.randomUUID());
        user.setEmail("user@example.com");
        return user;
    }
}
