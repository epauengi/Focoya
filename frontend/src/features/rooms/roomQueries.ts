import { queryOptions } from "@tanstack/react-query";
import { ApiError, apiRequest } from "../../auth/session";
import { isRoomId, parseRoom, type RoomTheme } from "./rooms";

export const roomKeys = {
  all: ["rooms"] as const,
  list: (theme: RoomTheme, q: string) => ["rooms", "list", { theme, q: q.trim() }] as const,
  detail: (id: string | undefined) => ["rooms", "detail", id] as const,
};

export function roomsQuery(theme: RoomTheme = "All Rooms", q = "") {
  const search = q.trim();
  return queryOptions({
    queryKey: roomKeys.list(theme, search),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (theme !== "All Rooms") params.set("theme", theme);
      if (search) params.set("q", search);
      const suffix = params.size ? `?${params}` : "";
      const data: unknown = await (await apiRequest(`/rooms${suffix}`, { signal })).json();
      if (!Array.isArray(data)) throw new Error("Danh sách phòng không hợp lệ.");
      return data.map(parseRoom);
    },
  });
}

export function roomQuery(roomId: string | undefined) {
  return queryOptions({
    queryKey: roomKeys.detail(roomId),
    queryFn: async ({ signal }) => {
      if (!isRoomId(roomId)) throw new ApiError(404, "Phòng không tồn tại.");
      const room = parseRoom(await (await apiRequest(`/rooms/${roomId}`, { signal })).json());
      if (room.id.toLowerCase() !== roomId.toLowerCase()) throw new Error("Dữ liệu phòng không khớp.");
      return room;
    },
  });
}
