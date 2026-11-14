package com.lofi.studyroombackend.realtime;

import com.lofi.studyroombackend.entity.RoomEntity;
import com.lofi.studyroombackend.entity.UserEntity;
import com.lofi.studyroombackend.entity.enums.RoomVisibility;
import com.lofi.studyroombackend.repository.RoomRepository;
import com.lofi.studyroombackend.repository.UserRepository;
import com.lofi.studyroombackend.service.RoomServiceImpl;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class RoomOnlineCountTest {
    @Test
    void privatePreviewRemainsOwnerOnlyAndInviteCodeRemainsHiddenFromGuests() {
        var rooms = mock(RoomRepository.class);
        var presence = new PresenceRegistry();
        var service = new RoomServiceImpl(rooms, mock(UserRepository.class), presence);
        var owner = new UserEntity();
        owner.setId(UUID.randomUUID());
        var room = new RoomEntity();
        room.setId(UUID.randomUUID());
        room.setOwner(owner);
        room.setVisibility(RoomVisibility.PRIVATE);
        room.setInviteCode("ABC123");
        room.setMaxSlots(10);
        when(rooms.findById(room.getId())).thenReturn(Optional.of(room));
        when(rooms.findByInviteCode("ABC123")).thenReturn(Optional.of(room));
        assertThatExceptionOfType(org.springframework.web.server.ResponseStatusException.class)
                .isThrownBy(() -> service.getRoom(room.getId(), UUID.randomUUID()))
                .satisfies(error -> assertThat(error.getStatusCode())
                        .isEqualTo(org.springframework.http.HttpStatus.FORBIDDEN));
        assertThat(service.getRoom(room.getId(), owner.getId()).getInviteCode()).isEqualTo("ABC123");
        assertThat(service.joinByInviteCode("ABC123", UUID.randomUUID()).getInviteCode()).isNull();
        room.setActive(false);
        assertThatThrownBy(() -> service.getRoom(room.getId(), owner.getId()))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    }

    @Test
    void existingRoomApisReadPresenceWithoutWritingMembershipToDatabase() {
        var rooms = mock(RoomRepository.class);
        var users = mock(UserRepository.class);
        var presence = new PresenceRegistry();
        var service = new RoomServiceImpl(rooms, users, presence);
        var room = new RoomEntity();
        room.setId(UUID.randomUUID());
        room.setVisibility(RoomVisibility.PUBLIC);
        room.setMaxSlots(1);
        room.setActive(true);
        when(rooms.findById(room.getId())).thenReturn(Optional.of(room));
        when(rooms.searchActiveRooms(RoomVisibility.PUBLIC, "", "")).thenReturn(List.of(room));
        when(rooms.findByInviteCode("ABC123")).thenReturn(Optional.of(room));
        var owner = new UserEntity();
        owner.setId(UUID.randomUUID());
        presence.join("socket", room.getId(), owner.getId(), "Name", null, 1);
        assertThat(service.getPublicRooms(null, null).getFirst().getOnline()).isEqualTo(1);
        assertThat(service.getRoom(room.getId(), null).getOnline()).isEqualTo(1);
        assertThatThrownBy(() -> service.joinByInviteCode("abc123", UUID.randomUUID()))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        presence.disconnect("socket");
        assertThat(service.getRoom(room.getId(), null).getOnline()).isZero();
        assertThat(service.joinByInviteCode("abc123", owner.getId()).getOnline()).isZero();
        verify(rooms, never()).save(any());
        verifyNoInteractions(users);
    }
}
