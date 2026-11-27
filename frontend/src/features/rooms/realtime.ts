import { Client, ReconnectionTimeMode, type IMessage, type StompSubscription } from '@stomp/stompjs';

export type PresenceStatus = 'STUDYING' | 'BREAK' | 'IDLE';
export type PresenceUser = { userId: string; displayName: string; avatarKey: string | null; status: PresenceStatus };
export type PresenceSnapshot = { type: 'SNAPSHOT'; roomId: string; revision: number; onlineCount: number; users: PresenceUser[] };
export type PresenceState = {
  connection: 'disconnected' | 'connecting' | 'reconnecting' | 'connected' | 'error';
  snapshot: PresenceSnapshot | null;
  error: string;
  errorCode: string | null;
};
export type PresenceErrorCode = 'ROOM_NOT_FOUND' | 'FORBIDDEN' | 'ROOM_FULL' | 'NOT_JOINED' | 'ALREADY_IN_ROOM' | 'INVALID_INVITE_CODE' | 'INVALID_STATUS' | 'USER_NOT_FOUND' | 'UNAUTHORIZED' | 'REQUEST_REJECTED';
const errors: Record<PresenceErrorCode, string> = {
  ROOM_NOT_FOUND: 'Phòng không tồn tại hoặc đã đóng.', FORBIDDEN: 'Phòng riêng yêu cầu mã mời đúng.',
  ROOM_FULL: 'Phòng đã đầy. Vui lòng chọn phòng khác.', NOT_JOINED: 'Bạn chưa vào phòng. Hãy kết nối lại.',
  ALREADY_IN_ROOM: 'Hãy rời phòng hiện tại trước khi vào phòng khác.', INVALID_INVITE_CODE: 'Mã mời gồm 6 chữ cái hoặc chữ số.',
  INVALID_STATUS: 'Trạng thái không hợp lệ. Hãy chọn lại.', USER_NOT_FOUND: 'Tài khoản không còn tồn tại. Hãy đăng nhập lại.',
  UNAUTHORIZED: 'Phiên kết nối đã hết hạn. Hãy kết nối lại.', REQUEST_REJECTED: 'Yêu cầu bị từ chối. Hãy kết nối lại.',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = new Set(['STUDYING', 'BREAK', 'IDLE']);

export function parsePresenceSnapshot(body: string): PresenceSnapshot {
  const value = JSON.parse(body) as PresenceSnapshot;
  if (!value || value.type !== 'SNAPSHOT' || typeof value.roomId !== 'string' || !uuid.test(value.roomId)
      || !Number.isSafeInteger(value.revision) || value.revision < 0 || !Array.isArray(value.users)
      || value.onlineCount !== value.users.length || !value.users.every((user) => user
        && typeof user.userId === 'string' && uuid.test(user.userId) && typeof user.displayName === 'string'
        && (user.avatarKey === null || typeof user.avatarKey === 'string') && statuses.has(user.status))
      || new Set(value.users.map((user) => user.userId.toLowerCase())).size !== value.users.length) {
    throw new Error('Invalid presence snapshot');
  }
  return value;
}

export function createRoomPresence(options: {
  roomId: string; userId?: string; inviteCode?: string; url: string; getToken: () => Promise<string>;
  onChange: (state: PresenceState) => void;
  // Transport injection lets tests exercise real STOMP framing without a live server.
  webSocketFactory?: () => WebSocket;
}) {
  const roomId = options.roomId.toLowerCase();
  const endpoint = new URL(options.url);
  if (!uuid.test(roomId) || !['ws:', 'wss:'].includes(endpoint.protocol)
      || endpoint.pathname !== '/ws-room' || endpoint.search || endpoint.hash || endpoint.username || endpoint.password) {
    throw new Error('Invalid presence endpoint or room');
  }
  let state: PresenceState = { connection: 'disconnected', snapshot: null, error: '', errorCode: null };
  let stopped = false;
  let started = false;
  let epoch = 0;
  let phase: 'offline' | 'queues' | 'join' | 'topic' | 'resync' | 'ready' | 'leaving' = 'offline';
  let revision = -1;
  let desiredStatus: PresenceStatus | null = null;
  let timerStatus: PresenceStatus | null = null;
  let sentStatus: PresenceStatus | null = null;
  let subscriptions: StompSubscription[] = [];
  let commands: string[] = [];
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const app = `/app/rooms/${roomId}`;

  function emit(next: Partial<PresenceState>) {
    state = { ...state, ...next };
    options.onChange(state);
  }
  function clearWait() {
    clearTimeout(timeout);
    timeout = undefined;
  }
  function shutdown(force = false) {
    clearWait();
    phase = 'offline';
    epoch++;
    if (client.connected) {
      for (const subscription of subscriptions) subscription.unsubscribe();
    }
    subscriptions = [];
    const closing = client.deactivate({ force });
    if (!force) timeout = setTimeout(() => { void client.deactivate({ force: true }); }, 10000);
    void closing.then(() => clearWait());
  }
  function fail(code: PresenceErrorCode | 'PROTOCOL' | 'AUTH') {
    if (stopped) return;
    stopped = true;
    emit({ connection: 'error', snapshot: null, errorCode: code,
      error: code === 'PROTOCOL' ? 'Kết nối bị từ chối hoặc dữ liệu không hợp lệ. Hãy kết nối lại.'
        : code === 'AUTH' ? 'Không thể xác thực kết nối. Hãy đăng nhập hoặc thử lại.' : errors[code] });
    shutdown();
  }
  function waitForProgress() {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (stopped) { shutdown(true); return; }
      // Reuse STOMP's bounded backoff rather than starting a second reconnect loop.
      client.forceDisconnect();
    }, 10000);
  }
  function publish(command: string, body: unknown) {
    commands.push(command);
    client.publish({ destination: `${app}/${command}`, body: JSON.stringify(body) });
  }
  function join() { publish('join', options.inviteCode ? { inviteCode: options.inviteCode } : {}); }
  function sendStatus() {
    if (phase !== 'ready' || !desiredStatus || sentStatus === desiredStatus) return;
    sentStatus = desiredStatus;
    publish('status', { status: desiredStatus });
  }
  function subscribe(destination: string, callback: (message: IMessage) => void, ready: () => void) {
    const current = epoch;
    subscriptions.push(client.subscribe(destination, (message) => {
      if (current === epoch) callback(message);
    }));
    // Spring simple broker has no receipts. TSK-16 serializes inbound frames;
    // SEND after SUBSCRIBE is ordered, then application SNAPSHOT acknowledges JOIN.
    if (!stopped && current === epoch) ready();
  }
  function snapshot(message: IMessage, acknowledgement: boolean) {
    const command = acknowledgement ? commands.shift() : undefined;
    if (phase === 'leaving') { if (command === 'leave') shutdown(); return; }
    if (stopped) return;
    let event: PresenceSnapshot;
    try { event = parsePresenceSnapshot(message.body); } catch { fail('PROTOCOL'); return; }
    if (event.roomId.toLowerCase() !== roomId) return;
    if (event.revision >= revision) {
      revision = event.revision;
      const self = options.userId && event.users.find((user) => user.userId === options.userId);
      if (self && phase === 'ready' && timerStatus === null) desiredStatus = sentStatus = self.status;
      emit({ snapshot: event });
    }
    if (command === 'join' && phase === 'join') {
      phase = 'topic';
      waitForProgress();
      subscribe(`/topic/rooms/${roomId}/presence`, (frame) => snapshot(frame, false), () => {
        phase = 'resync';
        waitForProgress();
        join();
      });
    } else if (command === 'join' && phase === 'resync') {
      phase = 'ready';
      clearWait();
      emit({ connection: 'connected', error: '', errorCode: null });
      sendStatus();
    }
  }
  const client = new Client({
    brokerURL: endpoint.href, webSocketFactory: options.webSocketFactory,
    reconnectDelay: 1000, maxReconnectDelay: 30000, reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
    heartbeatIncoming: 10000, heartbeatOutgoing: 10000, connectionTimeout: 10000,
    discardWebsocketOnCommFailure: true,
    debug: () => {},
    beforeConnect: async () => {
      if (stopped) { void client.deactivate(); return; }
      const current = epoch;
      try {
        const token = await options.getToken();
        if (stopped || current !== epoch) return;
        if (!token) { fail('AUTH'); return; }
        client.connectHeaders = { Authorization: `Bearer ${token}` };
      } catch { if (!stopped && current === epoch) fail('AUTH'); }
    },
    onConnect: () => {
      if (stopped) { shutdown(); return; }
      epoch++;
      revision = -1;
      sentStatus = null;
      commands = [];
      subscriptions = [];
      phase = 'queues';
      waitForProgress();
      let ready = 0;
      const queueReady = () => {
        if (++ready !== 2 || phase !== 'queues') return;
        phase = 'join';
        waitForProgress();
        join();
      };
      subscribe('/user/queue/presence', (frame) => snapshot(frame, true), queueReady);
      subscribe('/user/queue/errors', (frame) => {
        if (stopped) return;
        try {
          const value: unknown = JSON.parse(frame.body);
          const code = value && typeof value === 'object' && 'code' in value ? value.code : null;
          fail(typeof code === 'string' && Object.hasOwn(errors, code) ? code as PresenceErrorCode : 'PROTOCOL');
        } catch { fail('PROTOCOL'); }
      }, queueReady);
    },
    onStompError: () => fail('PROTOCOL'),
    onWebSocketClose: () => {
      clearWait();
      subscriptions = [];
      commands = [];
      epoch++;
      phase = 'offline';
      if (stopped) { void client.deactivate(); return; }
      emit({ connection: 'reconnecting', snapshot: null, error: '', errorCode: null });
    },
  });
  return {
    connect() {
      if (started || stopped) return;
      started = true;
      emit({ connection: 'connecting', snapshot: null, error: '', errorCode: null });
      client.activate();
    },
    setTimerStatus(status: PresenceStatus | null) {
      if (stopped || (status !== null && !statuses.has(status))) return;
      const previous = timerStatus;
      timerStatus = status;
      if (status !== null || previous !== null) {
        desiredStatus = status ?? 'IDLE';
        sendStatus();
      }
    },
    setStatus(status: PresenceStatus) {
      if (stopped || !statuses.has(status)) return;
      desiredStatus = status;
      sendStatus();
    },
    disconnect() {
      if (stopped) return;
      stopped = true;
      emit({ connection: 'disconnected', snapshot: null, error: '', errorCode: null });
      clearWait();
      if (client.connected && ['join', 'topic', 'resync', 'ready'].includes(phase)) {
        phase = 'leaving';
        waitForProgress();
        publish('leave', {});
      } else shutdown();
    },
  };
}
