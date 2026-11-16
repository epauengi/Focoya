package com.lofi.studyroombackend.service;

import com.lofi.studyroombackend.entity.GamificationProfileEntity;
import com.lofi.studyroombackend.entity.UserEntity;
import com.lofi.studyroombackend.event.StudySessionCompletedEvent;
import com.lofi.studyroombackend.repository.GamificationProfileRepository;
import com.lofi.studyroombackend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Unit test thuần cho XP hook: không chạy Spring, không cần DB.
class GamificationEventListenerTest {

    private GamificationProfileRepository gamificationProfileRepository;
    private UserRepository userRepository;
    private GamificationEventListener listener;

    private UserEntity user;

    @BeforeEach
    void setUp() {
        gamificationProfileRepository = mock(GamificationProfileRepository.class);
        userRepository = mock(UserRepository.class);
        listener = new GamificationEventListener(gamificationProfileRepository, userRepository);

        user = new UserEntity();
        user.setId(UUID.randomUUID());
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
    }

    private StudySessionCompletedEvent completedEvent(int minutes) {
        return new StudySessionCompletedEvent(UUID.randomUUID(), user.getId(), minutes, minutes);
    }

    @Test
    void addsXpToExistingProfile() {
        GamificationProfileEntity profile = new GamificationProfileEntity();
        profile.setUser(user);
        profile.setTotalXp(100);
        when(gamificationProfileRepository.findByUserId(user.getId())).thenReturn(Optional.of(profile));

        listener.onStudySessionCompleted(completedEvent(25));

        assertEquals(125, profile.getTotalXp());
        verify(gamificationProfileRepository).save(profile);
    }

    @Test
    void createsProfileWhenUserHasNone() {
        when(gamificationProfileRepository.findByUserId(user.getId())).thenReturn(Optional.empty());

        listener.onStudySessionCompleted(completedEvent(25));

        ArgumentCaptor<GamificationProfileEntity> captor = ArgumentCaptor.forClass(GamificationProfileEntity.class);
        verify(gamificationProfileRepository).save(captor.capture());
        assertSame(user, captor.getValue().getUser());
        assertEquals(25, captor.getValue().getTotalXp());
    }
}
