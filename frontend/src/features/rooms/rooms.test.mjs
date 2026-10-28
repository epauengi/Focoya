import assert from "node:assert/strict";
import { formatCountdown, isRoomId, parseRoom, remainingSeconds, TIMER_MODES } from "./rooms.ts";

const room = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", name: "Cozy Café", theme: "Café",
  online: 0, maxSlots: 16, image: "/room-assets/rainy.jpg", description: "Phòng học",
  visibility: "PUBLIC", inviteCode: null,
};
assert.ok(isRoomId(room.id));
for (const id of [undefined, "1", "missing", "../rooms", "550e8400e29b41d4a716446655440000"]) assert.equal(isRoomId(id), false);
assert.deepEqual(parseRoom(room), room);
assert.equal(parseRoom({ ...room, image: "javascript:alert(1)" }).image, "/room-assets/rainy.jpg");
assert.equal(parseRoom({ ...room, theme: "New theme" }).theme, "New theme");
for (const value of [null, {}, { ...room, id: "1" }, { ...room, maxSlots: -1 }, { ...room, online: "0" }, { ...room, visibility: "INVALID" }]) {
  assert.throws(() => parseRoom(value), /Dữ liệu phòng không hợp lệ/);
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
