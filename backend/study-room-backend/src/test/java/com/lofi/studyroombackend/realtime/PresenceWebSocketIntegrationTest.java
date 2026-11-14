package com.lofi.studyroombackend.realtime;

import com.fasterxml.jackson.databind.JsonNode;
import com.lofi.studyroombackend.config.SecurityConfig;
import com.lofi.studyroombackend.config.WebSocketConfig;
import com.lofi.studyroombackend.entity.RoomEntity;
import com.lofi.studyroombackend.entity.UserEntity;
import com.lofi.studyroombackend.entity.enums.RoomVisibility;
import com.lofi.studyroombackend.repository.RoomRepository;
import com.lofi.studyroombackend.repository.UserRepository;
import com.lofi.studyroombackend.security.JwtTokenProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;

import java.lang.reflect.Type;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest(
        classes = PresenceWebSocketIntegrationTest.TestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "cors.allowed-origin=http://localhost:5174",
                "jwt.secret=integration-test-secret-key-at-least-32-bytes-long",
                "jwt.access-token-minutes=30",
                "jwt.refresh-token-days=7"
        })
class PresenceWebSocketIntegrationTest {
    private static final Duration TIMEOUT = Duration.ofSeconds(5);
    private static final String ALLOWED_ORIGIN = "http://localhost:5174";

    @LocalServerPort
    private int port;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private PresenceRegistry presenceRegistry;

    @MockitoBean
    private RoomRepository roomRepository;

    @MockitoBean
    private UserRepository userRepository;

    private final Map<UUID, RoomEntity> rooms = new HashMap<>();
    private final Map<UUID, UserEntity> users = new HashMap<>();
    private final List<StompSession> sessions = new CopyOnWriteArrayList<>();
    private WebSocketStompClient client;

    @BeforeEach
    void connectClientAndStubRepositories() {
        when(roomRepository.findById(any(UUID.class)))
                .thenAnswer(call -> Optional.ofNullable(rooms.get(call.getArgument(0))));
        when(roomRepository.findByInviteCode(any(String.class)))
                .thenAnswer(call -> rooms.values().stream()
                        .filter(room -> call.getArgument(0).equals(room.getInviteCode()))
                        .findFirst());
        when(userRepository.findById(any(UUID.class)))
                .thenAnswer(call -> Optional.ofNullable(users.get(call.getArgument(0))));

        client = new WebSocketStompClient(new StandardWebSocketClient());
        client.setMessageConverter(new MappingJackson2MessageConverter());
        client.start();
    }

    @AfterEach
    void closeSocketsAndClient() {
        sessions.forEach(session -> {
            if (session.isConnected()) session.disconnect();
        });
        client.stop();
    }

    @Test
    void authenticatedUsersBroadcastStatusAndOnlyFinalSessionDisconnectRemovesMember() throws Exception {
        UUID roomId = UUID.randomUUID();
        RoomEntity room = room(roomId, RoomVisibility.PUBLIC, 2, null, null);
        rooms.put(roomId, room);

        UserEntity alice = user("Alice");
        UserEntity bob = user("Bob");
        UserEntity aliceAgain = userWithId(alice.getId(), "Alice");
        users.put(alice.getId(), alice);
        users.put(bob.getId(), bob);

        ConnectedSocket aliceSocket = connect(alice);
        ConnectedSocket bobSocket = connect(bob);

        send(aliceSocket.session(), roomId, "join", Map.of());
        assertMembers(awaitSnapshotMatching(aliceSocket.presence(), snapshot -> hasMembers(snapshot, alice.getId())),
                alice.getId());
        aliceSocket.session().subscribe(topic(roomId), aliceSocket.room());
        send(aliceSocket.session(), roomId, "join", Map.of());
        assertMembers(awaitSnapshotMatching(aliceSocket.presence(), snapshot -> hasMembers(snapshot, alice.getId())),
                alice.getId());
        assertMembers(awaitSnapshotMatching(aliceSocket.room(), snapshot -> hasMembers(snapshot, alice.getId())),
                alice.getId());

        send(bobSocket.session(), roomId, "join", Map.of());
        assertMembers(awaitSnapshotMatching(bobSocket.presence(),
                snapshot -> hasMembers(snapshot, alice.getId(), bob.getId())), alice.getId(), bob.getId());
        bobSocket.session().subscribe(topic(roomId), bobSocket.room());
        send(bobSocket.session(), roomId, "join", Map.of());
        assertMembers(awaitSnapshotMatching(bobSocket.presence(),
                snapshot -> hasMembers(snapshot, alice.getId(), bob.getId())), alice.getId(), bob.getId());
        assertMembers(awaitSnapshotMatching(bobSocket.room(),
                snapshot -> hasMembers(snapshot, alice.getId(), bob.getId())), alice.getId(), bob.getId());
        assertMembers(awaitSnapshotMatching(aliceSocket.room(),
                snapshot -> hasMembers(snapshot, alice.getId(), bob.getId())), alice.getId(), bob.getId());

        send(bobSocket.session(), roomId, "status", Map.of("status", "STUDYING"));
        assertStatus(awaitSnapshotMatching(bobSocket.presence(),
                snapshot -> hasStatus(snapshot, bob.getId(), "STUDYING")), bob.getId(), "STUDYING");
        assertStatus(awaitSnapshotMatching(aliceSocket.room(),
                snapshot -> hasStatus(snapshot, bob.getId(), "STUDYING")), bob.getId(), "STUDYING");
        assertStatus(awaitSnapshotMatching(bobSocket.room(),
                snapshot -> hasStatus(snapshot, bob.getId(), "STUDYING")), bob.getId(), "STUDYING");

        ConnectedSocket secondAliceSocket = connect(aliceAgain);
        send(secondAliceSocket.session(), roomId, "join", Map.of());
        assertStatus(awaitSnapshotMatching(secondAliceSocket.presence(),
                snapshot -> hasStatus(snapshot, alice.getId(), "IDLE")), alice.getId(), "IDLE");
        assertThat(awaitSnapshot(bobSocket.room()).path("onlineCount").asInt()).isEqualTo(2);

        aliceSocket.session().disconnect();
        assertMembers(awaitSnapshotMatching(bobSocket.room(),
                snapshot -> hasMembers(snapshot, alice.getId(), bob.getId())), alice.getId(), bob.getId());
        secondAliceSocket.session().disconnect();
        assertMembers(awaitSnapshotMatching(bobSocket.room(), snapshot -> hasMembers(snapshot, bob.getId())),
                bob.getId());

        send(bobSocket.session(), roomId, "leave", Map.of());
        assertMembers(awaitSnapshotMatching(bobSocket.presence(), snapshot -> hasMembers(snapshot)), new UUID[0]);
        assertThat(presenceRegistry.countOnline(roomId)).isZero();
    }

