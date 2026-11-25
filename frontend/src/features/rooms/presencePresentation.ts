import type { PresenceSnapshot, PresenceUser } from './realtime';

export type PresencePresentation = {
  roomId: string;
  revision: number;
  users: PresenceUser[];
  entered: string[];
  exited: { user: PresenceUser; index: number }[];
};

const userKey = (user: PresenceUser) => user.userId.toLowerCase();

export function projectPresence(previous: PresencePresentation | null, snapshot: PresenceSnapshot): PresencePresentation {
  const usersById = new Map<string, PresenceUser>();
  for (const user of snapshot.users) {
    const key = userKey(user);
    if (!usersById.has(key)) usersById.set(key, user);
  }

  if (!previous || previous.roomId.toLowerCase() !== snapshot.roomId.toLowerCase()) {
    return { roomId: snapshot.roomId, revision: snapshot.revision, users: [...usersById.values()], entered: [], exited: [] };
  }

  if (snapshot.revision < previous.revision) return { ...previous, entered: [], exited: [] };

  const previousIds = new Set(previous.users.map(userKey));
  const retained = previous.users.flatMap((user) => {
    const updated = usersById.get(userKey(user));
    return updated ? [updated] : [];
  });
  const joined = [...usersById.values()].filter((user) => !previousIds.has(userKey(user)));
  const exited = previous.users.flatMap((user, index) => usersById.has(userKey(user)) ? [] : [{ user, index }]);

  return {
    roomId: snapshot.roomId,
    revision: snapshot.revision,
    users: [...retained, ...joined],
    entered: joined.map((user) => user.userId),
    exited,
  };
}
