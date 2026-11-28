package com.lofi.studyroombackend.realtime;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Component
public class PresenceRegistry {
    public enum Status { STUDYING, BREAK, IDLE }

    public record Member(UUID userId, String displayName, String avatarKey, Status status) {}
    public record Snapshot(UUID roomId, long revision, List<Member> users) {
        public Snapshot {
            users = List.copyOf(users);
        }
    }

    private record Location(UUID roomId, UUID userId) {}

    private static class Entry {
        private Member member;
        private final Set<String> sessions = new HashSet<>();

        private Entry(Member member) {
            this.member = member;
        }
    }

    // ponytail: single JVM only; use shared presence + broker before adding replicas.
    // One lock makes unique-user capacity checks and session cleanup atomic.
    private final Map<UUID, Map<UUID, Entry>> rooms = new HashMap<>();
    private final Map<String, Location> sessions = new HashMap<>();
    private long revision;

    public synchronized Snapshot join(String sessionId, UUID roomId, UUID userId,
                                      String displayName, String avatarKey, int maxSlots) {
        Objects.requireNonNull(sessionId);
        Objects.requireNonNull(roomId);
        Objects.requireNonNull(userId);
        Location current = sessions.get(sessionId);
        if (current != null) {
            if (!current.equals(new Location(roomId, userId))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "ALREADY_IN_ROOM");
            }
            return snapshot(roomId);
        }
        Map<UUID, Entry> members = rooms.get(roomId);
        if ((members == null || !members.containsKey(userId))
                && (members == null ? 0 : members.size()) >= maxSlots) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "ROOM_FULL");
        }
        members = rooms.computeIfAbsent(roomId, ignored -> new HashMap<>());
        Entry entry = members.computeIfAbsent(userId,
                ignored -> new Entry(new Member(userId, displayName, avatarKey, Status.IDLE)));
        entry.sessions.add(sessionId);
        sessions.put(sessionId, new Location(roomId, userId));
        revision++;
        return snapshot(roomId);
    }

    public synchronized Snapshot leave(String sessionId, UUID roomId) {
        Location location = sessions.get(sessionId);
        if (location == null || !location.roomId().equals(roomId)) {
            return null;
        }
        sessions.remove(sessionId);
        Map<UUID, Entry> members = rooms.get(roomId);
        Entry entry = members.get(location.userId());
        entry.sessions.remove(sessionId);
        if (entry.sessions.isEmpty()) {
            members.remove(location.userId());
        }
        if (members.isEmpty()) {
            rooms.remove(roomId);
        }
        revision++;
        return snapshot(roomId);
    }

    public synchronized Snapshot disconnect(String sessionId) {
        Location location = sessions.get(sessionId);
        return location == null ? null : leave(sessionId, location.roomId());
    }

    public synchronized Snapshot updateStatus(String sessionId, UUID roomId, Status status) {
        Objects.requireNonNull(status);
        if (!contains(sessionId, roomId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "NOT_JOINED");
        }
        Entry entry = rooms.get(roomId).get(sessions.get(sessionId).userId());
        Member previous = entry.member;
        if (previous.status() != status) {
            entry.member = new Member(previous.userId(), previous.displayName(), previous.avatarKey(), status);
            revision++;
        }
        return snapshot(roomId);
    }

    public synchronized boolean contains(String sessionId, UUID roomId) {
        Location location = sessions.get(sessionId);
        return location != null && location.roomId().equals(roomId);
    }

    public synchronized boolean containsUser(UUID roomId, UUID userId) {
        if (roomId == null || userId == null) {
            return false;
        }
        Map<UUID, Entry> members = rooms.get(roomId);
        return members != null && members.containsKey(userId);
    }

    public synchronized int countOnline(UUID roomId) {
        Map<UUID, Entry> members = rooms.get(roomId);
        return members == null ? 0 : members.size();
    }

    public synchronized Snapshot snapshot(UUID roomId) {
        Map<UUID, Entry> members = rooms.get(roomId);
        List<Member> users = members == null ? List.of() : members.values().stream()
                .map(entry -> entry.member)
                .sorted(java.util.Comparator.comparing(Member::userId))
                .toList();
        return new Snapshot(roomId, revision, users);
    }
}
