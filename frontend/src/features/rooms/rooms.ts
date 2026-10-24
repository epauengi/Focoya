export const THEMES = ["All Rooms", "Study", "Café", "Nature", "Gaming", "Chill"] as const;
export type RoomTheme = typeof THEMES[number];

export type Room = {
  id: string;
  name: string;
  theme: Exclude<RoomTheme, "All Rooms">;
  online: number;
  maxSlots: number;
  image: string;
  description: string;
};

// ponytail: mock catalog only; replace with the rooms API when backend integration begins.
export const ROOMS: Room[] = [
  { id: "1", name: "Cozy Café", theme: "Café", online: 12, maxSlots: 16, image: "/room-assets/rainy.jpg", description: "Một góc quán cà phê ấm cúng với tiếng nhạc jazz êm dịu và hương cà phê thơm ngát." },
  { id: "2", name: "Sakura Garden", theme: "Nature", online: 8, maxSlots: 12, image: "/room-assets/autumn.png", description: "Cánh hoa anh đào rơi nhẹ trên con đường vắng lặng. Thanh bình và thư thái." },
  { id: "3", name: "Space Station", theme: "Gaming", online: 20, maxSlots: 24, image: "/room-assets/midnight.png", description: "Trạm vũ trụ trong màn đêm tĩnh mịch, không gian lý tưởng cho các game thủ tập trung." },
  { id: "4", name: "Study Corner", theme: "Study", online: 5, maxSlots: 10, image: "/room-assets/rainy.jpg", description: "Bàn học ngăn nắp với ánh đèn vàng dịu nhẹ, thích hợp cho những buổi học sâu." },
  { id: "5", name: "Sunset Lounge", theme: "Chill", online: 15, maxSlots: 20, image: "/room-assets/sunset.jpg", description: "Bầu trời hoàng hôn rực rỡ, những giai điệu lo-fi chill và những câu chuyện nhẹ nhàng." },
  { id: "6", name: "Forest Hideaway", theme: "Nature", online: 7, maxSlots: 10, image: "/room-assets/autumn.png", description: "Một căn nhà gỗ nhỏ ẩn mình giữa rừng cây lá đỏ mùa thu yên tĩnh." },
];

export function getRoom(id: string | undefined) {
  return ROOMS.find((room) => room.id === id);
}

export function filterRooms(theme: RoomTheme, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  return ROOMS.filter((room) => (theme === "All Rooms" || room.theme === theme)
    && room.name.toLocaleLowerCase("vi").includes(normalizedQuery));
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
