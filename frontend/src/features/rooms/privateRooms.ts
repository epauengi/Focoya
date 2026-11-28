import { ApiError, apiRequest, getSession, getSessionGeneration } from '../../auth/session';
import { parseRoom, THEMES, type Room } from './rooms';

export const ROOM_THEMES = THEMES.slice(1);
export const ROOM_IMAGES = ['/room-assets/rainy.jpg', '/room-assets/midnight.png', '/room-assets/autumn.png', '/room-assets/sunset.jpg', '/room-assets/bg.png'] as const;
export type CreatePrivateRoomInput = { name: string; description: string; theme: string; image: string; maxSlots: number };

export function validatePrivateRoom(input: CreatePrivateRoomInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim() || input.name.trim().length > 100) errors.name = 'Tên phòng cần từ 1 đến 100 ký tự.';
  if (input.description.length > 500) errors.description = 'Mô tả tối đa 500 ký tự.';
  if (!ROOM_THEMES.some((theme) => theme === input.theme)) errors.theme = 'Chọn chủ đề hợp lệ.';
  if (input.image && !ROOM_IMAGES.some((image) => image === input.image)) errors.image = 'Chọn hình nền có sẵn.';
  if (!Number.isInteger(input.maxSlots) || input.maxSlots < 10 || input.maxSlots > 30) errors.maxSlots = 'Số chỗ phải là số nguyên từ 10 đến 30.';
  return errors;
}

export function normalizeInviteCode(value: string) {
  const trimmed = value.trim();
  const code = trimmed.toUpperCase();
  if (!/^[A-Za-z0-9]{6}$/.test(trimmed)) throw new Error('Mã mời gồm đúng 6 chữ cái A–Z hoặc chữ số 0–9.');
  return code;
}

export function isCurrentPrivateUser(userId: string, generation: number) {
  return getSession().status === 'authenticated' && getSession().user?.id === userId && getSessionGeneration() === generation;
}

function requireCurrent(userId: string, generation: number) {
  if (!isCurrentPrivateUser(userId, generation)) throw new ApiError(401, 'Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.');
}

export async function fetchOwnedRooms(userId: string, signal?: AbortSignal) {
  const generation = getSessionGeneration();
  requireCurrent(userId, generation);
  const data: unknown = await (await apiRequest('/rooms/me', { signal, cache: 'no-store' }, userId)).json();
  requireCurrent(userId, generation);
  if (!Array.isArray(data)) throw new Error('Danh sách phòng không hợp lệ.');
  return data.map(parseRoom).map((room) => {
    if (room.visibility !== 'PRIVATE') throw new Error('Danh sách phòng riêng không hợp lệ.');
    return room;
  });
}

export async function createPrivateRoom(input: CreatePrivateRoomInput, userId: string): Promise<Room> {
  const errors = validatePrivateRoom(input);
  if (Object.keys(errors).length) throw new ApiError(400, 'Kiểm tra lại thông tin phòng.');
  const generation = getSessionGeneration();
  requireCurrent(userId, generation);
  // Explicit payload: never forward owner identity, visibility or invite credentials.
  const { name, description, theme, image, maxSlots } = input;
  const response = await apiRequest('/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), description, theme, image: image || null, maxSlots }) }, userId);
  const room = parseRoom(await response.json());
  requireCurrent(userId, generation);
  if (room.visibility !== 'PRIVATE' || !room.inviteCode || !/^[A-Z0-9]{6}$/.test(room.inviteCode)) throw new Error('Chưa xác định được kết quả tạo phòng.');
  return room;
}

export async function validateInviteCode(value: string, userId: string): Promise<Room> {
  const code = normalizeInviteCode(value);
  const generation = getSessionGeneration();
  requireCurrent(userId, generation);
  const room = parseRoom(await (await apiRequest(`/rooms/join/${code}`, { cache: 'no-store' }, userId)).json());
  requireCurrent(userId, generation);
  if (room.visibility !== 'PRIVATE') throw new Error('Phòng riêng không hợp lệ.');
  // The invitation credential is kept separately, never in guest metadata/query data.
  return { ...room, inviteCode: null };
}

export function isUncertainCreate(error: unknown) {
  return !(error instanceof ApiError) || error.status >= 500;
}

export function privateRoomMessage(error: unknown, operation: 'create' | 'join' | 'mine') {
  if (!(error instanceof ApiError)) return operation === 'create'
    ? 'Chưa rõ phòng đã được tạo hay chưa. Kiểm tra lại My Rooms trước khi gửi yêu cầu mới.'
    : 'Không thể kết nối hoặc dữ liệu không hợp lệ. Vui lòng thử lại.';
  if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (error.status === 403) return 'Bạn chưa được phép truy cập phòng riêng. Hãy nhập lại mã mời.';
  if (error.status === 404) return operation === 'join' ? 'Mã mời không đúng hoặc phòng đã đóng.' : 'Phòng không tồn tại hoặc đã đóng.';
  if (error.status === 429) return 'Bạn đã thử quá nhiều lần. Vui lòng đợi rồi thử lại.';
  if (error.status === 400) return operation === 'join' ? 'Phòng đã đầy. Thử lại khi có người rời phòng.' : 'Dữ liệu phòng chưa hợp lệ hoặc bạn đã đạt giới hạn 2 phòng riêng. Kiểm tra My Rooms và thông tin đã nhập.';
  return operation === 'create' ? 'Máy chủ gặp lỗi; chưa rõ kết quả tạo phòng. Kiểm tra My Rooms trước khi thử lại.' : 'Máy chủ gặp lỗi. Vui lòng thử lại sau.';
}
