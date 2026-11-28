import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSession, subscribeSession } from '../../auth/session';
import { getPrivateRoomAccess, getPrivateRoomRejection, subscribePrivateRoomAccess } from './privateRoomAccess';
import { privateRoomDetailQuery } from './privateRoomQueries';

export function useAccessibleRoom(roomId: string | undefined) {
  const auth = useSyncExternalStore(subscribeSession, getSession);
  const guest = useSyncExternalStore(subscribePrivateRoomAccess, () => getPrivateRoomAccess(roomId), () => null);
  const rejection = useSyncExternalStore(subscribePrivateRoomAccess, () => getPrivateRoomRejection(roomId), () => null);
  const result = useQuery({ ...privateRoomDetailQuery(roomId, auth.user?.id), enabled: !guest && !rejection && auth.status === 'authenticated' });
  return { auth, guest, rejection, result, room: guest?.room ?? (rejection ? undefined : result.data) };
}
