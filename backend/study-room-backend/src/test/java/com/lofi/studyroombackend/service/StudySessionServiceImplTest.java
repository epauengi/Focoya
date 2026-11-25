package com.lofi.studyroombackend.service;

import com.lofi.studyroombackend.dto.request.StartStudySessionRequest;
import com.lofi.studyroombackend.dto.response.StudySessionResponse;
import com.lofi.studyroombackend.entity.RoomEntity;
import com.lofi.studyroombackend.entity.StudySessionEntity;
import com.lofi.studyroombackend.entity.UserEntity;
import com.lofi.studyroombackend.entity.enums.StudySessionStatus;
import com.lofi.studyroombackend.event.StudySessionCompletedEvent;
import com.lofi.studyroombackend.repository.RoomRepository;
import com.lofi.studyroombackend.repository.StudySessionRepository;
import com.lofi.studyroombackend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Unit test thuần: không chạy Spring, không cần DB.
// Repository và eventPublisher là "đồ giả" (mock) của Mockito: mình quy định chúng trả về gì,
// rồi kiểm tra service xử lý đúng luật hay không.
class StudySessionServiceImplTest {

    private StudySessionRepository studySessionRepository;
    private RoomRepository roomRepository;
    private UserRepository userRepository;
    private ApplicationEventPublisher eventPublisher;
    private StudySessionServiceImpl service;

    private UserEntity user;
    private RoomEntity room;

    @BeforeEach
    void setUp() {
        studySessionRepository = mock(StudySessionRepository.class);
        roomRepository = mock(RoomRepository.class);
        userRepository = mock(UserRepository.class);
        eventPublisher = mock(ApplicationEventPublisher.class);
        service = new StudySessionServiceImpl(studySessionRepository, roomRepository, userRepository, eventPublisher);

        user = new UserEntity();
        user.setId(UUID.randomUUID());
        room = new RoomEntity();
        room.setId(UUID.randomUUID());

        when(userRepository.findByIdForUpdate(user.getId())).thenReturn(Optional.of(user));
        when(roomRepository.findById(room.getId())).thenReturn(Optional.of(room));
        // Mặc định: user chưa có phiên nào đang chạy.
        when(studySessionRepository.findFirstByUserIdAndStatusOrderByStartedAtDesc(
                user.getId(), StudySessionStatus.IN_PROGRESS)).thenReturn(Optional.empty());
        // save / saveAndFlush giả: trả lại đúng object được đưa vào.
        when(studySessionRepository.save(any(StudySessionEntity.class))).thenAnswer(call -> call.getArgument(0));
        when(studySessionRepository.saveAndFlush(any(StudySessionEntity.class))).thenAnswer(call -> call.getArgument(0));
    }

    // Giả lập user đang có 1 phiên đã chạy được `minutes` phút (cộng thêm 10 giây cho chắc chắn qua mốc phút).
    private StudySessionEntity givenRunningSession(int minutes) {
        StudySessionEntity session = new StudySessionEntity();
        session.setId(UUID.randomUUID());
        session.setUser(user);
        session.setRoom(room);
        session.setStartedAt(Instant.now().minusSeconds(minutes * 60L + 10));
        when(studySessionRepository.findFirstByUserIdAndStatusOrderByStartedAtDesc(
                user.getId(), StudySessionStatus.IN_PROGRESS)).thenReturn(Optional.of(session));
        return session;
    }

    private StartStudySessionRequest startRequest(UUID roomId) {
        StartStudySessionRequest request = new StartStudySessionRequest();
        request.setRoomId(roomId);
        return request;
    }

    @Test
    void start_createsSessionInProgress() {
        StudySessionResponse response = service.start(startRequest(room.getId()), user.getId());

        assertEquals("IN_PROGRESS", response.getStatus());
        assertEquals(user.getId(), response.getUserId());
        assertEquals(room.getId(), response.getRoomId());
        assertNotNull(response.getStartedAt());
        assertNull(response.getEndedAt());
        assertEquals(0, response.getXpEarned());
    }

    @Test
    void start_roomClosed_returns404() {
        room.setActive(false);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.start(startRequest(room.getId()), user.getId()));

        assertEquals(404, ex.getStatusCode().value());
        verify(studySessionRepository, never()).save(any(StudySessionEntity.class));
    }

    @Test
    void start_whenOldSessionStillRunning_closesItFirst() {
        StudySessionEntity oldSession = givenRunningSession(30);

        StudySessionResponse response = service.start(startRequest(room.getId()), user.getId());

        // Phiên cũ được chốt theo luật của finish: 30 phút -> COMPLETED, 30 XP, có phát tin báo.
        assertEquals(StudySessionStatus.COMPLETED, oldSession.getStatus());
        assertEquals(30, oldSession.getXpEarned());
        verify(eventPublisher).publishEvent(any(StudySessionCompletedEvent.class));
        // Phiên trả về là phiên MỚI.
        assertEquals("IN_PROGRESS", response.getStatus());
    }

    @Test
    void finish_noRunningSession_returns404() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.finish(user.getId()));

        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    void finish_under5Minutes_cancelledWithoutXp() {
        givenRunningSession(4);

        StudySessionResponse response = service.finish(user.getId());

        assertEquals("CANCELLED", response.getStatus());
        assertEquals(4, response.getDurationMinutes());
        assertEquals(0, response.getXpEarned());
        assertNotNull(response.getEndedAt());
        // Không có XP thì không được phát tin báo.
        verify(eventPublisher, never()).publishEvent(any(StudySessionCompletedEvent.class));
    }

    @Test
    void finish_exactly5Minutes_completed() {
        givenRunningSession(5);

        StudySessionResponse response = service.finish(user.getId());

        assertEquals("COMPLETED", response.getStatus());
        assertEquals(5, response.getXpEarned());
    }

    @Test
    void finish_30Minutes_completedAndPublishesEventWith30Xp() {
        StudySessionEntity session = givenRunningSession(30);

        StudySessionResponse response = service.finish(user.getId());

        assertEquals("COMPLETED", response.getStatus());
        assertEquals(30, response.getDurationMinutes());
        assertEquals(30, response.getXpEarned());

        // Bắt lấy tin báo đã phát để xem nội dung bên trong.
        ArgumentCaptor<StudySessionCompletedEvent> captor = ArgumentCaptor.forClass(StudySessionCompletedEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertEquals(session.getId(), captor.getValue().getSessionId());
        assertEquals(user.getId(), captor.getValue().getUserId());
        assertEquals(30, captor.getValue().getDurationMinutes());
        assertEquals(30, captor.getValue().getXpEarned());
    }

    @Test
    void finish_longerThan60Minutes_cappedAt60() {
        givenRunningSession(600); // quên bấm kết thúc 10 tiếng

        StudySessionResponse response = service.finish(user.getId());

        assertEquals("COMPLETED", response.getStatus());
        assertEquals(60, response.getDurationMinutes());
        assertEquals(60, response.getXpEarned());
    }

    @Test
    void finish_userDeleted_returns401() {
        UUID deletedUserId = UUID.randomUUID();
        when(userRepository.findByIdForUpdate(deletedUserId)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.finish(deletedUserId));

        assertEquals(401, ex.getStatusCode().value());
    }
}
