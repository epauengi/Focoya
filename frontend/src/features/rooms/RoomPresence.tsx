import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { getAccessToken, getSession, subscribeSession } from '../../auth/session';
import { ProfileAvatar } from '../profile/ProfileAvatar';
import { createRoomPresence, type PresenceState, type PresenceStatus, type PresenceUser } from './realtime';
import { projectPresence, type PresencePresentation } from './presencePresentation';
import './room-presence.css';

const initialState: PresenceState = {
  connection: 'connecting', snapshot: null, error: '', errorCode: null,
};
const connectionLabels = {
  connecting: 'Đang vào phòng…', reconnecting: 'Mất kết nối · Đang kết nối lại…',
  connected: 'Đã kết nối', disconnected: 'Đã ngắt kết nối', error: 'Chưa kết nối',
};
const statusLabels: Record<PresenceStatus, string> = {
  STUDYING: 'Đang học', BREAK: 'Đang nghỉ', IDLE: 'Chưa bắt đầu',
};
const seatLimit = 3;
type Motion = {
  joining: Map<string, number>;
  leaving: { user: PresenceUser; offset: number; revision: number }[];
};
const noMotion: Motion = { joining: new Map(), leaving: [] };
const identity = (user: PresenceUser) => user.userId.toLowerCase();
function visibleSeats(users: readonly PresenceUser[], selfId: string | undefined) {
  const self = users.find((user) => identity(user) === selfId);
  return self ? [self, ...users.filter((user) => user !== self).slice(0, seatLimit - 1)] : users.slice(0, seatLimit);
}

const motionQuery = '(prefers-reduced-motion: reduce)';
const prefersReducedMotion = () => matchMedia(motionQuery).matches;
function subscribeMotion(change: () => void) {
  const media = matchMedia(motionQuery);
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
}

function Seat({ user, self }: { user: PresenceUser; self: boolean }) {
  return <>
    <span className="focus-seat__portrait" data-self={self}>
      <ProfileAvatar className="focus-seat__avatar" avatarKey={user.avatarKey} displayName={user.displayName} />
    </span>
    <span className="focus-seat__name" title={user.displayName}>{self ? `Bạn · ${user.displayName}` : user.displayName}</span>
    <span className="focus-seat__status" data-status={user.status}>{statusLabels[user.status]}</span>
  </>;
}

