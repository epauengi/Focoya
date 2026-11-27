export type PomodoroMode = 'focus' | 'short' | 'long';

export type PomodoroDurations = Record<PomodoroMode, number>;

export type PomodoroPreferences = {
  durations: PomodoroDurations;
  notifications: boolean;
  autoStart: boolean;
};

export type NotificationPermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

export const POMODORO_PREFERENCES_KEY = 'focoya:pomodoro:preferences:v1';

export const DEFAULT_DURATIONS: PomodoroDurations = {
  focus: 25,
  short: 5,
  long: 15,
};

export const DURATION_RANGES: Record<PomodoroMode, { min: number; max: number }> = {
  focus: { min: 5, max: 60 },
  short: { min: 1, max: 15 },
  long: { min: 5, max: 30 },
};

export const DEFAULT_POMODORO_PREFERENCES: PomodoroPreferences = {
  durations: { ...DEFAULT_DURATIONS },
  notifications: true,
  autoStart: false,
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export type NotificationApiLike = {
  permission: NotificationPermission;
  requestPermission?: () => Promise<NotificationPermission>;
  new (title: string, options?: NotificationOptions): unknown;
};

export function isValidDuration(mode: PomodoroMode, value: unknown): value is number {
  const { min, max } = DURATION_RANGES[mode];
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function parseDurationInput(
  mode: PomodoroMode,
  raw: string,
): { value: number; error: null } | { value: null; error: string } {
  const { min, max } = DURATION_RANGES[mode];
  const error = `Nhập số nguyên từ ${min} đến ${max} phút.`;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return { value: null, error };
  }
  const parsed = Number(trimmed);
  if (!isValidDuration(mode, parsed)) {
    return { value: null, error };
  }
  return { value: parsed, error: null };
}

export function validateDurations(value: unknown): PomodoroDurations {
  if (typeof value !== 'object' || value === null) {
    return { ...DEFAULT_DURATIONS };
  }
  const raw = value as Record<string, unknown>;
  return {
    focus: isValidDuration('focus', raw.focus) ? raw.focus : DEFAULT_DURATIONS.focus,
    short: isValidDuration('short', raw.short) ? raw.short : DEFAULT_DURATIONS.short,
    long: isValidDuration('long', raw.long) ? raw.long : DEFAULT_DURATIONS.long,
  };
}

export function validatePomodoroPreferences(value: unknown): PomodoroPreferences {
  if (typeof value !== 'object' || value === null) {
    return {
      durations: { ...DEFAULT_DURATIONS },
      notifications: DEFAULT_POMODORO_PREFERENCES.notifications,
      autoStart: DEFAULT_POMODORO_PREFERENCES.autoStart,
    };
  }
  const raw = value as Record<string, unknown>;
  return {
    durations: validateDurations(raw.durations),
    notifications:
      typeof raw.notifications === 'boolean'
        ? raw.notifications
        : DEFAULT_POMODORO_PREFERENCES.notifications,
    autoStart:
      typeof raw.autoStart === 'boolean'
        ? raw.autoStart
        : DEFAULT_POMODORO_PREFERENCES.autoStart,
  };
}

function getDefaultStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readPomodoroPreferences(
  storage: StorageLike | null = getDefaultStorage(),
): PomodoroPreferences {
  if (!storage) {
    return validatePomodoroPreferences(null);
  }
  try {
    const raw = storage.getItem(POMODORO_PREFERENCES_KEY);
    if (!raw) {
      return validatePomodoroPreferences(null);
    }
    return validatePomodoroPreferences(JSON.parse(raw));
  } catch {
    return validatePomodoroPreferences(null);
  }
}

export function writePomodoroPreferences(
  prefs: PomodoroPreferences,
  storage: StorageLike | null = getDefaultStorage(),
): boolean {
  if (!storage) {
    return false;
  }
  try {
    const safe = validatePomodoroPreferences(prefs);
    storage.setItem(POMODORO_PREFERENCES_KEY, JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
}

function getDefaultNotificationApi(): NotificationApiLike | null {
  if (typeof globalThis === 'undefined' || !('Notification' in globalThis)) {
    return null;
  }
  const candidate = (globalThis as { Notification?: NotificationApiLike }).Notification;
  return typeof candidate === 'function' ? candidate : null;
}

export function getNotificationPermissionState(
  api: Pick<NotificationApiLike, 'permission'> | null = getDefaultNotificationApi(),
): NotificationPermissionState {
  if (!api) return 'unsupported';
  if (api.permission === 'granted' || api.permission === 'denied' || api.permission === 'default') {
    return api.permission;
  }
  return 'unsupported';
}

export async function requestNotificationPermission(
  api: Pick<NotificationApiLike, 'permission' | 'requestPermission'> | null = getDefaultNotificationApi(),
): Promise<NotificationPermissionState> {
  const current = getNotificationPermissionState(api);
  if (current !== 'default' || !api || typeof api.requestPermission !== 'function') {
    return current;
  }
  try {
    const next = await api.requestPermission();
    if (next === 'granted' || next === 'denied' || next === 'default') {
      return next;
    }
    return getNotificationPermissionState(api);
  } catch {
    return getNotificationPermissionState(api);
  }
}

export function notifyPomodoro(
  message: string,
  api: NotificationApiLike | null = getDefaultNotificationApi(),
): boolean {
  const body = message.trim();
  if (!body || !api || api.permission !== 'granted') {
    return false;
  }
  try {
    new api('Focoya', { body });
    return true;
  } catch {
    return false;
  }
}