    @Test
    void privateInviteAndRoomCapacityAreEnforcedOverStomp() throws Exception {
        UUID privateRoomId = UUID.randomUUID();
        UserEntity owner = user("Owner");
        UserEntity guest = user("Guest");
        RoomEntity privateRoom = room(privateRoomId, RoomVisibility.PRIVATE, 2, owner, "ABC123");
        rooms.put(privateRoomId, privateRoom);
        users.put(owner.getId(), owner);
        users.put(guest.getId(), guest);

        ConnectedSocket guestSocket = connect(guest);
        send(guestSocket.session(), privateRoomId, "join", Map.of("inviteCode", "WRONG1"));
        assertThat(awaitError(guestSocket.errors()).path("code").asText()).isEqualTo("FORBIDDEN");
        send(guestSocket.session(), privateRoomId, "join", Map.of("inviteCode", "abc123"));
        assertMembers(awaitSnapshotMatching(guestSocket.presence(), snapshot -> hasMembers(snapshot, guest.getId())),
                guest.getId());

        ConnectedSocket ownerSocket = connect(owner);
        send(ownerSocket.session(), privateRoomId, "join", Map.of());
        assertMembers(awaitSnapshotMatching(ownerSocket.presence(),
                snapshot -> hasMembers(snapshot, owner.getId(), guest.getId())), owner.getId(), guest.getId());

        UUID fullRoomId = UUID.randomUUID();
        rooms.put(fullRoomId, room(fullRoomId, RoomVisibility.PUBLIC, 1, null, null));
        UserEntity occupant = user("Occupant");
        UserEntity rejected = user("Rejected");
        users.put(occupant.getId(), occupant);
        users.put(rejected.getId(), rejected);
        ConnectedSocket occupantSocket = connect(occupant);
        ConnectedSocket rejectedSocket = connect(rejected);
        send(occupantSocket.session(), fullRoomId, "join", Map.of());
        assertMembers(awaitSnapshotMatching(occupantSocket.presence(),
                snapshot -> hasMembers(snapshot, occupant.getId())), occupant.getId());

        send(rejectedSocket.session(), fullRoomId, "join", Map.of());
        assertThat(awaitError(rejectedSocket.errors()).path("code").asText()).isEqualTo("ROOM_FULL");
    }

    private ConnectedSocket connect(UserEntity user) throws Exception {
        StompHeaders connectHeaders = new StompHeaders();
        connectHeaders.add(HttpHeaders.AUTHORIZATION,
                "Bearer " + tokenProvider.generateAccessToken(user));
        WebSocketHttpHeaders handshakeHeaders = new WebSocketHttpHeaders();
        handshakeHeaders.setOrigin(ALLOWED_ORIGIN);
        StompSession session = client.connectAsync(
                        "ws://localhost:" + port + "/ws-room",
                        handshakeHeaders,
                connectHeaders,
                new StompSessionHandlerAdapter() {})
                .get(TIMEOUT.toSeconds(), TimeUnit.SECONDS);
        sessions.add(session);
        ConnectedSocket socket = new ConnectedSocket(session, new FrameCollector(), new FrameCollector(),
                new FrameCollector());
        session.subscribe("/user/queue/presence", socket.presence());
        session.subscribe("/user/queue/errors", socket.errors());
        return socket;
    }