export function RoomPresence({ roomId, maxSlots, children }: {
  roomId: string;
  maxSlots: number;
  children: (details: ReactNode, seats: ReactNode) => ReactNode;
}) {
  const session = useSyncExternalStore(subscribeSession, getSession);
  const reducedMotion = useSyncExternalStore(subscribeMotion, prefersReducedMotion, () => true);
  const [connection, setConnection] = useState<{ session: typeof session; presence: PresenceState; members: PresencePresentation | null }>({
    session, presence: initialState, members: null,
  });
  const [motion, setMotion] = useState(noMotion);
  const [attempt, setAttempt] = useState(0);
  const [inviteCode, setInviteCode] = useState('');
  const [submittedCode, setSubmittedCode] = useState('');
  const [paused, setPaused] = useState(false);
  const controller = useRef<ReturnType<typeof createRoomPresence> | null>(null);
  const panel = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const lastStatus = useRef<{ userId: string; status: PresenceStatus } | null>(null);
  const inviteId = useId();
  const statusId = useId();
  const panelId = useId();

  useEffect(() => { if (reducedMotion) setMotion(noMotion); }, [reducedMotion]);

  useEffect(() => {
    if (paused || session.status !== 'authenticated') return;
    let active = true;
    let client: ReturnType<typeof createRoomPresence>;
    let previous: PresencePresentation | null = null;
    const selfId = session.user?.id.toLowerCase();
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL;
      if (!apiBase) throw new Error('Missing API origin');
      const endpoint = new URL(apiBase);
      if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error('Invalid API origin');
      endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
      endpoint.pathname = '/ws-room';
      endpoint.search = '';
      endpoint.hash = '';
      client = createRoomPresence({
        roomId, userId: session.user?.id, inviteCode: submittedCode || undefined, url: endpoint.href,
        getToken: getAccessToken,
        onChange: (next) => {
          if (!active) return;
          const before = previous;
          const current = next.connection === 'connected' && next.snapshot ? projectPresence(before, next.snapshot) : null;
          previous = current;
          const self = current?.users.find((user) => identity(user) === selfId);
          if (self) lastStatus.current = { userId: self.userId, status: self.status };
          setConnection({ session, presence: next, members: current });
          if (!before || !current || prefersReducedMotion()) {
            setMotion(noMotion);
          } else if (current.entered.length || current.exited.length) {
            const visibleIds = new Set(visibleSeats(current.users, selfId).map(identity));
            const memberIds = new Set(current.users.map(identity));
            const oldSeats = visibleSeats(before.users, selfId);
            const oldSlots = Math.min(before.users.length, seatLimit + 1);
            setMotion((motion) => {
              const joining = new Map([...motion.joining].filter(([id]) => visibleIds.has(id)));
              for (const userId of current.entered) {
                const id = userId.toLowerCase();
                if (visibleIds.has(id)) joining.set(id, current.revision);
              }
              return {
                joining,
                leaving: [
                  ...motion.leaving.filter(({ user }) => !memberIds.has(identity(user))),
                  ...oldSeats.flatMap((user, index) => memberIds.has(identity(user)) ? [] : [{
                    user, offset: index - (oldSlots - 1) / 2, revision: current.revision,
                  }]),
                ],
              };
            });
          }
        },
      });
      controller.current = client;
      const saved = lastStatus.current;
      if (saved && saved.userId === session.user?.id) client.setStatus(saved.status);
      client.connect();
    } catch {
      setConnection({ session, members: null, presence: {
        connection: 'error', snapshot: null, error: 'Không thể kết nối. Kiểm tra VITE_API_BASE_URL và thử lại.', errorCode: null,
      } });
    }
    return () => {
      active = false;
      controller.current = null;
      client?.disconnect();
    };
    // Authentication publishes a new session on token refresh; replace the old socket.
  }, [roomId, submittedCode, attempt, paused, session]);

  const presence = connection.session === session ? connection.presence : initialState;
  const members = presence.connection === 'connected' && presence.snapshot ? connection.members : null;
  const users = members?.users ?? [];
  const selfId = session.user?.id.toLowerCase();
  const self = users.find((user) => identity(user) === selfId);
  const needsCode = presence.errorCode === 'FORBIDDEN' || presence.errorCode === 'INVALID_INVITE_CODE';
  const animation = reducedMotion || !members ? noMotion : motion;

  function showMembers() {
    if (panel.current) panel.current.open = true;
    summary.current?.focus();
  }

  function reconnect() {
    setConnection({ session, presence: initialState, members: null });
    setMotion(noMotion);
    setPaused(false);
    setAttempt((value) => value + 1);
  }

  const details = <>
    <span className="focus-sr-only" role="status">{connectionLabels[presence.connection]}</span>
    <details ref={panel} className="focus-presence" onKeyDown={(event) => {
      if (event.key !== 'Escape' || !panel.current?.open) return;
      panel.current.open = false;
      summary.current?.focus();
      event.stopPropagation();
    }}>
      <summary ref={summary} aria-controls={panelId}>
        <span className="focus-presence__signal" data-connected={Boolean(members)} aria-hidden="true" />
        <span>{members && presence.snapshot ? `${presence.snapshot.onlineCount}/${maxSlots} trong phòng` : connectionLabels[presence.connection]}</span>
      </summary>
      <section id={panelId} className="focus-presence__panel" aria-label="Thành viên phòng">
        <div className="focus-presence__heading">
          <h2>Thành viên phòng</h2>
          <span>{connectionLabels[presence.connection]}</span>
        </div>
        {presence.error && <p className="focus-presence__error" role="alert">{presence.error}</p>}
        {needsCode && <form onSubmit={(event) => {
          event.preventDefault();
          setSubmittedCode(inviteCode.trim().toUpperCase());
          reconnect();
        }}>
          <label htmlFor={inviteId}>Mã mời phòng riêng</label>
          <div className="focus-presence__invite">
            <input id={inviteId} value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} required minLength={6} maxLength={6} pattern="[A-Za-z0-9]{6}" autoComplete="off" autoCapitalize="characters" spellCheck={false} />
            <button type="submit">Vào phòng</button>
          </div>
        </form>}
        {members && <>
          {self && <>
            <label htmlFor={statusId}>Trạng thái của bạn</label>
            <select id={statusId} value={self.status} onChange={(event) => controller.current?.setStatus(event.target.value as PresenceStatus)}>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </>}
          <ul className="focus-presence__members">
            {users.map((user) => <li key={user.userId}>
              <ProfileAvatar className="focus-presence__avatar" avatarKey={user.avatarKey} displayName={user.displayName} />
              <span className="focus-presence__name">{user.displayName}{identity(user) === selfId ? ' (bạn)' : ''}</span>
              <span className="focus-presence__status">{statusLabels[user.status]}</span>
            </li>)}
          </ul>
        </>}
        <div className="focus-presence__actions">
          {presence.connection !== 'disconnected' && presence.connection !== 'error' ? <button type="button" onClick={() => {
            controller.current?.disconnect();
            setPaused(true);
          }}>Ngắt kết nối</button> : !needsCode && <button type="button" onClick={reconnect}>Kết nối lại</button>}
        </div>
      </section>
    </details>
  </>;

  const seats = members && users.length > 0 ? (
    <section className="focus-seats" aria-label="Chỗ ngồi trong phòng">
      <ul className="focus-seats__list">
        {visibleSeats(users, selfId).map((user) => {
          const id = identity(user);
          const enteredAt = animation.joining.get(id);
          return <li key={user.userId} className="focus-seat" data-entering={enteredAt !== undefined || undefined} onAnimationEnd={() => {
            setMotion((current) => {
              if (current.joining.get(id) !== enteredAt || enteredAt === undefined) return current;
              const joining = new Map(current.joining);
              joining.delete(id);
              return { ...current, joining };
            });
          }}><Seat user={user} self={id === selfId} /></li>;
        })}
        {users.length > seatLimit && <li className="focus-seat focus-seat--more">
          <button type="button" aria-controls={panelId} aria-label={`Xem tất cả thành viên, còn ${users.length - seatLimit} người`} onClick={showMembers}>+{users.length - seatLimit}</button>
        </li>}
      </ul>
      {animation.leaving.map(({ user, offset, revision }) => <div key={user.userId} className="focus-seat focus-seat--leaving" aria-hidden="true" style={{ '--seat-offset': offset } as CSSProperties} onAnimationEnd={() => {
        setMotion((current) => ({ ...current, leaving: current.leaving.filter((ghost) => identity(ghost.user) !== identity(user) || ghost.revision !== revision) }));
      }}><Seat user={user} self={identity(user) === selfId} /></div>)}
    </section>
  ) : null;

  return children(details, seats);
}
