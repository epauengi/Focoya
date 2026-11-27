import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_DURATIONS,
  DEFAULT_POMODORO_PREFERENCES,
  DURATION_RANGES,
  POMODORO_PREFERENCES_KEY,
  getNotificationPermissionState,
  isValidDuration,
  notifyPomodoro,
  parseDurationInput,
  readPomodoroPreferences,
  requestNotificationPermission,
  validateDurations,
  validatePomodoroPreferences,
  writePomodoroPreferences,
} from './pomodoroPreferences.ts';

function memoryStorage() {
  const map = new Map();
  return {
    map,
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
  };
}

test('default durations and integer bounds match spec', () => {
  assert.deepEqual(DEFAULT_DURATIONS, { focus: 25, short: 5, long: 15 });
  assert.deepEqual(DURATION_RANGES, {
    focus: { min: 5, max: 60 },
    short: { min: 1, max: 15 },
    long: { min: 5, max: 30 },
  });

  assert.equal(isValidDuration('focus', 5), true);
  assert.equal(isValidDuration('focus', 60), true);
  assert.equal(isValidDuration('focus', 4), false);
  assert.equal(isValidDuration('focus', 61), false);
  assert.equal(isValidDuration('focus', 25.5), false);

  assert.equal(isValidDuration('short', 1), true);
  assert.equal(isValidDuration('short', 15), true);
  assert.equal(isValidDuration('short', 0), false);
  assert.equal(isValidDuration('short', 16), false);

  assert.equal(isValidDuration('long', 5), true);
  assert.equal(isValidDuration('long', 30), true);
  assert.equal(isValidDuration('long', 4), false);
  assert.equal(isValidDuration('long', 31), false);
});

test('parseDurationInput accepts valid integers and rejects invalid inputs with recovery hint', () => {
  assert.deepEqual(parseDurationInput('focus', ' 45 '), { value: 45, error: null });
  assert.deepEqual(parseDurationInput('short', '1'), { value: 1, error: null });
  assert.deepEqual(parseDurationInput('long', '30'), { value: 30, error: null });

  for (const bad of ['', ' ', '0', '4', '61', '25.5', '-5', '1e1', 'abc']) {
    const res = parseDurationInput('focus', bad);
    assert.equal(res.value, null);
    assert.match(res.error, /5.*60/);
  }
});

test('validateDurations and localStorage read/write safely fallback and persist preferences only', () => {
  assert.deepEqual(validateDurations(null), DEFAULT_DURATIONS);
  assert.deepEqual(validateDurations({ focus: 99, short: 10, long: 10.5 }), {
    focus: 25,
    short: 10,
    long: 15,
  });

  const store = memoryStorage();
  assert.deepEqual(readPomodoroPreferences(null), DEFAULT_POMODORO_PREFERENCES);
  assert.deepEqual(readPomodoroPreferences(store), DEFAULT_POMODORO_PREFERENCES);

  store.setItem(POMODORO_PREFERENCES_KEY, '{broken-json');
  assert.deepEqual(readPomodoroPreferences(store), DEFAULT_POMODORO_PREFERENCES);

  store.setItem(
    POMODORO_PREFERENCES_KEY,
    JSON.stringify({
      durations: { focus: 50, short: 0, long: 20 },
      notifications: false,
      autoStart: 'yes',
      timerRunning: true,
    }),
  );
  assert.deepEqual(readPomodoroPreferences(store), {
    durations: { focus: 50, short: 5, long: 20 },
    notifications: false,
    autoStart: false,
  });

  const saved = writePomodoroPreferences(
    {
      durations: { focus: 40, short: 10, long: 20 },
      notifications: false,
      autoStart: true,
    },
    store,
  );
  assert.equal(saved, true);
  const parsed = JSON.parse(store.getItem(POMODORO_PREFERENCES_KEY));
  assert.deepEqual(parsed, {
    durations: { focus: 40, short: 10, long: 20 },
    notifications: false,
    autoStart: true,
  });

  const throwingStorage = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('quota');
    },
  };
  assert.deepEqual(readPomodoroPreferences(throwingStorage), DEFAULT_POMODORO_PREFERENCES);
  assert.equal(writePomodoroPreferences(DEFAULT_POMODORO_PREFERENCES, throwingStorage), false);
  assert.deepEqual(validatePomodoroPreferences('invalid'), DEFAULT_POMODORO_PREFERENCES);
});

test('notification permission helpers respect explicit request and never prompt outside default', async () => {
  assert.equal(getNotificationPermissionState(null), 'unsupported');
  assert.equal(getNotificationPermissionState({ permission: 'default' }), 'default');
  assert.equal(getNotificationPermissionState({ permission: 'granted' }), 'granted');
  assert.equal(getNotificationPermissionState({ permission: 'denied' }), 'denied');

  let calls = 0;
  const grantedApi = {
    permission: 'granted',
    async requestPermission() {
      calls++;
      return 'granted';
    },
  };
  assert.equal(await requestNotificationPermission(grantedApi), 'granted');
  assert.equal(calls, 0);

  const deniedApi = {
    permission: 'denied',
    async requestPermission() {
      calls++;
      return 'granted';
    },
  };
  assert.equal(await requestNotificationPermission(deniedApi), 'denied');
  assert.equal(calls, 0);

  const defaultApi = {
    permission: 'default',
    async requestPermission() {
      calls++;
      this.permission = 'granted';
      return 'granted';
    },
  };
  assert.equal(await requestNotificationPermission(defaultApi), 'granted');
  assert.equal(calls, 1);

  const rejectingApi = {
    permission: 'default',
    async requestPermission() {
      throw new Error('blocked');
    },
  };
  assert.equal(await requestNotificationPermission(rejectingApi), 'default');
});

test('notifyPomodoro fires native Notification only when granted and message is non-empty', () => {
  const created = [];

  class FakeGrantedNotification {
    static permission = 'granted';
    constructor(title, options) {
      created.push({ title, options });
    }
  }

  class FakeDeniedNotification {
    static permission = 'denied';
    constructor(title, options) {
      created.push({ title, options });
    }
  }

  class FakeDefaultNotification {
    static permission = 'default';
    constructor(title, options) {
      created.push({ title, options });
    }
  }

  class ThrowingNotification {
    static permission = 'granted';
    constructor() {
      throw new TypeError('Illegal constructor');
    }
  }

  assert.equal(notifyPomodoro('Hết giờ Tập trung!', null), false);
  assert.equal(notifyPomodoro('Hết giờ Tập trung!', FakeDeniedNotification), false);
  assert.equal(notifyPomodoro('Hết giờ Tập trung!', FakeDefaultNotification), false);
  assert.equal(notifyPomodoro('   ', FakeGrantedNotification), false);
  assert.equal(created.length, 0);

  assert.equal(notifyPomodoro('Hết giờ Tập trung!', FakeGrantedNotification), true);
  assert.deepEqual(created, [{ title: 'Focoya', options: { body: 'Hết giờ Tập trung!' } }]);

  assert.equal(notifyPomodoro('Hết giờ!', ThrowingNotification), false);
});
