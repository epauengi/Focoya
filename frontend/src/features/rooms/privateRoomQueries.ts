import { queryOptions } from '@tanstack/react-query';
import { ApiError, apiRequest, getSessionGeneration } from '../../auth/session';
import { isRoomId, parseRoom } from './rooms';
import { fetchOwnedRooms, isCurrentPrivateUser } from './privateRooms';

export const ownedRoomsKey = (userId: string) => ['rooms', 'mine', userId] as const;
export function ownedRoomsQuery(userId: string | undefined) {
  return queryOptions({
    queryKey: ownedRoomsKey(userId ?? ''),
    enabled: Boolean(userId),
    queryFn: ({ signal }) => fetchOwnedRooms(userId ?? '', signal),
    gcTime: 0,
    meta: { sensitive: true },
  });
}

// Auth-scoped details prevent owner invite codes crossing accounts. Guests never populate this cache.
export function privateRoomDetailQuery(roomId: string | undefined, userId: string | undefined) {
  return queryOptions({
    queryKey: ['rooms', 'private-detail', userId, roomId] as const,
    enabled: Boolean(userId),
    gcTime: 0,
    meta: { sensitive: true },
    queryFn: async ({ signal }) => {
      const generation = getSessionGeneration();
      if (!userId || !isCurrentPrivateUser(userId, generation)) throw new ApiError(401, 'Vui lòng đăng nhập lại.');
      if (!isRoomId(roomId)) throw new ApiError(404, 'Phòng không tồn tại.');
      const room = parseRoom(await (await apiRequest(`/rooms/${roomId}`, { signal, cache: 'no-store' }, userId)).json());
      if (!isCurrentPrivateUser(userId, generation)) throw new ApiError(401, 'Phiên đăng nhập đã thay đổi.');
      if (room.id.toLowerCase() !== roomId.toLowerCase()) throw new Error('Dữ liệu phòng không khớp.');
      return room;
    },
  });
}
