package com.lofi.studyroombackend.realtime;

import java.util.List;
import java.util.UUID;

public record PresenceEvent(String type, UUID roomId, long revision, int onlineCount,
                            List<PresenceRegistry.Member> users) {
    public PresenceEvent {
        users = List.copyOf(users);
    }

    public static PresenceEvent from(PresenceRegistry.Snapshot snapshot) {
        return new PresenceEvent("SNAPSHOT", snapshot.roomId(), snapshot.revision(), snapshot.users().size(), snapshot.users());
    }
}
