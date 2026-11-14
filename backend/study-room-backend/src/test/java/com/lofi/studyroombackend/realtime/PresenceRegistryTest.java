package com.lofi.studyroombackend.realtime;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;

class PresenceRegistryTest {
    private final PresenceRegistry registry = new PresenceRegistry();
    private final UUID room = UUID.randomUUID();
    private final UUID user = UUID.randomUUID();

    @Test
    void repeatedJoinAndMultipleTabsCountOneUserUntilLastDisconnect() {
        var first = registry.join("old", room, user, "Name", null, 1);
        assertThat(registry.join("old", room, user, "Name", null, 1)).isEqualTo(first);
        assertThat(registry.updateStatus("old", room, PresenceRegistry.Status.IDLE).revision())
                .isEqualTo(first.revision());
        registry.updateStatus("old", room, PresenceRegistry.Status.STUDYING);
        registry.join("new", room, user, "Name", null, 1);
        assertThat(registry.countOnline(room)).isEqualTo(1);
        assertThat(registry.disconnect("old").users()).singleElement()
                .extracting(PresenceRegistry.Member::status).isEqualTo(PresenceRegistry.Status.STUDYING);
        assertThat(registry.disconnect("old")).isNull();
        assertThat(registry.contains("new", room)).isTrue();
        assertThat(registry.disconnect("new").users()).isEmpty();
        assertThat(registry.countOnline(room)).isZero();
        var rejoined = registry.join("again", room, user, "Name", null, 1);
        assertThat(rejoined.revision()).isGreaterThan(first.revision());
        assertThat(rejoined.users()).singleElement()
                .extracting(PresenceRegistry.Member::status).isEqualTo(PresenceRegistry.Status.IDLE);
    }

    @Test
    void capacityAndRoomSwitchAreAtomicWithoutEvictingExistingPresence() {
        registry.join("one", room, user, "Name", null, 1);
        assertThatThrownBy(() -> registry.join("two", room, UUID.randomUUID(), "Other", null, 1))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("ROOM_FULL");
        assertThatThrownBy(() -> registry.join("one", UUID.randomUUID(), user, "Name", null, 2))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("ALREADY_IN_ROOM");
        assertThatThrownBy(() -> registry.join("one", room, UUID.randomUUID(), "Other", null, 2))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("ALREADY_IN_ROOM");
        assertThat(registry.leave("one", UUID.randomUUID())).isNull();
        assertThat(registry.countOnline(room)).isEqualTo(1);
        assertThat(registry.contains("two", room)).isFalse();
    }

    @Test
    void statusRequiresMembershipAndSnapshotsAreImmutable() {
        assertThatThrownBy(() -> registry.updateStatus("missing", room, PresenceRegistry.Status.BREAK))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("NOT_JOINED");
        var initial = registry.join("one", room, user, "Name", "avatar", 2);
        for (var status : PresenceRegistry.Status.values()) {
            var updated = registry.updateStatus("one", room, status);
            assertThat(updated.users()).singleElement().extracting(PresenceRegistry.Member::status).isEqualTo(status);
        }
        assertThat(initial.users()).singleElement()
                .extracting(PresenceRegistry.Member::status).isEqualTo(PresenceRegistry.Status.IDLE);
        assertThatThrownBy(() -> initial.users().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThat(registry.leave("one", room).users()).isEmpty();
        assertThat(registry.leave("one", room)).isNull();
        assertThatThrownBy(() -> registry.updateStatus("one", room, PresenceRegistry.Status.STUDYING))
                .hasMessageContaining("NOT_JOINED");
        assertThat(registry.snapshot(room).users()).isEmpty();
        assertThat(registry.countOnline(UUID.randomUUID())).isZero();
        assertThat(registry.disconnect("never-connected")).isNull();
    }

    @Test
    void leavingOneRoomCannotRemoveSameUsersOtherRoomSession() {
        UUID secondRoom = UUID.randomUUID();
        registry.join("first-room", room, user, "Name", null, 1);
        registry.join("second-room", secondRoom, user, "Name", null, 1);
        registry.disconnect("first-room");
        assertThat(registry.countOnline(room)).isZero();
        assertThat(registry.countOnline(secondRoom)).isEqualTo(1);
        assertThat(registry.contains("second-room", secondRoom)).isTrue();
    }

    @Test
    void concurrentReconnectAndOldDisconnectNeverRemoveNewSession() throws Exception {
        registry.join("old", room, user, "Name", null, 1);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var reconnect = executor.submit(() -> {
                assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();
                return registry.join("new", room, user, "Name", null, 1);
            });
            var disconnect = executor.submit(() -> {
                assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();
                return registry.disconnect("old");
            });
            start.countDown();
            reconnect.get(5, TimeUnit.SECONDS);
            disconnect.get(5, TimeUnit.SECONDS);
            assertThat(registry.countOnline(room)).isEqualTo(1);
            assertThat(registry.contains("new", room)).isTrue();
            assertThat(registry.disconnect("old")).isNull();
        }
    }

    @Test
    void concurrentJoinsNeverExceedUniqueUserCapacity() throws Exception {
        int capacity = 4;
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(12)) {
            var tasks = new ArrayList<Callable<Boolean>>();
            for (int i = 0; i < 12; i++) {
                String session = "session-" + i;
                tasks.add(() -> {
                    assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();
                    try {
                        registry.join(session, room, UUID.randomUUID(), "Name", null, capacity);
                        return true;
                    } catch (ResponseStatusException error) {
                        assertThat(error.getReason()).isEqualTo("ROOM_FULL");
                        return false;
                    }
                });
            }
            var futures = tasks.stream().map(executor::submit).toList();
            start.countDown();
            int admitted = 0;
            for (var future : futures) {
                if (future.get(5, TimeUnit.SECONDS)) admitted++;
            }
            assertThat(admitted).isEqualTo(capacity);
            assertThat(registry.countOnline(room)).isEqualTo(capacity);
        }
    }
}
