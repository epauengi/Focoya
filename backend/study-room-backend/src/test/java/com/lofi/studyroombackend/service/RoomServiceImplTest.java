package com.lofi.studyroombackend.service;

import com.lofi.studyroombackend.dto.request.CreateRoomRequest;
import com.lofi.studyroombackend.dto.response.RoomResponse;
import com.lofi.studyroombackend.entity.RoomEntity;
import com.lofi.studyroombackend.entity.UserEntity;
import com.lofi.studyroombackend.entity.enums.RoomVisibility;
import com.lofi.studyroombackend.realtime.PresenceRegistry;
import com.lofi.studyroombackend.repository.RoomRepository;
import com.lofi.studyroombackend.repository.UserRepository;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.web.server.ResponseStatusException;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RoomServiceImplTest {

    private RoomRepository roomRepository;
    private UserRepository userRepository;
    private PresenceRegistry presenceRegistry;
    private RecordingTransactionManager transactionManager;
    private RoomServiceImpl service;
    private UserEntity owner;

    @BeforeEach
    void setUp() {
        roomRepository = mock(RoomRepository.class);
        userRepository = mock(UserRepository.class);
        presenceRegistry = new PresenceRegistry();
        transactionManager = new RecordingTransactionManager();
        service = new RoomServiceImpl(roomRepository, userRepository, presenceRegistry, transactionManager);

        owner = new UserEntity();
        owner.setId(UUID.randomUUID());
        owner.setEmail("owner@example.test");
        owner.setDisplayName("Owner");

        when(userRepository.findByIdForUpdate(owner.getId())).thenReturn(Optional.of(owner));
        when(roomRepository.existsByInviteCode(anyString())).thenReturn(false);
        when(roomRepository.saveAndFlush(any(RoomEntity.class))).thenAnswer(call -> {
            RoomEntity entity = call.getArgument(0);
            if (entity.getId() == null) {
                entity.setId(UUID.randomUUID());
            }
            return entity;
        });
    }

    @Test
    void getMyPrivateRoomsReturnsOwnedActivePrivateRoomsInRepositoryOrderWithOwnerInviteCode() {
        RoomEntity first = privateRoom(owner, "Alpha Room", "AAA111", 10);
        RoomEntity second = privateRoom(owner, "Beta Room", "BBB222", 12);
        presenceRegistry.join("s1", second.getId(), UUID.randomUUID(), "Guest", null, 12);

        when(roomRepository.findActiveOwnedRooms(owner.getId(), RoomVisibility.PRIVATE))
                .thenReturn(List.of(first, second));

        List<RoomResponse> result = service.getMyPrivateRooms(owner.getId());

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getId()).isEqualTo(first.getId());
        assertThat(result.get(0).getInviteCode()).isEqualTo("AAA111");
        assertThat(result.get(0).getOnline()).isZero();
        assertThat(result.get(1).getId()).isEqualTo(second.getId());
        assertThat(result.get(1).getInviteCode()).isEqualTo("BBB222");
        assertThat(result.get(1).getOnline()).isEqualTo(1);
        assertThat(result).allMatch(room -> "PRIVATE".equals(room.getVisibility()));
        verify(roomRepository).findActiveOwnedRooms(owner.getId(), RoomVisibility.PRIVATE);
    }

    @Test
    void createPrivateRoomLocksUserBeforeCountingAndRejectsWhenAtLimit() {
        when(roomRepository.countByOwnerIdAndVisibilityAndActiveTrue(owner.getId(), RoomVisibility.PRIVATE))
                .thenReturn(1L);

        RoomResponse created = service.createPrivateRoom(validCreateRequest("Study Pod", 10), owner.getId());

        assertThat(created.getVisibility()).isEqualTo("PRIVATE");
        assertThat(created.getInviteCode()).matches("^[A-Z0-9]{6}$");
        assertThat(created.getImage()).isEqualTo("/room-assets/rainy.jpg");

        InOrder order = inOrder(userRepository, roomRepository);
        order.verify(userRepository).findByIdForUpdate(owner.getId());
        order.verify(roomRepository).countByOwnerIdAndVisibilityAndActiveTrue(owner.getId(), RoomVisibility.PRIVATE);
        order.verify(roomRepository).saveAndFlush(any(RoomEntity.class));

        when(roomRepository.countByOwnerIdAndVisibilityAndActiveTrue(owner.getId(), RoomVisibility.PRIVATE))
                .thenReturn(2L);
        assertThatThrownBy(() -> service.createPrivateRoom(validCreateRequest("Third Room", 10), owner.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void concurrentCreatePrivateRoomsSerializeOnUserLockAndNeverExceedTwoActiveRooms() throws Exception {
        ReentrantLock dbUserRowLock = new ReentrantLock(true);
        AtomicInteger committedOwnedRooms = new AtomicInteger(1);
        CountDownLatch bothThreadsEnteredCreate = new CountDownLatch(2);

        PlatformTransactionManager lockingTxManager = new PlatformTransactionManager() {
            @Override
            public TransactionStatus getTransaction(TransactionDefinition definition) {
                return new SimpleTransactionStatus();
            }

            @Override
            public void commit(TransactionStatus status) {
                if (dbUserRowLock.isHeldByCurrentThread()) {
                    dbUserRowLock.unlock();
                }
            }

            @Override
            public void rollback(TransactionStatus status) {
                if (dbUserRowLock.isHeldByCurrentThread()) {
                    dbUserRowLock.unlock();
                }
            }
        };

        RoomServiceImpl concurrentService = new RoomServiceImpl(
                roomRepository, userRepository, presenceRegistry, lockingTxManager);

        when(userRepository.findByIdForUpdate(owner.getId())).thenAnswer(call -> {
            bothThreadsEnteredCreate.countDown();
            dbUserRowLock.lock();
            return Optional.of(owner);
        });
        when(roomRepository.countByOwnerIdAndVisibilityAndActiveTrue(owner.getId(), RoomVisibility.PRIVATE))
                .thenAnswer(call -> (long) committedOwnedRooms.get());
        when(roomRepository.saveAndFlush(any(RoomEntity.class))).thenAnswer(call -> {
            RoomEntity entity = call.getArgument(0);
            entity.setId(UUID.randomUUID());
            committedOwnedRooms.incrementAndGet();
            return entity;
        });

        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Boolean> task = () -> {
                try {
                    concurrentService.createPrivateRoom(validCreateRequest("Concurrent", 10), owner.getId());
                    return true;
                } catch (ResponseStatusException ex) {
                    assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                    return false;
                }
            };
            var f1 = executor.submit(task);
            var f2 = executor.submit(task);
            assertThat(bothThreadsEnteredCreate.await(5, TimeUnit.SECONDS)).isTrue();
            int successes = (f1.get(5, TimeUnit.SECONDS) ? 1 : 0) + (f2.get(5, TimeUnit.SECONDS) ? 1 : 0);
            assertThat(successes).isEqualTo(1);
            assertThat(committedOwnedRooms.get()).isEqualTo(2);
        }
    }

    @Test
    void createPrivateRoomRetriesInviteCollisionInFreshTransactionWithoutSchemaChanges() {
        when(roomRepository.countByOwnerIdAndVisibilityAndActiveTrue(owner.getId(), RoomVisibility.PRIVATE))
                .thenReturn(0L);
        DataIntegrityViolationException uniqueCollision = new DataIntegrityViolationException(
                "could not execute statement",
                new ConstraintViolationException(
                        "duplicate key value violates unique constraint",
                        new SQLException("ERROR: duplicate key value violates unique constraint \"ukkhtp891c64djg4uv3cs15br74\"\n  Detail: Key (invite_code)=(ABC123) already exists.", "23505"),
                        "ukkhtp891c64djg4uv3cs15br74"));

        AtomicInteger saveAttempts = new AtomicInteger();
        when(roomRepository.saveAndFlush(any(RoomEntity.class))).thenAnswer(call -> {
            if (saveAttempts.incrementAndGet() == 1) {
                throw uniqueCollision;
            }
            RoomEntity entity = call.getArgument(0);
            entity.setId(UUID.randomUUID());
            return entity;
        });

        RoomResponse response = service.createPrivateRoom(validCreateRequest("Retry Room", 15), owner.getId());

        assertThat(response.getInviteCode()).matches("^[A-Z0-9]{6}$");
        assertThat(saveAttempts.get()).isEqualTo(2);
        assertThat(transactionManager.rollbacks.get()).isEqualTo(1);
        assertThat(transactionManager.commits.get()).isEqualTo(1);
        verify(userRepository, times(2)).findByIdForUpdate(owner.getId());
    }

    @Test
    void createPrivateRoomStopsRetryingAfterBoundedInviteCollisionLimitAndDoesNotSwallowOtherErrors() {
        when(roomRepository.countByOwnerIdAndVisibilityAndActiveTrue(owner.getId(), RoomVisibility.PRIVATE))
                .thenReturn(0L);
        DataIntegrityViolationException inviteCollision = new DataIntegrityViolationException(
                "Key (invite_code)=(ABC123) already exists");
        when(roomRepository.saveAndFlush(any(RoomEntity.class))).thenThrow(inviteCollision);

        assertThatThrownBy(() -> service.createPrivateRoom(validCreateRequest("Always Collides", 10), owner.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        assertThat(transactionManager.rollbacks.get()).isEqualTo(5);

        // Unrelated 23505 unique constraint (e.g. rooms_pkey) must NOT be retried as invite_code collision.
        DataIntegrityViolationException unrelatedUnique = new DataIntegrityViolationException(
                "could not execute statement",
                new ConstraintViolationException(
                        "duplicate key value violates unique constraint",
                        new SQLException("ERROR: duplicate key value violates unique constraint \"rooms_pkey\"\n  Detail: Key (id)=(123) already exists.", "23505"),
                        "rooms_pkey"));
        when(roomRepository.saveAndFlush(any(RoomEntity.class))).thenThrow(unrelatedUnique);

        assertThatThrownBy(() -> service.createPrivateRoom(validCreateRequest("Other Unique", 10), owner.getId()))
                .isSameAs(unrelatedUnique);
        assertThat(transactionManager.rollbacks.get()).isEqualTo(6);

        DataIntegrityViolationException otherConstraint = new DataIntegrityViolationException("not-null constraint on name");
        when(roomRepository.saveAndFlush(any(RoomEntity.class))).thenThrow(otherConstraint);

        assertThatThrownBy(() -> service.createPrivateRoom(validCreateRequest("Other Error", 10), owner.getId()))
                .isSameAs(otherConstraint);
    }

    @Test
    void productionConstructorRequiresNonNullTransactionManager() {
        assertThatThrownBy(() -> new RoomServiceImpl(roomRepository, userRepository, presenceRegistry, null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void createPrivateRoomBoundsPreCheckExistsLoop() {
        when(roomRepository.countByOwnerIdAndVisibilityAndActiveTrue(owner.getId(), RoomVisibility.PRIVATE))
                .thenReturn(0L);
        when(roomRepository.existsByInviteCode(anyString())).thenReturn(true);

        assertThatThrownBy(() -> service.createPrivateRoom(validCreateRequest("Exhausted", 10), owner.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        verify(roomRepository, times(10)).existsByInviteCode(anyString());
        verify(roomRepository, never()).saveAndFlush(any());
    }

    @Test
    void joinByInviteCodeValidatesSixAlphanumericTrimUppercaseAndAllowsPresentUserWhenFull() {
        UUID guestId = UUID.randomUUID();
        UUID outsiderId = UUID.randomUUID();
        RoomEntity room = privateRoom(owner, "Full Private", "ABC123", 1);
        when(roomRepository.findByInviteCode("ABC123")).thenReturn(Optional.of(room));

        for (String invalid : List.of("", "   ", "ABC12", "ABC1234", "AB-123", "AB 123", "ÄBC123", "\u017FBC123", "\u212ABC123")) {
            assertThatThrownBy(() -> service.joinByInviteCode(invalid, guestId))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        }
        assertThatThrownBy(() -> service.joinByInviteCode(null, guestId))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(roomRepository, never()).findByInviteCode(anyString());

        presenceRegistry.join("guest-socket", room.getId(), guestId, "Guest", null, 1);

        // Outsider rejected because room is full (1/1)
        assertThatThrownBy(() -> service.joinByInviteCode("  abc123 ", outsiderId))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));

        // Same already-present user allowed even while online == maxSlots, and inviteCode remains masked for non-owner
        RoomResponse guestPreview = service.joinByInviteCode("  abc123 ", guestId);
        assertThat(guestPreview.getId()).isEqualTo(room.getId());
        assertThat(guestPreview.getOnline()).isEqualTo(1);
        assertThat(guestPreview.getInviteCode()).isNull();

        // Owner sees inviteCode even if present/full
        presenceRegistry.leave("guest-socket", room.getId());
        presenceRegistry.join("owner-socket", room.getId(), owner.getId(), "Owner", null, 1);
        RoomResponse ownerPreview = service.joinByInviteCode("abc123", owner.getId());
        assertThat(ownerPreview.getInviteCode()).isEqualTo("ABC123");
    }

    @Test
    void getRoomPreservesDirectUuidOwnerOnlyDetailAndPublicAnonymousAccess() {
        RoomEntity priv = privateRoom(owner, "Secret", "XYZ789", 10);
        RoomEntity pub = new RoomEntity();
        pub.setId(UUID.randomUUID());
        pub.setName("Public Lounge");
        pub.setThemeKey("Chill");
        pub.setVisibility(RoomVisibility.PUBLIC);
        pub.setMaxSlots(20);
        pub.setActive(true);

        when(roomRepository.findById(priv.getId())).thenReturn(Optional.of(priv));
        when(roomRepository.findById(pub.getId())).thenReturn(Optional.of(pub));

        assertThatThrownBy(() -> service.getRoom(priv.getId(), null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
        assertThatThrownBy(() -> service.getRoom(priv.getId(), UUID.randomUUID()))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));

        RoomResponse ownerDetail = service.getRoom(priv.getId(), owner.getId());
        assertThat(ownerDetail.getInviteCode()).isEqualTo("XYZ789");

        RoomResponse publicDetail = service.getRoom(pub.getId(), null);
        assertThat(publicDetail.getInviteCode()).isNull();
        assertThat(publicDetail.getVisibility()).isEqualTo("PUBLIC");
    }

    private static CreateRoomRequest validCreateRequest(String name, int maxSlots) {
        CreateRoomRequest request = new CreateRoomRequest();
        request.setName(name);
        request.setDescription("Quiet study");
        request.setTheme("Study");
        request.setMaxSlots(maxSlots);
        return request;
    }

    private static RoomEntity privateRoom(UserEntity owner, String name, String inviteCode, int maxSlots) {
        RoomEntity room = new RoomEntity();
        room.setId(UUID.randomUUID());
        room.setOwner(owner);
        room.setName(name);
        room.setThemeKey("Study");
        room.setSceneKey("/room-assets/rainy.jpg");
        room.setVisibility(RoomVisibility.PRIVATE);
        room.setInviteCode(inviteCode);
        room.setMaxSlots(maxSlots);
        room.setActive(true);
        return room;
    }

    private static final class RecordingTransactionManager implements PlatformTransactionManager {
        private final AtomicInteger commits = new AtomicInteger();
        private final AtomicInteger rollbacks = new AtomicInteger();

        @Override
        public TransactionStatus getTransaction(TransactionDefinition definition) {
            return new SimpleTransactionStatus();
        }

        @Override
        public void commit(TransactionStatus status) {
            commits.incrementAndGet();
        }

        @Override
        public void rollback(TransactionStatus status) {
            rollbacks.incrementAndGet();
        }
    }
}
