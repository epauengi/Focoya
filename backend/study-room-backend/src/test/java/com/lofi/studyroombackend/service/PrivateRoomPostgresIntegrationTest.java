package com.lofi.studyroombackend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lofi.studyroombackend.entity.RoomEntity;
import com.lofi.studyroombackend.entity.UserEntity;
import com.lofi.studyroombackend.entity.enums.RoomVisibility;
import com.lofi.studyroombackend.repository.RoomRepository;
import com.lofi.studyroombackend.repository.UserRepository;
import com.lofi.studyroombackend.security.JwtTokenProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class PrivateRoomPostgresIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private ObjectMapper objectMapper;

    private final List<UUID> createdUserIds = Collections.synchronizedList(new ArrayList<>());
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @AfterEach
    void cleanUp() {
        if (!createdUserIds.isEmpty()) {
            List<RoomEntity> ownedRooms = roomRepository.findAll().stream()
                    .filter(room -> room.getOwner() != null && createdUserIds.contains(room.getOwner().getId()))
                    .toList();
            roomRepository.deleteAll(ownedRooms);
            userRepository.deleteAllById(createdUserIds);
            createdUserIds.clear();
        }
    }

    @Test
    void concurrentCreatePrivateRoomsForSameUserEnforcesLimitTwoInRealPostgres() throws Exception {
        UserEntity owner = createPersistedUser("concurrent-" + UUID.randomUUID() + "@example.test", "Concurrent Owner");
        String token = jwtTokenProvider.generateAccessToken(owner);

        int threads = 4;
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch startGate = new CountDownLatch(1);
        List<Integer> statuses = new ArrayList<>();

        try (var executor = Executors.newFixedThreadPool(threads)) {
            List<Callable<HttpResponse<String>>> tasks = new ArrayList<>();
            for (int i = 0; i < threads; i++) {
                final int index = i;
                tasks.add(() -> {
                    String body = objectMapper.writeValueAsString(Map.of(
                            "name", "Concurrent Room " + index,
                            "description", "Postgres lock test",
                            "theme", "Study",
                            "maxSlots", 12
                    ));
                    HttpRequest req = HttpRequest.newBuilder()
                            .uri(URI.create(url("/api/rooms")))
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                            .header(HttpHeaders.CONTENT_TYPE, "application/json")
                            .POST(HttpRequest.BodyPublishers.ofString(body))
                            .build();
                    ready.countDown();
                    assertThat(startGate.await(5, TimeUnit.SECONDS)).isTrue();
                    return httpClient.send(req, HttpResponse.BodyHandlers.ofString());
                });
            }

            List<Future<HttpResponse<String>>> futures = new ArrayList<>();
            for (Callable<HttpResponse<String>> task : tasks) {
                futures.add(executor.submit(task));
            }
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            startGate.countDown();

            for (Future<HttpResponse<String>> future : futures) {
                HttpResponse<String> response = future.get(15, TimeUnit.SECONDS);
                statuses.add(response.statusCode());
                if (response.statusCode() == 201) {
                    assertThat(response.headers().firstValue(HttpHeaders.CACHE_CONTROL))
                            .isPresent()
                            .get()
                            .asString()
                            .contains("no-store");
                    Map<String, Object> payload = objectMapper.readValue(response.body(), new TypeReference<>() {});
                    assertThat((String) payload.get("inviteCode")).matches("^[A-Z0-9]{6}$");
                    assertThat(payload.get("visibility")).isEqualTo("PRIVATE");
                }
            }
        }

        assertThat(statuses.stream().filter(code -> code == 201).count()).isEqualTo(2);
        assertThat(statuses.stream().filter(code -> code == 400).count()).isEqualTo(2);
        assertThat(roomRepository.countByOwnerIdAndVisibilityAndActiveTrue(owner.getId(), RoomVisibility.PRIVATE))
                .isEqualTo(2L);
    }

    @Test
    void myRoomsFiltersOwnershipInactiveAndPreservesOrderAndInviteValidation() throws Exception {
        UserEntity userA = createPersistedUser("owner-a-" + UUID.randomUUID() + "@example.test", "Owner A");
        UserEntity userB = createPersistedUser("owner-b-" + UUID.randomUUID() + "@example.test", "Owner B");
        String tokenA = jwtTokenProvider.generateAccessToken(userA);
        String tokenB = jwtTokenProvider.generateAccessToken(userB);

        // User A creates two active private rooms sequentially (createdAt order: Zebra first, Alpha second).
        Map<String, Object> room1 = postCreateRoom(tokenA, "Zebra Pod", 10);
        Thread.sleep(20);
        Map<String, Object> room2 = postCreateRoom(tokenA, "Alpha Pod", 15);

        // Inactive private room for User A must NOT appear in /api/rooms/me or block limit once inactive.
        RoomEntity inactiveRoom = new RoomEntity();
        inactiveRoom.setOwner(userA);
        inactiveRoom.setName("Closed Pod");
        inactiveRoom.setThemeKey("Study");
        inactiveRoom.setSceneKey("/room-assets/rainy.jpg");
        inactiveRoom.setVisibility(RoomVisibility.PRIVATE);
        inactiveRoom.setInviteCode("CLS999");
        inactiveRoom.setMaxSlots(10);
        inactiveRoom.setActive(false);
        roomRepository.saveAndFlush(inactiveRoom);

        // Active private room for User B must NOT appear in User A's /api/rooms/me.
        Map<String, Object> userBRoom = postCreateRoom(tokenB, "User B Pod", 12);

        HttpRequest listAReq = HttpRequest.newBuilder()
                .uri(URI.create(url("/api/rooms/me")))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenA)
                .GET()
                .build();
        HttpResponse<String> listAResp = httpClient.send(listAReq, HttpResponse.BodyHandlers.ofString());
        assertThat(listAResp.statusCode()).isEqualTo(200);
        assertThat(listAResp.headers().firstValue(HttpHeaders.CACHE_CONTROL))
                .isPresent()
                .get()
                .asString()
                .contains("no-store");

        List<Map<String, Object>> roomsA = objectMapper.readValue(listAResp.body(), new TypeReference<>() {});
        assertThat(roomsA).hasSize(2);
        assertThat(roomsA.get(0).get("id")).isEqualTo(room1.get("id"));
        assertThat(roomsA.get(0).get("name")).isEqualTo("Zebra Pod");
        assertThat(roomsA.get(0).get("inviteCode")).isEqualTo(room1.get("inviteCode"));
        assertThat(roomsA.get(1).get("id")).isEqualTo(room2.get("id"));
        assertThat(roomsA.get(1).get("name")).isEqualTo("Alpha Pod");
        assertThat(roomsA.get(1).get("inviteCode")).isEqualTo(room2.get("inviteCode"));

        HttpRequest listBReq = HttpRequest.newBuilder()
                .uri(URI.create(url("/api/rooms/me")))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenB)
                .GET()
                .build();
        HttpResponse<String> listBResp = httpClient.send(listBReq, HttpResponse.BodyHandlers.ofString());
        assertThat(listBResp.statusCode()).isEqualTo(200);
        List<Map<String, Object>> roomsB = objectMapper.readValue(listBResp.body(), new TypeReference<>() {});
        assertThat(roomsB).hasSize(1);
        assertThat(roomsB.get(0).get("id")).isEqualTo(userBRoom.get("id"));

        // Direct UUID access by User B to User A's private room remains 403.
        HttpResponse<String> detailDenied = httpClient.send(HttpRequest.newBuilder()
                .uri(URI.create(url("/api/rooms/" + room1.get("id"))))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenB)
                .GET()
                .build(), HttpResponse.BodyHandlers.ofString());
        assertThat(detailDenied.statusCode()).isEqualTo(403);

        // Non-ASCII long s ('ſ') is rejected with 400 before uppercase normalization.
        String code1 = (String) room1.get("inviteCode");
        HttpResponse<String> unicodeReject = httpClient.send(HttpRequest.newBuilder()
                .uri(URI.create(url("/api/rooms/join/" + "%C5%BF" + code1.substring(1))))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenB)
                .GET()
                .build(), HttpResponse.BodyHandlers.ofString());
        assertThat(unicodeReject.statusCode()).isEqualTo(400);

        // Valid lowercase invite code works and masks inviteCode for non-owner.
        HttpResponse<String> joinResp = httpClient.send(HttpRequest.newBuilder()
                .uri(URI.create(url("/api/rooms/join/" + code1.toLowerCase())))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenB)
                .GET()
                .build(), HttpResponse.BodyHandlers.ofString());
        assertThat(joinResp.statusCode()).isEqualTo(200);
        assertThat(joinResp.headers().firstValue(HttpHeaders.CACHE_CONTROL))
                .isPresent()
                .get()
                .asString()
                .contains("no-store");
        Map<String, Object> joined = objectMapper.readValue(joinResp.body(), new TypeReference<>() {});
        assertThat(joined.get("id")).isEqualTo(room1.get("id"));
        assertThat(joined.get("inviteCode")).isNull();
    }

    private Map<String, Object> postCreateRoom(String token, String name, int maxSlots) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "name", name,
                "theme", "Study",
                "maxSlots", maxSlots
        ));
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url("/api/rooms")))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .header(HttpHeaders.CONTENT_TYPE, "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        assertThat(resp.statusCode()).isEqualTo(201);
        return objectMapper.readValue(resp.body(), new TypeReference<>() {});
    }

    private UserEntity createPersistedUser(String email, String displayName) {
        UserEntity user = new UserEntity();
        user.setEmail(email);
        user.setPasswordHash("$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummyha");
        user.setDisplayName(displayName);
        UserEntity saved = userRepository.saveAndFlush(user);
        createdUserIds.add(saved.getId());
        return saved;
    }

    private String url(String path) {
        return "http://localhost:" + port + path;
    }
}
