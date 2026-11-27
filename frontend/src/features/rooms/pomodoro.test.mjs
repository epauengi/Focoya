import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { URL } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';
const prefsSource = fs.readFileSync(new URL('./pomodoroPreferences.ts', import.meta.url), 'utf8');
const prefsJs = ts.transpileModule(prefsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
}).outputText;
const prefsUrl = `data:text/javascript;base64,${Buffer.from(prefsJs).toString('base64')}`;

const pomodoroSource = fs.readFileSync(new URL('./pomodoro.ts', import.meta.url), 'utf8');
const pomodoroJs = ts
  .transpileModule(pomodoroSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
  })
  .outputText.replace(/(from\s+["'])\.\/pomodoroPreferences(["'])/g, `$1${prefsUrl}$2`);
const pomodoroUrl = `data:text/javascript;base64,${Buffer.from(pomodoroJs).toString('base64')}`;

const { createPomodoroController, DEFAULT_POMODORO_DURATIONS, normalizeDurations } = await import(
  pomodoroUrl
);

const ROOM_A = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const ROOM_B = 'c9b2e04f-6d27-4402-9993-2fb53bf1cf02';
const USER_A = '4251cc03-c9a7-42ac-a3d1-e75850417ab4';
const USER_B = 'df9c1a30-2d69-4e76-9c02-2eeb748341d2';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

class FakeStudySessionError extends Error {
  constructor(message, { uncertain = false, status } = {}) {
    super(message);
    this.name = 'StudySessionError';
    this.uncertain = uncertain;
    if (status !== undefined) this.status = status;
  }
}

function createHarness(overrides = {}) {
  let mono = 1000;
  let wall = 1_700_000_000_000;
  let nextTimerId = 1;
  const intervals = new Map();

  let currentUserId = overrides.userId ?? USER_A;
  let currentGeneration = overrides.generation ?? 1;
  let lockCount = 0;
  let lockReleaseCount = 0;
  let lockShouldReject = null;
  let lockDeferred = null;

  let startCalls = 0;
  let finishCalls = [];
  let startResultFactory = (identity) => ({
    id: `session-${startCalls}`,
    userId: identity.userId,
    roomId: identity.roomId,
    status: 'IN_PROGRESS',
    startedAt: new Date(wall).toISOString(),
    endedAt: null,
    durationMinutes: null,
    xpEarned: 0,
  });
  let finishResultFactory = (identity, expectedSessionId) => ({
    id: expectedSessionId,
    userId: identity.userId,
    roomId: identity.roomId,
    status: 'COMPLETED',
    startedAt: new Date(wall - 25 * 60_000).toISOString(),
    endedAt: new Date(wall).toISOString(),
    durationMinutes: 25,
    xpEarned: 25,
  });

  const inAppNotifications = [];
  const browserNotifications = [];
  const profileRefreshes = [];

  const api = {
    captureStudyIdentity(roomId) {
      if (!currentUserId) return null;
      return { userId: currentUserId, generation: currentGeneration, roomId };
    },
    isStudyIdentityCurrent(identity) {
      return (
        Boolean(currentUserId) &&
        identity.userId === currentUserId &&
        identity.generation === currentGeneration
      );
    },
    async acquireStudyLock() {
      if (lockShouldReject) throw lockShouldReject;
      if (lockDeferred) {
        const release = await lockDeferred.promise;
        return release;
      }
      lockCount += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        lockCount -= 1;
        lockReleaseCount += 1;
      };
    },
    async startStudySession(identity) {
      startCalls += 1;
      return startResultFactory(identity);
    },
    async finishStudySession(identity, expectedSessionId) {
      assert.equal(typeof expectedSessionId, 'string', 'expectedSessionId must be a required string');
      assert.ok(expectedSessionId.length > 0, 'expectedSessionId must be non-empty');
      finishCalls.push({ identity, expectedSessionId });
      return finishResultFactory(identity, expectedSessionId);
    },
    getAuthSnapshot() {
      return { userId: currentUserId, generation: currentGeneration };
    },
  };

  const controller = createPomodoroController({
    roomId: overrides.roomId ?? ROOM_A,
    durations: overrides.durations ?? { focus: 25, short: 5, long: 15 },
    presenceReady: overrides.presenceReady ?? true,
    autoStart: overrides.autoStart ?? false,
    notifications: overrides.notifications ?? true,
    notify: (msg) => inAppNotifications.push(msg),
    notifyBrowser: (msg) => browserNotifications.push(msg),
    onProfileRefresh: (uid) => profileRefreshes.push(uid),
    api,
    clock: {
      nowMono: () => mono,
      nowWall: () => wall,
    },
    timers: {
      setInterval: (fn, ms) => {
        const id = nextTimerId++;
        intervals.set(id, { fn, ms });
        return id;
      },
      clearInterval: (id) => {
        intervals.delete(id);
      },
    },
    tickMs: 250,
  });

  async function flushMicrotasks() {
    for (let i = 0; i < 6; i += 1) {
      await Promise.resolve();
    }
  }

  async function advance(ms, step = 1000) {
    let left = ms;
    while (left > 0) {
      const delta = Math.min(step, left);
      mono += delta;
      wall += delta;
      left -= delta;
      for (const entry of [...intervals.values()]) {
        entry.fn();
      }
      await flushMicrotasks();
    }
  }

  return {
    controller,
    advance,
    flushMicrotasks,
    setMono(v) { mono = v; },
    getMono() { return mono; },
    setWall(v) { wall = v; },
    getWall() { return wall; },
    setAuth(userId, generation = currentGeneration) {
      currentUserId = userId;
      currentGeneration = generation;
    },
    setLockRejected(err) { lockShouldReject = err; },
    setLockDeferred(def) { lockDeferred = def; },
    setStartHandler(fn) { startResultFactory = fn; },
    setFinishHandler(fn) { finishResultFactory = fn; },
    get lockCount() { return lockCount; },
    get lockReleaseCount() { return lockReleaseCount; },
    get startCalls() { return startCalls; },
    get finishCalls() { return finishCalls; },
    get intervalCount() { return intervals.size; },
    inAppNotifications,
    browserNotifications,
    profileRefreshes,
    trackLock() {
      lockCount += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        lockCount -= 1;
        lockReleaseCount += 1;
      };
    },
  };
}

describe('pomodoro controller lifecycle', () => {
  it('validates durations strictly and only emits idle updates when normalized durations change', () => {
    assert.deepEqual(
      normalizeDurations({ focus: 1.5, short: 0, long: 31 }),
      DEFAULT_POMODORO_DURATIONS
    );
    assert.deepEqual(
      normalizeDurations({ focus: 4, short: 16, long: 4.2 }),
      DEFAULT_POMODORO_DURATIONS
    );
    assert.deepEqual(
      normalizeDurations({ focus: 61, short: 5, long: 30 }),
      { focus: 25, short: 5, long: 30 }
    );

    const h = createHarness({ durations: { focus: 30, short: 10, long: 20 } });
    let emits = 0;
    h.controller.subscribe(() => { emits += 1; });

    const snap = h.controller.getSnapshot();
    assert.deepEqual(DEFAULT_POMODORO_DURATIONS, { focus: 25, short: 5, long: 15 });
    assert.equal(snap.state.mode, 'focus');
    assert.equal(snap.state.phase, 'idle');
    assert.equal(snap.state.remaining, 1800);
    assert.equal(snap.intent, null);
    assert.equal(snap.busy, false);
    assert.equal(snap.controlsPresence, false);
    assert.equal(snap.hasUnfinished, false);

    // Passing equivalent durations object must not emit (prevents React render loops).
    h.controller.updateOptions({ durations: { focus: 30, short: 10, long: 20 } });
    assert.equal(emits, 0);

    h.controller.updateOptions({ durations: { focus: 45, short: 5, long: 15 } });
    assert.equal(emits, 1);
    assert.equal(h.controller.getSnapshot().state.remaining, 2700);
    h.controller.dispose();
  });

  it('guards focus start behind presenceReady while allowing local breaks', async () => {
    const h = createHarness({ presenceReady: false });
    const startedFocus = await h.controller.start();
    assert.equal(startedFocus, false);
    assert.equal(h.controller.getSnapshot().state.phase, 'idle');
    assert.equal(h.controller.getSnapshot().intent, null);
    assert.equal(h.startCalls, 0);
    assert.equal(h.lockCount, 0);

    const switched = await h.controller.selectMode('short');
    assert.equal(switched, true);
    const startedBreak = await h.controller.start();
    assert.equal(startedBreak, true);
    assert.equal(h.controller.getSnapshot().state.phase, 'running');
    assert.equal(h.controller.getSnapshot().intent, 'BREAK');
    assert.equal(h.controller.getSnapshot().controlsPresence, true);
    assert.equal(h.controller.getSnapshot().hasUnfinished, false);
    h.controller.dispose();
  });

  it('rejects focus start safely when lock is held or unsupported, without blocking breaks', async () => {
    const h = createHarness();
    h.setLockRejected(new Error('Web Locks unsupported'));
    const ok = await h.controller.start();
    assert.equal(ok, false);
    assert.equal(h.startCalls, 0);
    assert.equal(h.controller.getSnapshot().state.phase, 'idle');
    assert.equal(h.controller.getSnapshot().intent, null);
    assert.match(h.controller.getSnapshot().state.message, /Web Locks unsupported/);

    await h.controller.selectMode('long');
    assert.equal(await h.controller.start(), true);
    assert.equal(h.controller.getSnapshot().intent, 'BREAK');
    h.controller.dispose();
  });

  it('subtracts monotonic start API RTT instead of skewed server wallclock and refreshes profile on start', async () => {
    const h = createHarness({ durations: { focus: 5, short: 5, long: 15 } });
    const startGate = deferred();

    h.setStartHandler(async (identity) => {
      const res = await startGate.promise;
      return {
        ...res,
        userId: identity.userId,
        roomId: identity.roomId,
      };
    });

    const pending = h.controller.start();
    await Promise.resolve();
    const startingSnap = h.controller.getSnapshot();
    assert.equal(startingSnap.state.phase, 'starting');
    assert.equal(startingSnap.busy, true);
    assert.equal(startingSnap.intent, 'IDLE');
    assert.equal(startingSnap.controlsPresence, true);
    assert.equal(startingSnap.hasUnfinished, true);
    assert.equal(h.lockCount, 1);

    // Double start while starting is ignored.
    assert.equal(await h.controller.start(), false);

    h.setMono(h.getMono() + 1500);
    startGate.resolve({
      id: 'sess-rtt',
      status: 'IN_PROGRESS',
      startedAt: new Date(h.getWall() - 600_000).toISOString(),
      endedAt: null,
      durationMinutes: null,
      xpEarned: 0,
    });
    assert.equal(await pending, true);

    assert.deepEqual(h.profileRefreshes, [USER_A], 'start must refresh profile because server closes stale active session');
    const runningSnap = h.controller.getSnapshot();
    assert.equal(runningSnap.state.phase, 'running');
    assert.equal(runningSnap.intent, 'STUDYING');
    assert.equal(runningSnap.busy, false);
    assert.equal(runningSnap.state.remaining, 299); // 300s - 1.5s = 298.5s -> ceil 299s

    // Advance 298.5s more (not 300s!) to verify monotonic RTT deduction triggered completion.
    await h.advance(298_500, 500);
    assert.equal(h.finishCalls.length, 1);
    assert.equal(h.finishCalls[0].expectedSessionId, 'sess-rtt');
    assert.equal(h.controller.getSnapshot().state.phase, 'completed');
    assert.deepEqual(h.profileRefreshes, [USER_A, USER_A]);
    h.controller.dispose();
  });

  it('keeps backend session and lock open on pause and resumes without starting a new session even if presence disconnects', async () => {
    const h = createHarness({ durations: { focus: 5, short: 5, long: 15 } });
    assert.equal(await h.controller.start(), true);
    await h.advance(10_000);
    assert.equal(h.controller.getSnapshot().state.remaining, 290);

    h.controller.pause();
    const paused = h.controller.getSnapshot();
    assert.equal(paused.state.phase, 'paused');
    assert.equal(paused.intent, 'IDLE');
    assert.equal(paused.controlsPresence, true);
    assert.equal(paused.hasUnfinished, true);
    assert.ok(paused.state.session);
    assert.equal(h.lockCount, 1);
    assert.equal(h.intervalCount, 0);

    // Durations update during active paused workflow does not alter remaining.
    h.controller.updateOptions({ durations: { focus: 40, short: 5, long: 15 } });
    assert.equal(h.controller.getSnapshot().state.remaining, 290);

    // Advance wallclock while paused; remaining does not shrink.
    await h.advance(30_000);
    assert.equal(h.controller.getSnapshot().state.remaining, 290);

    // Disconnect presence while paused -> resuming confirmed focus session still succeeds!
    h.controller.updateOptions({ presenceReady: false });
    assert.equal(await h.controller.start(), true);
    assert.equal(h.startCalls, 1, 'resume must not call startStudySession again');
    assert.equal(h.controller.getSnapshot().intent, 'STUDYING');
    await h.advance(290_000);
    assert.equal(h.finishCalls.length, 1);
    assert.equal(h.lockCount, 0);
    h.controller.dispose();
  });

  it('completes instead of freezing at zero when pause() is called after deadline expired', async () => {
    const h = createHarness({ durations: { focus: 5, short: 5, long: 15 } });
    assert.equal(await h.controller.start(), true);

    // Jump wallclock past 5m deadline without ticking interval, then call pause().
    h.setWall(h.getWall() + 300_000);
    h.controller.pause();
    await h.flushMicrotasks();

    assert.equal(h.finishCalls.length, 1);
    assert.equal(h.controller.getSnapshot().state.phase, 'completed');
    assert.equal(h.lockCount, 0);
    h.controller.dispose();
  });

  it('safeguards system suspension via Date.now, ignores backward wall jumps, refreshes on visibility, and fires completion once', async () => {
    const h = createHarness({ durations: { focus: 5, short: 5, long: 15 } });
    const finishGate = deferred();
    h.setFinishHandler(async () => finishGate.promise);

    await h.controller.start();
    // Backward wallclock jump should not inflate remaining time.
    h.setWall(h.getWall() - 3_600_000);
    await h.advance(5_000);
    assert.equal(h.controller.getSnapshot().state.remaining, 295);

    // Simulate OS sleep: wallclock jumps +5m past startWall while monotonic clock stays frozen.
    h.setWall(h.getWall() + 3_600_000 + 300_000);
    h.controller.handleVisibilityChange();
    h.controller.handleVisibilityChange();
    await h.advance(500, 250);

    assert.equal(h.finishCalls.length, 1, 'completion must trigger exactly once');
    assert.equal(h.controller.getSnapshot().state.phase, 'finishing');
    assert.equal(h.controller.getSnapshot().intent, 'IDLE');

    finishGate.resolve({
      id: 'session-1',
      userId: USER_A,
      roomId: ROOM_A,
      status: 'COMPLETED',
      startedAt: '',
      endedAt: '',
      durationMinutes: 5,
      xpEarned: 5,
    });
    await h.flushMicrotasks();

    assert.equal(h.controller.getSnapshot().state.phase, 'completed');
    assert.equal(h.lockCount, 0);
    h.controller.dispose();
  });

  it('auto-advances focus -> short only after valid finish, preserves result, and notifies once', async () => {
    const h = createHarness({
      durations: { focus: 5, short: 5, long: 15 },
      autoStart: true,
      notifications: true,
    });
    await h.controller.start();
    await h.advance(300_000);

    const snap = h.controller.getSnapshot();
    assert.equal(snap.state.mode, 'short');
    assert.equal(snap.state.phase, 'running');
    assert.equal(snap.state.remaining, 300);
    assert.equal(snap.intent, 'BREAK');
    assert.equal(snap.hasUnfinished, false);
    assert.equal(snap.state.result?.xpEarned, 25);
    assert.equal(h.inAppNotifications.length, 1);
    assert.equal(h.browserNotifications.length, 1);
    assert.match(h.browserNotifications[0], /\+25 XP/);
    assert.deepEqual(h.profileRefreshes, [USER_A, USER_A]);
    assert.equal(h.lockCount, 0);

    // Break completes -> auto-advance to focus while presenceReady=true
    await h.advance(300_000);
    const afterBreak = h.controller.getSnapshot();
    assert.equal(afterBreak.state.mode, 'focus');
    assert.equal(afterBreak.state.phase, 'running');
    assert.equal(afterBreak.intent, 'STUDYING');
    assert.equal(afterBreak.state.result?.xpEarned, 25);
    assert.equal(h.inAppNotifications.length, 2);
    assert.equal(h.browserNotifications.length, 2);
    assert.equal(h.startCalls, 2);
    h.controller.dispose();
  });

  it('blocks break -> focus autoStart when presenceReady becomes false and respects notifications=false', async () => {
    const h = createHarness({
      durations: { focus: 5, short: 1, long: 15 },
      autoStart: true,
      notifications: false,
      presenceReady: true,
    });
    await h.controller.start();
    await h.advance(300_000);
    assert.equal(h.controller.getSnapshot().state.mode, 'short');

    h.controller.updateOptions({ presenceReady: false });
    await h.advance(60_000);

    const snap = h.controller.getSnapshot();
    assert.equal(snap.state.mode, 'focus');
    assert.equal(snap.state.phase, 'idle');
    assert.equal(snap.intent, null);
    assert.equal(h.startCalls, 1, 'must not start backend focus without presence');
    assert.equal(h.inAppNotifications.length, 2, 'in-app always notifies');
    assert.equal(h.browserNotifications.length, 0, 'browser notification disabled by preference');
    h.controller.dispose();
  });

  it('freezes lock in uncertain on finish 404/uncertain, notifies browser generically once, prohibits retry/finish, and supports abandon()', async () => {
    for (const err of [
      new FakeStudySessionError('Uncertain timeout', { uncertain: true }),
      new FakeStudySessionError('Not found', { uncertain: false, status: 404 }),
    ]) {
      const h = createHarness({
        durations: { focus: 5, short: 5, long: 15 },
        autoStart: true,
        notifications: true,
      });
      await h.controller.start();
      h.setFinishHandler(async () => { throw err; });
      await h.advance(300_000);

      const snap = h.controller.getSnapshot();
      assert.equal(snap.state.phase, 'uncertain');
      assert.equal(snap.state.mode, 'focus', 'no auto-advance from uncertain');
      assert.equal(snap.intent, 'IDLE');
      assert.equal(snap.controlsPresence, true);
      assert.equal(snap.hasUnfinished, true);
      assert.equal(h.lockCount, 1, 'lock must remain held while uncertain');
      assert.deepEqual(h.profileRefreshes, [USER_A], 'no finish profile refresh on uncertain');
      assert.equal(h.inAppNotifications.length, 1);
      assert.doesNotMatch(h.inAppNotifications[0], /Hãy thử kết thúc lại/);
      assert.doesNotMatch(snap.state.message, /Hãy thử kết thúc lại/);
      assert.equal(h.browserNotifications.length, 1, 'generic browser notification sent once on completion');
      assert.doesNotMatch(h.browserNotifications[0], /XP/, 'browser notification must not claim XP when uncertain');

      // Prohibited actions in uncertain must not retry or issue finishStudySession.
      assert.equal(await h.controller.start(), false);
      assert.equal(await h.controller.end(), false);
      assert.equal(await h.controller.reset(), false);
      assert.equal(await h.controller.selectMode('short'), false);
      assert.equal(h.finishCalls.length, 1, 'no blind finish retry allowed from uncertain');
      assert.equal(h.startCalls, 1);
      assert.equal(h.lockCount, 1);

      // Explicit abandon releases lock without retrying finish.
      h.controller.abandon();
      const abandoned = h.controller.getSnapshot();
      assert.equal(abandoned.state.phase, 'idle');
      assert.equal(abandoned.intent, null);
      assert.equal(abandoned.hasUnfinished, false);
      assert.equal(h.lockCount, 0);
      assert.equal(h.finishCalls.length, 1);
      h.controller.dispose();
    }
  });

  it('recovers active session on definitive finish rejection, allows manual end(), and formats CANCELLED duration + 0 XP', async () => {
    const h = createHarness({ durations: { focus: 5, short: 5, long: 15 } });
    await h.controller.start();
    h.setFinishHandler(async () => {
      throw new FakeStudySessionError('Server validation error', { uncertain: false, status: 500 });
    });

    const firstEnd = await h.controller.end();
    assert.equal(firstEnd, false);
    const paused = h.controller.getSnapshot();
    assert.equal(paused.state.phase, 'paused');
    assert.equal(paused.intent, 'IDLE');
    assert.equal(paused.hasUnfinished, true);
    assert.ok(paused.state.session);
    assert.equal(h.lockCount, 1);
    assert.equal(h.finishCalls.length, 1);
    assert.deepEqual(h.profileRefreshes, [USER_A]);

    // Retry manually after recovery.
    h.setFinishHandler(async (identity, expectedId) => ({
      id: expectedId,
      userId: identity.userId,
      roomId: identity.roomId,
      status: 'CANCELLED',
      startedAt: '',
      endedAt: '',
      durationMinutes: 3,
      xpEarned: 0,
    }));
    const secondEnd = await h.controller.end();
    assert.equal(secondEnd, true);
    assert.equal(h.lockCount, 0);
    const completed = h.controller.getSnapshot();
    assert.equal(completed.state.phase, 'completed');
    assert.equal(completed.state.result?.status, 'CANCELLED');
    assert.match(completed.state.message, /3 phút/);
    assert.match(completed.state.message, /0 XP/);
    assert.deepEqual(h.profileRefreshes, [USER_A, USER_A]);
    h.controller.dispose();
  });

  it('requires focus finish before reset or selectMode and freezes on uncertain failure', async () => {
    const h = createHarness({ durations: { focus: 5, short: 5, long: 15 } });
    await h.controller.start();
    h.setFinishHandler(async () => {
      throw new FakeStudySessionError('Uncertain', { uncertain: true });
    });

    assert.equal(await h.controller.selectMode('short'), false);
    assert.equal(h.controller.getSnapshot().state.mode, 'focus');
    assert.equal(h.controller.getSnapshot().state.phase, 'uncertain');

    // Subsequent reset/selectMode while uncertain are blocked without issuing finish again.
    assert.equal(await h.controller.reset(), false);
    assert.equal(await h.controller.selectMode('short'), false);
    assert.equal(h.finishCalls.length, 1);
    assert.equal(h.controller.getSnapshot().state.phase, 'uncertain');
    h.controller.abandon();

    // Confirmed session allows finish-then-switch.
    await h.controller.start();
    h.setFinishHandler(async (identity, expectedId) => ({
      id: expectedId,
      userId: identity.userId,
      roomId: identity.roomId,
      status: 'CANCELLED',
      startedAt: '',
      endedAt: '',
      durationMinutes: 0,
      xpEarned: 0,
    }));
    assert.equal(await h.controller.selectMode('short'), true);
    assert.equal(h.controller.getSnapshot().state.mode, 'short');
    assert.equal(h.controller.getSnapshot().state.phase, 'idle');
    assert.equal(h.controller.getSnapshot().intent, null);
    assert.equal(h.lockCount, 0);
    h.controller.dispose();
  });

  it('retains lock through pending start/finish POST across unmount and ignores stale responses', async () => {
    // 1) Unmount during pending startStudySession POST
    const h1 = createHarness();
    const startGate = deferred();
    h1.setStartHandler(() => startGate.promise);

    const pStart = h1.controller.start();
    await Promise.resolve();
    assert.equal(h1.lockCount, 1);

    h1.controller.dispose();
    assert.equal(h1.lockCount, 1, 'lock must stay held while start POST is pending');
    assert.equal(h1.finishCalls.length, 0, 'must not call finish on unmount');

    startGate.resolve({
      id: 'late-sess',
      userId: USER_A,
      roomId: ROOM_A,
      status: 'IN_PROGRESS',
      startedAt: '',
      endedAt: null,
      durationMinutes: null,
      xpEarned: 0,
    });
    assert.equal(await pStart, false);
    assert.equal(h1.lockCount, 0, 'lock must release once pending start POST settles');
    assert.equal(h1.profileRefreshes.length, 0);

    // 2) Unmount during pending finishStudySession POST
    const h2 = createHarness();
    await h2.controller.start();
    const finishGate = deferred();
    h2.setFinishHandler(() => finishGate.promise);

    const pEnd = h2.controller.end();
    await Promise.resolve();
    assert.equal(h2.lockCount, 1);

    h2.controller.dispose();
    assert.equal(h2.lockCount, 1, 'lock must stay held while finish POST is pending');

    finishGate.resolve({
      id: 'session-1',
      userId: USER_A,
      roomId: ROOM_A,
      status: 'COMPLETED',
      startedAt: '',
      endedAt: '',
      durationMinutes: 25,
      xpEarned: 25,
    });
    assert.equal(await pEnd, false);
    assert.equal(h2.lockCount, 0, 'lock must release after finish POST settles');
    assert.equal(h2.profileRefreshes.length, 1, 'only initial start refreshed profile');
    assert.equal(h2.inAppNotifications.length, 0);

    // 3) Stale identity during acquireStudyLock releases lock immediately without starting session
    const h3 = createHarness();
    const lockGate = deferred();
    h3.setLockDeferred(lockGate);
    const pLock = h3.controller.start();
    await Promise.resolve();
    h3.setAuth(USER_B, 2);
    h3.controller.syncAuth();
    lockGate.resolve(h3.trackLock());
    assert.equal(await pLock, false);
    assert.equal(h3.startCalls, 0);
    assert.equal(h3.lockCount, 0);
  });

  it('ignores token refresh for same user/generation, but clears UI immediately on auth change', async () => {
    const h = createHarness();
    await h.controller.start();
    await h.advance(5_000);

    // Token refresh keeps same userId & generation -> Pomodoro stays running.
    h.controller.syncAuth();
    assert.equal(h.controller.getSnapshot().state.phase, 'running');
    assert.equal(h.lockCount, 1);

    // Switch account while finish POST is in flight -> UI clears immediately, lock releases after settle.
    const finishGate = deferred();
    h.setFinishHandler(() => finishGate.promise);
    const pEnd = h.controller.end();
    await Promise.resolve();
    assert.equal(h.controller.getSnapshot().state.phase, 'finishing');

    h.setAuth(USER_B, 2);
    h.controller.syncAuth();

    const cleared = h.controller.getSnapshot();
    assert.equal(cleared.state.phase, 'idle');
    assert.equal(cleared.state.session, null);
    assert.equal(cleared.state.result, null);
    assert.equal(cleared.state.message, '');
    assert.equal(cleared.intent, null);
    assert.equal(cleared.hasUnfinished, false);
    assert.equal(h.lockCount, 1, 'lock retained until in-flight finish POST settles');

    finishGate.resolve({
      id: 'session-1',
      userId: USER_A,
      roomId: ROOM_A,
      status: 'COMPLETED',
      startedAt: '',
      endedAt: '',
      durationMinutes: 25,
      xpEarned: 25,
    });
    assert.equal(await pEnd, false);
    assert.equal(h.lockCount, 0);
    assert.equal(h.profileRefreshes.length, 1, 'only initial start refreshed profile');
    assert.equal(h.controller.getSnapshot().state.phase, 'idle');
    h.controller.dispose();
  });

  it('handles uncertain start error safely without finish calls and cleans up on abandon', async () => {
    const h = createHarness();
    h.setStartHandler(async () => {
      throw new FakeStudySessionError('Start response lost', { uncertain: true });
    });

    assert.equal(await h.controller.start(), false);
    const snap = h.controller.getSnapshot();
    assert.equal(snap.state.phase, 'uncertain');
    assert.equal(snap.state.session, null);
    assert.equal(snap.intent, 'IDLE');
    assert.equal(snap.hasUnfinished, true);
    assert.equal(h.lockCount, 1);
    assert.doesNotMatch(snap.state.message, /Hãy thử kết thúc/);

    // No recovery POST without known session ID.
    assert.equal(await h.controller.end(), false);
    assert.equal(await h.controller.reset(), false);
    assert.equal(await h.controller.selectMode('short'), false);
    assert.equal(h.finishCalls.length, 0);

    h.controller.abandon();
    assert.equal(h.controller.getSnapshot().state.phase, 'idle');
    assert.equal(h.lockCount, 0);
    h.controller.dispose();
  });
});

describe('usePomodoro hook contract', () => {
  it('exposes the expected hook state and controls cleanly under SSR render with notifyPomodoro', async () => {
    const reactUrl = import.meta.resolve('react');

    const sessionStub = `
      export function getSession() { return { status: 'authenticated', user: { id: '${USER_A}' }, error: '' }; }
      export function getSessionGeneration() { return 1; }
      export function subscribeSession() { return () => {}; }
    `;
    const sessionUrl = `data:text/javascript;base64,${Buffer.from(sessionStub).toString('base64')}`;

    const studySessionStub = `
      export function captureStudyIdentity(roomId) { return { userId: '${USER_A}', generation: 1, roomId }; }
      export function isStudyIdentityCurrent() { return true; }
      export async function startStudySession() { throw new Error('unused'); }
      export async function finishStudySession() { throw new Error('unused'); }
      export async function acquireStudyLock() { return () => {}; }
    `;
    const studySessionUrl = `data:text/javascript;base64,${Buffer.from(studySessionStub).toString('base64')}`;

    const hookSource = fs.readFileSync(new URL('./usePomodoro.ts', import.meta.url), 'utf8');
    const hookJs = ts
      .transpileModule(hookSource, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
      })
      .outputText.replace(/(from\s+["'])react(["'])/g, `$1${reactUrl}$2`)
      .replace(/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, `$1${sessionUrl}$2`)
      .replace(/(from\s+["'])\.\/pomodoro(["'])/g, `$1${pomodoroUrl}$2`)
      .replace(/(from\s+["'])\.\/pomodoroPreferences(["'])/g, `$1${prefsUrl}$2`)
      .replace(/(from\s+["'])\.\/studySession(["'])/g, `$1${studySessionUrl}$2`);

    const { usePomodoro } = await import(
      `data:text/javascript;base64,${Buffer.from(hookJs).toString('base64')}`
    );

    let captured = null;
    function Probe() {
      captured = usePomodoro({
        roomId: ROOM_B,
        durations: { focus: 20, short: 5, long: 15 },
        presenceReady: true,
        autoStart: false,
        notifications: true,
        notify: () => {},
      });
      return React.createElement('div', null, `${captured.state.mode}:${captured.state.phase}:${captured.state.remaining}`);
    }

    const html = renderToString(React.createElement(Probe));
    assert.equal(html, '<div>focus:idle:1200</div>');
    assert.equal(captured.intent, null);
    assert.equal(captured.busy, false);
    assert.equal(captured.controlsPresence, false);
    assert.equal(captured.hasUnfinished, false);
    for (const fn of ['start', 'pause', 'end', 'reset', 'selectMode', 'abandon']) {
      assert.equal(typeof captured[fn], 'function');
    }
  });
});