    private static void send(StompSession session, UUID roomId, String command, Object payload) {
        session.send("/app/rooms/" + roomId + "/" + command, payload);
    }

    private static String topic(UUID roomId) {
        return "/topic/rooms/" + roomId + "/presence";
    }

    private static JsonNode awaitSnapshot(FrameCollector frames) throws Exception {
        JsonNode snapshot = frames.next();
        assertThat(snapshot.path("type").asText()).isEqualTo("SNAPSHOT");
        return snapshot;
    }

    private static JsonNode awaitSnapshotMatching(FrameCollector frames,
                                                 java.util.function.Predicate<JsonNode> condition) throws Exception {
        long deadline = System.nanoTime() + TIMEOUT.toNanos();
        while (true) {
            long remaining = deadline - System.nanoTime();
            assertThat(remaining).as("matching STOMP snapshot within %s", TIMEOUT).isPositive();
            JsonNode snapshot = frames.next(Duration.ofNanos(remaining));
            if ("SNAPSHOT".equals(snapshot.path("type").asText()) && condition.test(snapshot)) return snapshot;
        }
    }

    private static JsonNode awaitError(FrameCollector frames) throws Exception {
        JsonNode error = frames.next();
        assertThat(error.path("code").asText()).isNotBlank();
        return error;
    }

    private static void assertMembers(JsonNode snapshot, UUID... expectedIds) {
        assertThat(snapshot.path("onlineCount").asInt()).isEqualTo(expectedIds.length);
        List<String> memberIds = snapshot.path("users").findValuesAsText("userId");
        assertThat(memberIds).containsExactlyInAnyOrder(
                java.util.Arrays.stream(expectedIds).map(UUID::toString).toArray(String[]::new));
    }

    private static void assertStatus(JsonNode snapshot, UUID userId, String expectedStatus) {
        JsonNode member = snapshot.path("users").findParents("userId").stream()
                .filter(node -> userId.toString().equals(node.path("userId").asText()))
                .findFirst().orElseThrow();
        assertThat(member.path("status").asText()).isEqualTo(expectedStatus);
    }

    private static boolean hasMembers(JsonNode snapshot, UUID... expectedIds) {
        List<String> memberIds = snapshot.path("users").findValuesAsText("userId");
        return snapshot.path("onlineCount").asInt() == expectedIds.length
                && memberIds.size() == expectedIds.length
                && memberIds.containsAll(java.util.Arrays.stream(expectedIds).map(UUID::toString).toList());
    }

    private static boolean hasStatus(JsonNode snapshot, UUID userId, String expectedStatus) {
        return snapshot.path("users").findParents("userId").stream()
                .anyMatch(node -> userId.toString().equals(node.path("userId").asText())
                        && expectedStatus.equals(node.path("status").asText()));
    }

    private static RoomEntity room(UUID id, RoomVisibility visibility, int capacity,
                                   UserEntity owner, String inviteCode) {
        RoomEntity room = new RoomEntity();
        room.setId(id);
        room.setName("Integration room");
        room.setThemeKey("quiet");
        room.setVisibility(visibility);
        room.setMaxSlots(capacity);
        room.setActive(true);
        room.setOwner(owner);
        room.setInviteCode(inviteCode);
        return room;
    }

    private UserEntity user(String displayName) {
        return userWithId(UUID.randomUUID(), displayName);
    }

    private static UserEntity userWithId(UUID id, String displayName) {
        UserEntity user = new UserEntity();
        user.setId(id);
        user.setEmail(displayName.toLowerCase() + "@example.test");
        user.setDisplayName(displayName);
        return user;
    }

    private record ConnectedSocket(StompSession session, FrameCollector presence,
                                   FrameCollector errors, FrameCollector room) {}

    private static final class FrameCollector implements StompFrameHandler {
        private final BlockingQueue<JsonNode> frames = new LinkedBlockingQueue<>();

        @Override
        public Type getPayloadType(StompHeaders headers) {
            return JsonNode.class;
        }

        @Override
        public void handleFrame(StompHeaders headers, Object payload) {
            frames.add((JsonNode) payload);
        }

        JsonNode next() throws Exception {
            return next(TIMEOUT);
        }

        JsonNode next(Duration timeout) throws Exception {
            JsonNode frame = frames.poll(timeout.toMillis(), TimeUnit.MILLISECONDS);
            assertThat(frame).as("STOMP frame within %s", TIMEOUT).isNotNull();
            return frame;
        }
    }

    @Configuration
    @EnableAutoConfiguration(exclude = {
            DataSourceAutoConfiguration.class,
            HibernateJpaAutoConfiguration.class,
            JpaRepositoriesAutoConfiguration.class
    })
    @ComponentScan(basePackageClasses = PresenceRegistry.class)
    @Import({WebSocketConfig.class, SecurityConfig.class, JwtTokenProvider.class})
    static class TestApplication {}
}
