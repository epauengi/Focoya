import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { getAccessToken, getSession, subscribeSession } from '../../auth/session';
import { createRoomPresence, type PresenceState, type PresenceStatus } from './realtime';
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

export function RoomPresence({ roomId }: { roomId: string }) {
  const session = useSyncExternalStore(subscribeSession, getSession);
  const [presence, setPresence] = useState(initialState);
  const [attempt, setAttempt] = useState(0);
  const [inviteCode, setInviteCode] = useState('');
  const [submittedCode, setSubmittedCode] = useState('');
  const [paused, setPaused] = useState(false);
  const controller = useRef<ReturnType<typeof createRoomPresence> | null>(null);
  const lastStatus = useRef<{ userId: string; status: PresenceStatus } | null>(null);
  const inviteId = useId();
  const statusId = useId();

  useEffect(() => {
    if (paused || session.status !== 'authenticated') return;
    let active = true;
    let client: ReturnType<typeof createRoomPresence>;
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL;
      if (!apiBase) throw new Error('Chưa cấu hình VITE_API_BASE_URL.');
      const endpoint = new URL(apiBase);
      if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
        throw new Error('VITE_API_BASE_URL không hợp lệ.');
      }
      endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
      endpoint.pathname = '/ws-room';
      endpoint.search = '';
      endpoint.hash = '';
      client = createRoomPresence({
        roomId, userId: session.user?.id, inviteCode: submittedCode || undefined, url: endpoint.href,
        getToken: getAccessToken,
        onChange: (next) => {
          if (!active) return;
          const self = next.snapshot?.users.find((user) => user.userId === session.user?.id);
          if (self) lastStatus.current = { userId: self.userId, status: self.status };
          setPresence(next);
        },
      });
      controller.current = client;
      const previous = lastStatus.current;
      if (previous && previous.userId === session.user?.id) client.setStatus(previous.status);
      client.connect();
    } catch {
      // ponytail: endpoint follows the backend's root /ws-room; add a deployment override only for a real proxy prefix.
      setPresence({ connection: 'error', snapshot: null, error: 'Không thể kết nối. Kiểm tra VITE_API_BASE_URL và thử lại.', errorCode: null });
    }
    return () => {
      active = false;
      controller.current = null;
      client?.disconnect();
    };
    // Auth publishes a new session on token refresh: replace the old authenticated socket.
  }, [roomId, submittedCode, attempt, paused, session]);

  const connected = presence.connection === 'connected';
  const self = presence.snapshot?.users.find((user) => user.userId === session.user?.id);
  const needsCode = presence.errorCode === 'FORBIDDEN' || presence.errorCode === 'INVALID_INVITE_CODE';

  function reconnect() {
    setPresence(initialState);
    setPaused(false);
    setAttempt((value) => value + 1);
  }

  return <details className="focus-presence">
    <summary>
      <span className="focus-presence__signal" data-connected={connected} aria-hidden="true" />
      <span>{connected && presence.snapshot ? `${presence.snapshot.onlineCount} người trong phòng` : connectionLabels[presence.connection]}</span>
    </summary>
    <section className="focus-presence__panel" aria-label="Thành viên phòng">
      <div className="focus-presence__heading">
        <h2>Cùng tập trung</h2>
        <span role="status">{connectionLabels[presence.connection]}</span>
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
      {connected && presence.snapshot ? <>
        <label htmlFor={statusId}>Trạng thái của bạn</label>
        <select id={statusId} value={self?.status ?? 'IDLE'} onChange={(event) => controller.current?.setStatus(event.target.value as PresenceStatus)}>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <ul className="focus-presence__members">
          {presence.snapshot.users.map((user) => <li key={user.userId}>
            <span className="focus-presence__avatar" aria-hidden="true">{user.displayName.trim().slice(0, 1).toLocaleUpperCase('vi')}</span>
            <span className="focus-presence__name">{user.displayName}{user.userId === session.user?.id ? ' (bạn)' : ''}</span>
            <span className="focus-presence__status">{statusLabels[user.status]}</span>
          </li>)}
        </ul>
      </> : <p className="focus-presence__note">Danh sách thành viên chỉ hiển thị khi kết nối được xác nhận. Đồng hồ vẫn chạy trên thiết bị của bạn.</p>}
      <div className="focus-presence__actions">
        {connected || presence.connection === 'connecting' || presence.connection === 'reconnecting' ? <button type="button" onClick={() => {
          controller.current?.disconnect();
          setPaused(true);
          setPresence({ connection: 'disconnected', snapshot: null, error: '', errorCode: null });
        }}>Ngắt kết nối</button> : !needsCode && <button type="button" onClick={reconnect}>Kết nối lại</button>}
      </div>
    </section>
  </details>;
}
