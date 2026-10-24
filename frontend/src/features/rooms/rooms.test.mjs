import assert from "node:assert/strict";
import { filterRooms, formatCountdown, getRoom, remainingSeconds, ROOMS, TIMER_MODES } from "./rooms.ts";

assert.equal(ROOMS.length, 6);
assert.equal(new Set(ROOMS.map((room) => room.id)).size, ROOMS.length);
assert.equal(getRoom("missing"), undefined);
assert.equal(getRoom(undefined), undefined);
assert.equal(getRoom("1")?.name, "Cozy Café");
assert.equal(filterRooms("All Rooms", "").length, 6);
assert.equal(filterRooms("Nature", "").length, 2);
assert.equal(filterRooms("All Rooms", "  COZY CAFÉ ").length, 1);
assert.equal(filterRooms("Nature", "Cozy").length, 0);
assert.equal(filterRooms("All Rooms", "<script>").length, 0);
for (const room of ROOMS) {
  assert.ok(room.maxSlots >= room.online && room.online >= 0);
  assert.ok(room.image.startsWith("/room-assets/"));
}
assert.equal(remainingSeconds(61_000, 1_000), 60);
assert.equal(remainingSeconds(61_000, 60_500), 1);
assert.equal(remainingSeconds(61_000, 61_000), 0);
assert.equal(remainingSeconds(61_000, 120_000), 0);
assert.equal(formatCountdown(TIMER_MODES.focus.seconds), "25:00");
assert.equal(formatCountdown(TIMER_MODES.short.seconds), "05:00");
assert.equal(formatCountdown(TIMER_MODES.long.seconds), "15:00");
assert.equal(formatCountdown(-1), "00:00");
assert.equal(formatCountdown(1), "00:01");

