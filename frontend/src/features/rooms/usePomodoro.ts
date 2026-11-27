import { useCallback, useEffect, useRef, useState } from 'react';
import { getSession, getSessionGeneration, subscribeSession } from '../../auth/session';
import {
  createPomodoroController,
  initialPomodoroSnapshot,
  type PomodoroApi,
  type PomodoroController,
  type PomodoroDurations,
  type PomodoroMode,
  type PomodoroPhase,
  type PomodoroSnapshot,
  type PomodoroState,
} from './pomodoro';
import { notifyPomodoro } from './pomodoroPreferences';
import type { PresenceStatus } from './realtime';
import {
  acquireStudyLock,
  captureStudyIdentity,
  finishStudySession,
  isStudyIdentityCurrent,
  startStudySession,
} from './studySession';

export type { PomodoroDurations, PomodoroMode, PomodoroPhase, PomodoroState };

export type UsePomodoroOptions = {
  roomId: string;
  durations?: Partial<PomodoroDurations>;
  presenceReady?: boolean;
  autoStart: boolean;
  notifications: boolean;
  notify: (message: string) => void;
  notifyBrowser?: (message: string) => void;
  onProfileRefresh?: (userId: string) => void;
};

export type UsePomodoroReturn = {
  state: PomodoroState;
  intent: PresenceStatus | null;
  busy: boolean;
  controlsPresence: boolean;
  hasUnfinished: boolean;
  start: () => Promise<boolean>;
  pause: () => void;
  end: () => Promise<boolean>;
  reset: () => Promise<boolean>;
  selectMode: (mode: PomodoroMode) => Promise<boolean>;
  abandon: () => void;
};

const studySessionApi: PomodoroApi = {
  captureStudyIdentity,
  isStudyIdentityCurrent,
  startStudySession,
  finishStudySession: (identity, expectedSessionId) => finishStudySession(identity, expectedSessionId),
  acquireStudyLock,
  getAuthSnapshot: () => {
    const session = getSession();
    return {
      userId: session.status === 'authenticated' ? session.user?.id ?? null : null,
      generation: getSessionGeneration(),
    };
  },
};

export function usePomodoro(options: UsePomodoroOptions): UsePomodoroReturn {
  const {
    roomId,
    durations,
    presenceReady,
    autoStart,
    notifications,
    notify,
    notifyBrowser,
    onProfileRefresh,
  } = options;
  const durationFocus = durations?.focus;
  const durationShort = durations?.short;
  const durationLong = durations?.long;
  const resolvedNotifyBrowser = notifyBrowser ?? notifyPomodoro;

  const controllerRef = useRef<PomodoroController | null>(null);
  const optionsRef = useRef({
    durations,
    presenceReady,
    autoStart,
    notifications,
    notify,
    notifyBrowser: resolvedNotifyBrowser,
    onProfileRefresh,
  });

  const [entry, setEntry] = useState<{ roomId: string; snapshot: PomodoroSnapshot }>(() => ({
    roomId,
    snapshot: initialPomodoroSnapshot(durations),
  }));

  useEffect(() => {
    const nextDurations =
      durationFocus === undefined && durationShort === undefined && durationLong === undefined
        ? undefined
        : { focus: durationFocus, short: durationShort, long: durationLong };
    optionsRef.current = {
      durations: nextDurations,
      presenceReady,
      autoStart,
      notifications,
      notify,
      notifyBrowser: resolvedNotifyBrowser,
      onProfileRefresh,
    };
    controllerRef.current?.updateOptions(optionsRef.current);
  }, [
    durationFocus,
    durationShort,
    durationLong,
    presenceReady,
    autoStart,
    notifications,
    notify,
    resolvedNotifyBrowser,
    onProfileRefresh,
  ]);

  useEffect(() => {
    const current = optionsRef.current;
    const controller = createPomodoroController({
      roomId,
      durations: current.durations,
      presenceReady: current.presenceReady,
      autoStart: current.autoStart,
      notifications: current.notifications,
      notify: current.notify,
      notifyBrowser: current.notifyBrowser,
      onProfileRefresh: current.onProfileRefresh,
      api: studySessionApi,
    });

    controllerRef.current = controller;
    setEntry({ roomId, snapshot: controller.getSnapshot() });

    const unsubController = controller.subscribe((snapshot) => {
      setEntry({ roomId, snapshot });
    });
    const unsubSession = subscribeSession(() => {
      controller.syncAuth();
    });

    const onVisibilityChange = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        controller.handleVisibilityChange();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      unsubSession();
      unsubController();
      controller.dispose();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [roomId]);

  const snapshot =
    entry.roomId === roomId ? entry.snapshot : initialPomodoroSnapshot(durations);

  const start = useCallback(
    () => controllerRef.current?.start() ?? Promise.resolve(false),
    []
  );
  const pause = useCallback(() => {
    controllerRef.current?.pause();
  }, []);
  const end = useCallback(
    () => controllerRef.current?.end() ?? Promise.resolve(false),
    []
  );
  const reset = useCallback(
    () => controllerRef.current?.reset() ?? Promise.resolve(false),
    []
  );
  const selectMode = useCallback(
    (mode: PomodoroMode) => controllerRef.current?.selectMode(mode) ?? Promise.resolve(false),
    []
  );
  const abandon = useCallback(() => {
    controllerRef.current?.abandon();
  }, []);

  return {
    state: snapshot.state,
    intent: snapshot.intent,
    busy: snapshot.busy,
    controlsPresence: snapshot.controlsPresence,
    hasUnfinished: snapshot.hasUnfinished,
    start,
    pause,
    end,
    reset,
    selectMode,
    abandon,
  };
}
