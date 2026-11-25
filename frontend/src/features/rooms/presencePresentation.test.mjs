import assert from 'node:assert/strict';
import test from 'node:test';
import { projectPresence } from './presencePresentation.ts';

const user = (userId, overrides = {}) => ({ userId, displayName: userId, avatarKey: null, status: 'STUDYING', ...overrides });
const snapshot = (users, revision = 1, roomId = 'room-a') => ({ type: 'SNAPSHOT', roomId, revision, onlineCount: users.length, users });

test('initial snapshot and room changes reset without animation events', () => {
  const initial = projectPresence(null, snapshot([user('A')]));
  assert.deepEqual(initial, { roomId: 'room-a', revision: 1, users: [user('A')], entered: [], exited: [] });
  assert.deepEqual(projectPresence(initial, snapshot([user('B')], 0, 'room-b')), {
    roomId: 'room-b', revision: 0, users: [user('B')], entered: [], exited: [],
  });
});

test('retains existing order, appends joins, reports only actual membership changes', () => {
  const previous = projectPresence(null, snapshot([user('A'), user('B'), user('C')]));
  const next = projectPresence(previous, snapshot([user('C'), user('D'), user('A')], 2));
  assert.deepEqual(next.users.map(({ userId }) => userId), ['A', 'C', 'D']);
  assert.deepEqual(next.entered, ['D']);
  assert.deepEqual(next.exited, [{ user: user('B'), index: 1 }]);
});

test('deduplicates case-insensitive IDs and ignores stale revisions', () => {
  const initial = projectPresence(null, snapshot([user('A'), user('a'), user('B')]));
  assert.deepEqual(initial.users.map(({ userId }) => userId), ['A', 'B']);
  const stale = projectPresence(initial, snapshot([user('C')], 0));
  assert.deepEqual(stale, { ...initial, entered: [], exited: [] });
});

test('identical and profile-only updates produce no false animation events', () => {
  const previous = projectPresence(null, snapshot([user('A', { displayName: 'Ada', avatarKey: 'future-avatar', status: 'IDLE' })]));
  assert.deepEqual(previous.users, [user('A', { displayName: 'Ada', avatarKey: 'future-avatar', status: 'IDLE' })]);
  const updatedUser = user('A', { displayName: 'Grace', avatarKey: null, status: 'BREAK' });
  const next = projectPresence(previous, snapshot([updatedUser], 2));
  assert.deepEqual(next.users, [updatedUser]);
  assert.deepEqual(next.entered, []);
  assert.deepEqual(next.exited, []);
  const duplicate = projectPresence(next, snapshot([updatedUser], 2));
  assert.deepEqual(duplicate.entered, []);
  assert.deepEqual(duplicate.exited, []);
});
