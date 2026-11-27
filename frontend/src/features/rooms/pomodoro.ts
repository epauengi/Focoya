import {
  DEFAULT_DURATIONS,
  validateDurations,
  type PomodoroDurations,
  type PomodoroMode,
} from './pomodoroPreferences';
import type { PresenceStatus } from './realtime';

export type { PomodoroDurations, PomodoroMode };

export type PomodoroPhase =
  | 'idle'
  | 'starting'
  | 'running'
  | 'paused'
  | 'finishing'
  | 'uncertain'
  | 'completed';

export type StudySession = {
  id: string;
  userId: string;
  roomId: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  xpEarned: number;
};

export type StudyIdentity = {
  userId: string;
  generation: number;
  roomId: string;
};

export type AuthSnapshot = {
  userId: string | null;
  generation: number;
};

export type PomodoroState = {
  mode: PomodoroMode;
  phase: PomodoroPhase;
  remaining: number;
  session: StudySession | null;
  result: StudySession | null;
  message: string;
};

export type PomodoroSnapshot = {
  state: PomodoroState;
  intent: PresenceStatus | null;
  busy: boolean;
  controlsPresence: boolean;
  hasUnfinished: boolean;
};

export type PomodoroClock = {
  nowMono: () => number;
  nowWall: () => number;
};

export type PomodoroTimers = {
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (id: unknown) => void;
};

export type PomodoroApi = {
  captureStudyIdentity: (roomId: string) => StudyIdentity | null;
  isStudyIdentityCurrent: (identity: StudyIdentity) => boolean;
  startStudySession: (identity: StudyIdentity) => Promise<StudySession>;
  finishStudySession: (identity: StudyIdentity, expectedSessionId: string) => Promise<StudySession>;
  acquireStudyLock: (userId: string) => Promise<() => void | Promise<void>>;
  getAuthSnapshot?: () => AuthSnapshot;
};

export type PomodoroControllerOptions = {
  roomId: string;
  durations?: Partial<PomodoroDurations>;
  presenceReady?: boolean;
  autoStart: boolean;
  notifications: boolean;
  notify: (message: string) => void;
  notifyBrowser?: (message: string) => void;
  onProfileRefresh?: (userId: string) => void;
  api: PomodoroApi;
  clock?: PomodoroClock;
  timers?: PomodoroTimers;
  tickMs?: number;
};

export type PomodoroController = {
  getSnapshot: () => PomodoroSnapshot;
  subscribe: (listener: (snapshot: PomodoroSnapshot) => void) => () => void;
  updateOptions: (
    options: Partial<
      Pick<
        PomodoroControllerOptions,
        'durations' | 'presenceReady' | 'autoStart' | 'notifications' | 'notify' | 'notifyBrowser' | 'onProfileRefresh'
      >
    >
  ) => void;
  syncAuth: () => void;
  handleVisibilityChange: () => void;
  start: () => Promise<boolean>;
  pause: () => void;
  end: () => Promise<boolean>;
  reset: () => Promise<boolean>;
  selectMode: (mode: PomodoroMode) => Promise<boolean>;
  abandon: () => void;
  dispose: () => void;
};

export const DEFAULT_POMODORO_DURATIONS: PomodoroDurations = { ...DEFAULT_DURATIONS };

const MODE_LABELS: Record<PomodoroMode, string> = {
  focus: 'Tập trung',
  short: 'Nghỉ ngắn',
  long: 'Nghỉ dài',
};

const VALID_MODES = new Set<PomodoroMode>(['focus', 'short', 'long']);

export function normalizeDurations(durations?: Partial<PomodoroDurations>): PomodoroDurations {
  return validateDurations(durations);
}

export function durationSecondsForMode(mode: PomodoroMode, durations?: Partial<PomodoroDurations>): number {
  const normalized = normalizeDurations(durations);
  return Math.max(1, Math.round(normalized[mode] * 60));
}

export function getPomodoroIntent(mode: PomodoroMode, phase: PomodoroPhase): PresenceStatus | null {
  if (phase === 'idle' || phase === 'completed') return null;
  if (phase === 'running') return mode === 'focus' ? 'STUDYING' : 'BREAK';
  return 'IDLE';
}

