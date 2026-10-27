export const THEMES = ["All Rooms", "Study", "Café", "Nature", "Gaming", "Chill"] as const;
export type RoomTheme = typeof THEMES[number];

export type Room = {
  id: string;
  name: string;
  theme: string;
  online: number;
  maxSlots: number;
  image: string;
  description: string;
  visibility: "PUBLIC" | "PRIVATE";
  inviteCode: string | null;
};

export function isRoomId(id: string | undefined): id is string {
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function parseRoom(value: unknown): Room {
  if (typeof value !== "object" || value === null) throw new Error("Dữ liệu phòng không hợp lệ.");
  const room = value as Room;
  if (!isRoomId(room.id) || typeof room.name !== "string" || !room.name.trim() ||
      typeof room.theme !== "string" || typeof room.description !== "string" ||
      !Number.isInteger(room.maxSlots) || room.maxSlots < 1 ||
      !Number.isInteger(room.online) || room.online < 0 ||
      (room.visibility !== "PUBLIC" && room.visibility !== "PRIVATE") ||
      (room.inviteCode !== null && typeof room.inviteCode !== "string")) {
    throw new Error("Dữ liệu phòng không hợp lệ.");
  }
  // Only use bundled room media; never interpolate arbitrary API URLs into CSS.
  const image = typeof room.image === "string" && /^\/room-assets\/[a-z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(room.image)
    ? room.image : "/room-assets/rainy.jpg";
  return { ...room, image };
}

export const TIMER_MODES = {
  focus: { name: "Tập trung", seconds: 25 * 60 },
  short: { name: "Nghỉ ngắn", seconds: 5 * 60 },
  long: { name: "Nghỉ dài", seconds: 15 * 60 },
} as const;

export function remainingSeconds(deadline: number, now: number) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function formatCountdown(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}
