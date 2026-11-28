import { getSession, getSessionGeneration, subscribeSession } from '../../auth/session';
import { isCurrentPrivateUser, normalizeInviteCode } from './privateRooms';
import { parseRoom, type Room } from './rooms';

export { isCurrentPrivateUser } from './privateRooms';
type GuestAccess = Readonly<{ room: Room; inviteCode: string; userId: string; generation: number }>;
let access: GuestAccess | null = null;
let rejection: Readonly<{ roomId: string; userId: string; generation: number; code: string }> | null = null;
const listeners = new Set<() => void>();
function publish(next: GuestAccess | null) {
  if (access === next) return;
  access = next;
  listeners.forEach((listener) => listener());
}
export function clearPrivateRoomAccess() { rejection = null; publish(null); }
export function rejectPrivateRoomAccess(roomId: string, code: string) {
  if (!access || access.room.id.toLowerCase() !== roomId.toLowerCase()) return;
  rejection = { roomId: access.room.id, userId: access.userId, generation: access.generation, code };
  publish(null);
}
export function getPrivateRoomRejection(roomId: string | undefined) {
  return rejection && isCurrentPrivateUser(rejection.userId, rejection.generation) && rejection.roomId.toLowerCase() === roomId?.toLowerCase() ? rejection : null;
}
export function subscribePrivateRoomAccess(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function grantPrivateRoomAccess(room: Room, code: string, userId: string, generation: number) {
  if (!isCurrentPrivateUser(userId, generation)) return;
  const parsed = parseRoom(room);
  if (parsed.visibility !== 'PRIVATE') throw new Error('Phòng riêng không hợp lệ.');
  rejection = null;
  publish({ room: { ...parsed, inviteCode: null }, inviteCode: normalizeInviteCode(code), userId, generation });
}
export function getPrivateRoomAccess(roomId: string | undefined) {
  return access && isCurrentPrivateUser(access.userId, access.generation) && access.room.id.toLowerCase() === roomId?.toLowerCase() ? access : null;
}
/** Credential lifetime is this single room flow, never a persisted membership. */
export function retainPrivateRoomAccessForPath(pathname: string) {
  const roomId = access?.room.id ?? rejection?.roomId;
  if (!roomId) return;
  const match = /^\/rooms\/([^/]+)(?:\/preview)?\/?$/.exec(pathname);
  if (!match || match[1].toLowerCase() !== roomId.toLowerCase()) clearPrivateRoomAccess();
}
subscribeSession(() => {
  const identity = access ?? rejection;
  if (identity && (getSession().status !== 'authenticated' || getSession().user?.id !== identity.userId || getSessionGeneration() !== identity.generation)) clearPrivateRoomAccess();
});