export function isStudySessionUncertain(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ('uncertain' in error && (error as { uncertain?: unknown }).uncertain === true) return true;
  if ('status' in error && (error as { status?: unknown }).status === 404) return true;
  return false;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function authKeysEqual(a: AuthSnapshot | null, b: AuthSnapshot | null): boolean {
  if (!a || !b) return a === b;
  return a.userId === b.userId && a.generation === b.generation;
}

export function initialPomodoroSnapshot(durations?: Partial<PomodoroDurations>): PomodoroSnapshot {
  return {
    state: {
      mode: 'focus',
      phase: 'idle',
      remaining: durationSecondsForMode('focus', durations),
      session: null,
      result: null,
      message: '',
    },
    intent: null,
    busy: false,
    controlsPresence: false,
    hasUnfinished: false,
  };
}

export function createPomodoroController(initialOptions: PomodoroControllerOptions): PomodoroController {
  const clock: PomodoroClock = initialOptions.clock ?? {
    nowMono: () => performance.now(),
    nowWall: () => Date.now(),
  };
  const timers: PomodoroTimers = initialOptions.timers ?? {
    setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
    clearInterval: (id) => globalThis.clearInterval(id as ReturnType<typeof setInterval>),
  };
  const tickMs = initialOptions.tickMs ?? 250;

  const roomId = initialOptions.roomId;
  let durations = normalizeDurations(initialOptions.durations);
  let presenceReady = Boolean(initialOptions.presenceReady);
  let autoStart = initialOptions.autoStart;
  let notifications = initialOptions.notifications;
  let notify = initialOptions.notify;
  let notifyBrowser = initialOptions.notifyBrowser;
  let onProfileRefresh = initialOptions.onProfileRefresh;
  const api = initialOptions.api;

  let mode: PomodoroMode = 'focus';
  let phase: PomodoroPhase = 'idle';
  let remainingMs = durationSecondsForMode('focus', durations) * 1000;
  let remaining = Math.ceil(remainingMs / 1000);
  let session: StudySession | null = null;
  let result: StudySession | null = null;
  let message = '';

  let disposed = false;
  let epoch = 0;
  let runToken = 0;
  let completionFiredForRun = 0;
  let inFlightPosts = 0;

  let activeIdentity: StudyIdentity | null = null;
  let lockRelease: (() => void | Promise<void>) | null = null;
  let lastAuthSnapshot: AuthSnapshot | null = api.getAuthSnapshot ? api.getAuthSnapshot() : null;

  let tickerId: unknown = null;
  let startMono = 0;
  let startWall = 0;
  let targetRemainingMs = 0;

  const listeners = new Set<(snapshot: PomodoroSnapshot) => void>();

  function buildSnapshot(): PomodoroSnapshot {
    const intent = getPomodoroIntent(mode, phase);
    const busy = phase === 'starting' || phase === 'finishing';
    const hasUnfinished =
      session !== null || phase === 'starting' || phase === 'finishing' || phase === 'uncertain';
    return {
      state: {
        mode,
        phase,
        remaining,
        session,
        result,
        message,
      },
      intent,
      busy,
      controlsPresence: intent !== null,
      hasUnfinished,
    };
  }

  let cachedSnapshot = buildSnapshot();

  function emit() {
    cachedSnapshot = buildSnapshot();
    if (disposed) return;
    for (const listener of [...listeners]) {
      listener(cachedSnapshot);
    }
  }

  function stopTicker() {
    if (tickerId !== null) {
      timers.clearInterval(tickerId);
      tickerId = null;
    }
  }

  function releaseLockSafely() {
    const release = lockRelease;
    lockRelease = null;
    if (!release) return;
    try {
      const maybePromise = release();
      if (maybePromise && typeof (maybePromise as Promise<void>).catch === 'function') {
        void (maybePromise as Promise<void>).catch(() => {});
      }
    } catch {
      // Lock cleanup must never throw during teardown.
    }
  }

  function releaseDirectLock(release: (() => void | Promise<void>) | null) {
    if (!release) return;
    try {
      const maybePromise = release();
      if (maybePromise && typeof (maybePromise as Promise<void>).catch === 'function') {
        void (maybePromise as Promise<void>).catch(() => {});
      }
    } catch {
      // Ignore cleanup errors.
    }
  }

  function isOperationCurrent(opEpoch: number, identity: StudyIdentity | null): boolean {
    if (disposed || opEpoch !== epoch) return false;
    if (identity) {
      if (identity.roomId !== roomId) return false;
      if (!api.isStudyIdentityCurrent(identity)) return false;
    }
    if (api.getAuthSnapshot && lastAuthSnapshot) {
      const currentAuth = api.getAuthSnapshot();
      if (!authKeysEqual(currentAuth, lastAuthSnapshot)) return false;
    }
    return true;
  }

  function computeLeftMs(): number {
    const monoElapsed = Math.max(0, clock.nowMono() - startMono);
    const wallElapsed = Math.max(0, clock.nowWall() - startWall);
    const elapsedMs = Math.max(monoElapsed, wallElapsed);
    return Math.max(0, targetRemainingMs - elapsedMs);
  }

  function beginCountdown(initialMs: number) {
    stopTicker();
    runToken += 1;
    const currentRun = runToken;
    targetRemainingMs = Math.max(0, initialMs);
    remainingMs = targetRemainingMs;
    remaining = Math.max(0, Math.ceil(remainingMs / 1000));
    startMono = clock.nowMono();
    startWall = clock.nowWall();
    phase = 'running';
    emit();

    if (targetRemainingMs <= 0) {
      void handleNaturalCompletion(currentRun);
      return;
    }

    tickerId = timers.setInterval(() => {
      if (disposed || phase !== 'running' || currentRun !== runToken) return;
      const leftMs = computeLeftMs();
      remainingMs = leftMs;
      const nextSeconds = Math.max(0, Math.ceil(leftMs / 1000));
      if (leftMs <= 0) {
        remaining = 0;
        void handleNaturalCompletion(currentRun);
      } else if (nextSeconds !== remaining) {
        remaining = nextSeconds;
        emit();
      }
    }, tickMs);
  }

  function sendNotifications(inAppMessage: string, browserMessage: string | null) {
    try {
      notify(inAppMessage);
    } catch {
      // Keep timer lifecycle resilient to UI notify errors.
    }
    if (notifications && browserMessage && notifyBrowser) {
      try {
        notifyBrowser(browserMessage);
      } catch {
        // Ignore browser Notification failures.
      }
    }
  }

  async function finishFocusWorkflow(options: { fromCompletion: boolean }): Promise<boolean> {
    if (phase === 'starting' || phase === 'finishing' || phase === 'uncertain') return false;
    if (!session?.id || !lockRelease) return false;
    const expectedSessionId = session.id;
    const identity = activeIdentity ?? api.captureStudyIdentity(roomId);
    if (!identity || !api.isStudyIdentityCurrent(identity)) {
      resetToIdle({ releaseLockIfIdle: inFlightPosts === 0, clearResult: true, clearMessage: false });
      message = 'Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.';
      emit();
      return false;
    }

    const opEpoch = epoch;
    const opRelease = lockRelease;
    if (phase === 'running') {
      remainingMs = computeLeftMs();
      remaining = Math.max(0, Math.ceil(remainingMs / 1000));
    }
    stopTicker();
    phase = 'finishing';
    message = '';
    inFlightPosts += 1;
    emit();

    let finished: StudySession;
    try {
      finished = await api.finishStudySession(identity, expectedSessionId);
    } catch (error) {
      inFlightPosts -= 1;
      if (!isOperationCurrent(opEpoch, identity)) {
        if (lockRelease === opRelease) lockRelease = null;
        releaseDirectLock(opRelease);
        return false;
      }

      if (isStudySessionUncertain(error)) {
        phase = 'uncertain';
        const warning = toErrorMessage(
          error,
          'Chưa xác nhận được kết quả phiên học với máy chủ. Không tự thử lại; hãy bỏ qua hoặc rời phòng nếu muốn tiếp tục.'
        );
        message = warning;
        emit();
        if (options.fromCompletion) {
          sendNotifications(
            'Hết giờ tập trung nhưng chưa xác nhận được với máy chủ. Không tự thử lại.',
            'Hết giờ tập trung!'
          );
        }
        return false;
      }

      phase = 'paused';
      const errMsg = toErrorMessage(error, 'Không thể kết thúc phiên tập trung. Vui lòng thử lại.');
      message = errMsg;
      emit();
      if (options.fromCompletion) {
        sendNotifications('Hết giờ tập trung nhưng không thể gửi kết quả. Hãy thử kết thúc lại.', 'Hết giờ tập trung!');
      }
      return false;
    }

    inFlightPosts -= 1;
    if (lockRelease === opRelease) lockRelease = null;
    releaseDirectLock(opRelease);

    if (!isOperationCurrent(opEpoch, identity)) {
      return false;
    }

    session = null;
    activeIdentity = null;
    result = finished;

    try {
      onProfileRefresh?.(identity.userId);
    } catch {
      // Profile refresh callback errors must not corrupt timer state.
    }

    const isCompleted = finished.status === 'COMPLETED';
    const minutes = finished.durationMinutes ?? 0;
    const inAppMsg = isCompleted
      ? `Hoàn thành phiên tập trung! +${finished.xpEarned} XP (${minutes} phút).`
      : `Phiên tập trung đã kết thúc (${minutes} phút, +0 XP — dưới 5 phút chưa được tính XP).`;
    const browserMsg = isCompleted
      ? `Hoàn thành phiên tập trung! +${finished.xpEarned} XP.`
      : 'Hết giờ tập trung!';

    message = inAppMsg;

    if (options.fromCompletion) {
      sendNotifications(inAppMsg, browserMsg);
      if (autoStart) {
        mode = 'short';
        const nextMs = durationSecondsForMode('short', durations) * 1000;
        beginCountdown(nextMs);
        return true;
      }
    }

    phase = 'completed';
    remainingMs = 0;
    remaining = 0;
    emit();
    return true;
  }

  async function handleNaturalCompletion(currentRun: number) {
    if (disposed || phase !== 'running' || currentRun !== runToken) return;
    if (completionFiredForRun === currentRun) return;
    completionFiredForRun = currentRun;
    stopTicker();
    remainingMs = 0;
    remaining = 0;

    if (mode === 'focus') {
      await finishFocusWorkflow({ fromCompletion: true });
      return;
    }

    const breakLabel = MODE_LABELS[mode];
    const breakMsg = `Hết giờ ${breakLabel}!`;
    message = breakMsg;
    sendNotifications(breakMsg, breakMsg);

    if (autoStart) {
      mode = 'focus';
      phase = 'idle';
      const focusSec = durationSecondsForMode('focus', durations);
      remainingMs = focusSec * 1000;
      remaining = focusSec;
      if (!presenceReady) {
        message = 'Đã chuyển sang Tập trung. Cần kết nối phòng học để tự động bắt đầu.';
        emit();
        return;
      }
      await startFocusWorkflow({ preserveResult: true });
      return;
    }

    phase = 'completed';
    emit();
  }

  async function startFocusWorkflow(options: { preserveResult: boolean }): Promise<boolean> {
    if (phase === 'starting' || phase === 'finishing' || phase === 'running' || phase === 'uncertain') {
      return false;
    }

    if (phase === 'paused' && session !== null) {
      if (remainingMs <= 0) {
        message = 'Phiên tập trung đã hết giờ. Vui lòng kết thúc để lưu kết quả.';
        emit();
        return false;
      }
      if (!activeIdentity || !api.isStudyIdentityCurrent(activeIdentity)) {
        resetToIdle({ releaseLockIfIdle: true, clearResult: true, clearMessage: false });
        message = 'Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.';
        emit();
        return false;
      }
      message = '';
      beginCountdown(remainingMs);
      return true;
    }

    if (!presenceReady) {
      message = 'Cần kết nối phòng học trước khi bắt đầu phiên tập trung.';
      emit();
      return false;
    }

    let identity: StudyIdentity | null = null;
    try {
      identity = api.captureStudyIdentity(roomId);
    } catch (error) {
      message = toErrorMessage(error, 'Vui lòng đăng nhập để bắt đầu phiên tập trung.');
      emit();
      return false;
    }

    if (!identity || !api.isStudyIdentityCurrent(identity)) {
      message = 'Vui lòng đăng nhập để bắt đầu phiên tập trung.';
      emit();
      return false;
    }

    const opEpoch = epoch;
    if (api.getAuthSnapshot) {
      lastAuthSnapshot = api.getAuthSnapshot();
    }

    phase = 'starting';
    message = '';
    if (!options.preserveResult) {
      result = null;
    }
    emit();

    let acquiredRelease: (() => void | Promise<void>) | null = null;
    try {
      acquiredRelease = await api.acquireStudyLock(identity.userId);
    } catch (error) {
      if (!isOperationCurrent(opEpoch, identity)) return false;
      phase = 'idle';
      remainingMs = durationSecondsForMode('focus', durations) * 1000;
      remaining = Math.ceil(remainingMs / 1000);
      message = toErrorMessage(
        error,
        'Không thể bắt đầu phiên tập trung vì đang có phiên khác hoặc trình duyệt không hỗ trợ khóa phiên.'
      );
      emit();
      return false;
    }

    if (!isOperationCurrent(opEpoch, identity)) {
      releaseDirectLock(acquiredRelease);
      return false;
    }

    lockRelease = acquiredRelease;
    activeIdentity = identity;

    const targetSec = durationSecondsForMode('focus', durations);
    const requestStartMono = clock.nowMono();
    inFlightPosts += 1;

    let started: StudySession;
    try {
      started = await api.startStudySession(identity);
    } catch (error) {
      inFlightPosts -= 1;
      if (!isOperationCurrent(opEpoch, identity)) {
        if (lockRelease === acquiredRelease) lockRelease = null;
        releaseDirectLock(acquiredRelease);
        return false;
      }

      if (isStudySessionUncertain(error)) {
        phase = 'uncertain';
        message = toErrorMessage(
          error,
          'Không rõ phiên tập trung đã bắt đầu trên máy chủ chưa. Không tự thử lại; hãy bỏ qua hoặc rời phòng nếu muốn đặt lại.'
        );
        emit();
        return false;
      }

      if (lockRelease === acquiredRelease) lockRelease = null;
      releaseDirectLock(acquiredRelease);
      activeIdentity = null;
      session = null;
      phase = 'idle';
      remainingMs = targetSec * 1000;
      remaining = targetSec;
      message = toErrorMessage(error, 'Không thể bắt đầu phiên tập trung.');
      emit();
      return false;
    }

    inFlightPosts -= 1;
    const responseMono = clock.nowMono();

    if (!isOperationCurrent(opEpoch, identity)) {
      if (lockRelease === acquiredRelease) lockRelease = null;
      releaseDirectLock(acquiredRelease);
      return false;
    }

    const rttMs = Math.max(0, responseMono - requestStartMono);
    const effectiveMs = Math.max(0, targetSec * 1000 - rttMs);
    session = started;
    try {
      onProfileRefresh?.(identity.userId);
    } catch {
      // Profile refresh callback errors must not corrupt timer state.
    }
    beginCountdown(effectiveMs);
    return true;
  }

  function resetToIdle(options: {
    releaseLockIfIdle: boolean;
    clearResult: boolean;
    clearMessage: boolean;
  }) {
    stopTicker();
    runToken += 1;
    epoch += 1;
    session = null;
    activeIdentity = null;
    phase = 'idle';
    remainingMs = durationSecondsForMode(mode, durations) * 1000;
    remaining = Math.ceil(remainingMs / 1000);
    if (options.clearResult) result = null;
    if (options.clearMessage) message = '';
    if (options.releaseLockIfIdle) {
      releaseLockSafely();
    } else {
      // Detach lock ownership from controller state; in-flight POST retains and releases its own opRelease.
      lockRelease = null;
    }
  }

  return {
    getSnapshot() {
      return cachedSnapshot;
    },

    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    updateOptions(next) {
      if (disposed) return;
      if (next.durations !== undefined) {
        const nextDurations = normalizeDurations(next.durations);
        const changed =
          nextDurations.focus !== durations.focus ||
          nextDurations.short !== durations.short ||
          nextDurations.long !== durations.long;
        if (changed) {
          durations = nextDurations;
          if (phase === 'idle' && session === null) {
            remainingMs = durationSecondsForMode(mode, durations) * 1000;
            remaining = Math.ceil(remainingMs / 1000);
            emit();
          }
        }
      }
      if (next.presenceReady !== undefined) presenceReady = Boolean(next.presenceReady);
      if (next.autoStart !== undefined) autoStart = next.autoStart;
      if (next.notifications !== undefined) notifications = next.notifications;
      if (next.notify !== undefined) notify = next.notify;
      if (next.notifyBrowser !== undefined) notifyBrowser = next.notifyBrowser;
      if (next.onProfileRefresh !== undefined) onProfileRefresh = next.onProfileRefresh;
    },

    syncAuth() {
      if (disposed) return;
      const nextAuth = api.getAuthSnapshot ? api.getAuthSnapshot() : null;
      const authChanged =
        (nextAuth !== null && !authKeysEqual(nextAuth, lastAuthSnapshot)) ||
        (activeIdentity !== null && !api.isStudyIdentityCurrent(activeIdentity));
      if (!authChanged) return;

      lastAuthSnapshot = nextAuth;
      mode = 'focus';
      resetToIdle({
        releaseLockIfIdle: inFlightPosts === 0,
        clearResult: true,
        clearMessage: true,
      });
      emit();
    },

    handleVisibilityChange() {
      if (disposed || phase !== 'running') return;
      const currentRun = runToken;
      const leftMs = computeLeftMs();
      remainingMs = leftMs;
      const nextSeconds = Math.max(0, Math.ceil(leftMs / 1000));
      if (leftMs <= 0) {
        remaining = 0;
        void handleNaturalCompletion(currentRun);
      } else if (nextSeconds !== remaining) {
        remaining = nextSeconds;
        emit();
      }
    },

    async start() {
      if (disposed || phase === 'starting' || phase === 'finishing' || phase === 'running' || phase === 'uncertain') {
        return false;
      }

      if (mode === 'focus') {
        return startFocusWorkflow({ preserveResult: false });
      }

      if (phase === 'paused') {
        message = '';
        beginCountdown(remainingMs > 0 ? remainingMs : durationSecondsForMode(mode, durations) * 1000);
        return true;
      }

      message = '';
      result = null;
      const breakMs = durationSecondsForMode(mode, durations) * 1000;
      beginCountdown(breakMs);
      return true;
    },

    pause() {
      if (disposed || phase !== 'running') return;
      const leftMs = computeLeftMs();
      if (leftMs <= 0) {
        void handleNaturalCompletion(runToken);
        return;
      }
      remainingMs = leftMs;
      remaining = Math.max(0, Math.ceil(leftMs / 1000));
      stopTicker();
      phase = 'paused';
      emit();
    },

    async end() {
      if (disposed || phase === 'starting' || phase === 'finishing' || phase === 'uncertain') return false;

      if (session === null) {
        if (mode !== 'focus' && (phase === 'running' || phase === 'paused')) {
          stopTicker();
          runToken += 1;
          phase = 'idle';
          remainingMs = durationSecondsForMode(mode, durations) * 1000;
          remaining = Math.ceil(remainingMs / 1000);
          message = '';
          emit();
        }
        return true;
      }

      return finishFocusWorkflow({ fromCompletion: false });
    },

    async reset() {
      if (disposed || phase === 'starting' || phase === 'finishing' || phase === 'uncertain') return false;

      if (session !== null) {
        const finished = await finishFocusWorkflow({ fromCompletion: false });
        if (!finished || disposed) return false;
      }

      resetToIdle({
        releaseLockIfIdle: inFlightPosts === 0,
        clearResult: true,
        clearMessage: true,
      });
      emit();
      return true;
    },

    async selectMode(nextMode) {
      if (disposed || phase === 'starting' || phase === 'finishing' || phase === 'uncertain') return false;
      if (!VALID_MODES.has(nextMode)) return false;

      if (nextMode === mode) {
        if (phase === 'running' || phase === 'paused') return false;
        if (phase === 'idle') return true;
      }

      if (session !== null) {
        const finished = await finishFocusWorkflow({ fromCompletion: false });
        if (!finished || disposed) return false;
      }

      mode = nextMode;
      resetToIdle({
        releaseLockIfIdle: inFlightPosts === 0,
        clearResult: true,
        clearMessage: true,
      });
      emit();
      return true;
    },

    abandon() {
      if (disposed || phase !== 'uncertain' || inFlightPosts > 0) return;
      resetToIdle({
        releaseLockIfIdle: true,
        clearResult: false,
        clearMessage: true,
      });
      emit();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      epoch += 1;
      runToken += 1;
      stopTicker();
      listeners.clear();
      // Never auto-finish on unmount; retain lock if a POST is in flight until it settles.
      if (inFlightPosts === 0) {
        releaseLockSafely();
      } else {
        lockRelease = null;
      }
    },
  };
}
