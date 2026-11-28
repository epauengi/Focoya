import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import { URL } from "node:url";
import ts from "typescript";

const roomsTsSource = fs.readFileSync(new URL("./rooms.ts", import.meta.url), "utf8");
const transpiledRooms = ts.transpileModule(roomsTsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
}).outputText;
const roomsDataUrl = `data:text/javascript;base64,${Buffer.from(transpiledRooms).toString("base64")}`;

const sessionStubSource = `
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getSession() {
  return globalThis.__PRIVATE_ROOMS_TEST_SESSION__ ?? { status: "anonymous", user: null, error: "" };
}

export function getSessionGeneration() {
  return globalThis.__PRIVATE_ROOMS_TEST_GEN__ ?? 0;
}

export async function apiRequest(path, init, expectedUserId) {
  if (!globalThis.__PRIVATE_ROOMS_TEST_API__) {
    throw new Error(\`Unexpected apiRequest call: \${path}\`);
  }
  return globalThis.__PRIVATE_ROOMS_TEST_API__(path, init, expectedUserId);
}
`;
const sessionStubDataUrl = `data:text/javascript;base64,${Buffer.from(sessionStubSource).toString("base64")}`;
const { ApiError } = await import(sessionStubDataUrl);

const privateRoomsTsSource = fs.readFileSync(new URL("./privateRooms.ts", import.meta.url), "utf8");
const transpiledPrivateRooms = ts.transpileModule(privateRoomsTsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
}).outputText
  .replace(/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, `$1${sessionStubDataUrl}$2`)
  .replace(/(from\s+["'])\.\/rooms(["'])/g, `$1${roomsDataUrl}$2`);
const privateRoomsDataUrl = `data:text/javascript;base64,${Buffer.from(transpiledPrivateRooms).toString("base64")}`;
const {
  ROOM_IMAGES,
  ROOM_THEMES,
  createPrivateRoom,
  fetchOwnedRooms,
  isCurrentPrivateUser,
  isUncertainCreate,
  normalizeInviteCode,
  privateRoomMessage,
  validateInviteCode,
  validatePrivateRoom,
} = await import(privateRoomsDataUrl);

function jsonResponse(body, status = 200) {
  return new globalThis.Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const USER_ID = "4251cc03-c9a7-42ac-a3d1-e75850417ab4";
const OTHER_USER_ID = "df9c1a30-2d69-4e76-9c02-2eeb748341d2";
const ROOM_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

const VALID_INPUT = {
  name: "  Nhóm ôn thi  ",
  description: "Tập trung 90 phút",
  theme: "Study",
  image: "/room-assets/rainy.jpg",
  maxSlots: 15,
};

const VALID_PRIVATE_ROOM = {
  id: ROOM_ID,
  name: "Nhóm ôn thi",
  theme: "Study",
  online: 0,
  maxSlots: 15,
  image: "/room-assets/rainy.jpg",
  description: "Tập trung 90 phút",
  visibility: "PRIVATE",
  inviteCode: "AB12CD",
};

describe("privateRooms unit tests", () => {
  beforeEach(() => {
    globalThis.__PRIVATE_ROOMS_TEST_SESSION__ = {
      status: "authenticated",
      user: { id: USER_ID, email: "u@focoya.test", displayName: "An", avatarKey: null, role: "user" },
      error: "",
    };
    globalThis.__PRIVATE_ROOMS_TEST_GEN__ = 1;
    globalThis.__PRIVATE_ROOMS_TEST_API__ = null;
  });

  describe("themes, images, and validatePrivateRoom limits", () => {
    it("exposes selectable themes excluding All Rooms and bundled room images", () => {
      assert.deepEqual(ROOM_THEMES, ["Study", "Café", "Nature", "Gaming", "Chill"]);
      assert.equal(ROOM_THEMES.includes("All Rooms"), false);
      assert.deepEqual(ROOM_IMAGES, [
        "/room-assets/rainy.jpg",
        "/room-assets/midnight.png",
        "/room-assets/autumn.png",
        "/room-assets/sunset.jpg",
        "/room-assets/bg.png",
      ]);
    });

    it("accepts boundary lengths, valid themes, valid/empty images, and integer maxSlots in 10..30", () => {
      assert.deepEqual(validatePrivateRoom({
        name: "A",
        description: "",
        theme: "Study",
        image: "",
        maxSlots: 10,
      }), {});

      assert.deepEqual(validatePrivateRoom({
        name: `  ${"a".repeat(100)}  `,
        description: "d".repeat(500),
        theme: "Chill",
        image: "/room-assets/bg.png",
        maxSlots: 30,
      }), {});

      for (const theme of ROOM_THEMES) {
        assert.deepEqual(validatePrivateRoom({ ...VALID_INPUT, theme }), {});
      }
      for (const image of ROOM_IMAGES) {
        assert.deepEqual(validatePrivateRoom({ ...VALID_INPUT, image }), {});
      }
    });

    it("rejects out-of-range lengths, invalid themes/images, and invalid maxSlots", () => {
      assert.ok(validatePrivateRoom({ ...VALID_INPUT, name: "" }).name);
      assert.ok(validatePrivateRoom({ ...VALID_INPUT, name: "   \t\n  " }).name);
      assert.ok(validatePrivateRoom({ ...VALID_INPUT, name: "a".repeat(101) }).name);
      assert.ok(validatePrivateRoom({ ...VALID_INPUT, description: "d".repeat(501) }).description);
      assert.ok(validatePrivateRoom({ ...VALID_INPUT, theme: "All Rooms" }).theme);
      assert.ok(validatePrivateRoom({ ...VALID_INPUT, theme: "Custom" }).theme);
      assert.ok(validatePrivateRoom({ ...VALID_INPUT, image: "https://evil.test/pic.jpg" }).image);
      assert.ok(validatePrivateRoom({ ...VALID_INPUT, image: "/room-assets/other.jpg" }).image);

      for (const badSlots of [9, 31, 10.5, NaN, Infinity, "15"]) {
        assert.ok(validatePrivateRoom({ ...VALID_INPUT, maxSlots: badSlots }).maxSlots);
      }
    });
  });

  describe("normalizeInviteCode", () => {
    it("trims and uppercases 6-character alphanumeric codes", () => {
      assert.equal(normalizeInviteCode(" ab12cd "), "AB12CD");
      assert.equal(normalizeInviteCode("00zz99"), "00ZZ99");
    });

    it("rejects codes with wrong length or non-ASCII-alphanumeric characters", () => {
      for (const bad of ["", "   ", "AB12C", "AB12CD3", "AB-12C", "AB 12C", "ÁB12CD", "ab12_d"]) {
        assert.throws(() => normalizeInviteCode(bad), /Mã mời gồm đúng 6 chữ cái A–Z hoặc chữ số 0–9\./);
      }
    });
  });

  describe("isCurrentPrivateUser", () => {
    it("matches only authenticated session with matching userId and generation", () => {
      assert.equal(isCurrentPrivateUser(USER_ID, 1), true);
      assert.equal(isCurrentPrivateUser(OTHER_USER_ID, 1), false);
      assert.equal(isCurrentPrivateUser(USER_ID, 2), false);

      globalThis.__PRIVATE_ROOMS_TEST_SESSION__ = { status: "anonymous", user: null, error: "" };
      assert.equal(isCurrentPrivateUser(USER_ID, 1), false);
    });
  });

  describe("createPrivateRoom", () => {
    it("rejects invalid input locally without making an API request", async () => {
      let called = false;
      globalThis.__PRIVATE_ROOMS_TEST_API__ = async () => {
        called = true;
        return jsonResponse(VALID_PRIVATE_ROOM);
      };

      await assert.rejects(
        () => createPrivateRoom({ ...VALID_INPUT, maxSlots: 9 }, USER_ID),
        (err) => err instanceof ApiError && err.status === 400
      );
      assert.equal(called, false);
    });

    it("sends minimal trimmed payload with image null fallback and verifies PRIVATE + inviteCode response", async () => {
      let captured = null;
      globalThis.__PRIVATE_ROOMS_TEST_API__ = async (path, init, expectedUserId) => {
        captured = { path, init, expectedUserId };
        return jsonResponse(VALID_PRIVATE_ROOM);
      };

      const dirtyInput = {
        ...VALID_INPUT,
        image: "",
        visibility: "PUBLIC",
        inviteCode: "FORGED",
        ownerId: OTHER_USER_ID,
      };
      const room = await createPrivateRoom(dirtyInput, USER_ID);

      assert.equal(captured.path, "/rooms");
      assert.equal(captured.init.method, "POST");
      assert.equal(captured.init.headers["Content-Type"], "application/json");
      assert.equal(captured.expectedUserId, USER_ID);
      assert.deepEqual(JSON.parse(captured.init.body), {
        name: "Nhóm ôn thi",
        description: "Tập trung 90 phút",
        theme: "Study",
        image: null,
        maxSlots: 15,
      });
      assert.deepEqual(room, VALID_PRIVATE_ROOM);
    });

    it("throws uncertain result error when created room is not PRIVATE or lacks valid 6-char inviteCode", async () => {
      for (const badRoom of [
        { ...VALID_PRIVATE_ROOM, visibility: "PUBLIC" },
        { ...VALID_PRIVATE_ROOM, inviteCode: null },
        { ...VALID_PRIVATE_ROOM, inviteCode: "ab12cd" },
        { ...VALID_PRIVATE_ROOM, inviteCode: "ABC12" },
      ]) {
        globalThis.__PRIVATE_ROOMS_TEST_API__ = async () => jsonResponse(badRoom);
        await assert.rejects(
          () => createPrivateRoom(VALID_INPUT, USER_ID),
          /Chưa xác định được kết quả tạo phòng\./
        );
      }
    });

    it("rejects stale account/generation before or during createPrivateRoom", async () => {
      let called = false;
      globalThis.__PRIVATE_ROOMS_TEST_API__ = async () => {
        called = true;
        return jsonResponse(VALID_PRIVATE_ROOM);
      };
      await assert.rejects(
        () => createPrivateRoom(VALID_INPUT, OTHER_USER_ID),
        (err) => err instanceof ApiError && err.status === 401
      );
      assert.equal(called, false);

      globalThis.__PRIVATE_ROOMS_TEST_API__ = async () => {
        globalThis.__PRIVATE_ROOMS_TEST_GEN__ = 2;
        return jsonResponse(VALID_PRIVATE_ROOM);
      };
      await assert.rejects(
        () => createPrivateRoom(VALID_INPUT, USER_ID),
        (err) => err instanceof ApiError && err.status === 401
      );
    });
  });

  describe("validateInviteCode", () => {
    it("rejects malformed invite codes before checking session or calling API", async () => {
      globalThis.__PRIVATE_ROOMS_TEST_SESSION__ = { status: "anonymous", user: null, error: "" };
      let called = false;
      globalThis.__PRIVATE_ROOMS_TEST_API__ = async () => {
        called = true;
        return jsonResponse(VALID_PRIVATE_ROOM);
      };

      await assert.rejects(() => validateInviteCode("bad", USER_ID), /Mã mời gồm đúng 6 chữ cái/);
      assert.equal(called, false);
    });

    it("normalizes code, fetches with cache no-store, rejects PUBLIC rooms, and strips inviteCode", async () => {
      let captured = null;
      globalThis.__PRIVATE_ROOMS_TEST_API__ = async (path, init, expectedUserId) => {
        captured = { path, init, expectedUserId };
        return jsonResponse({ ...VALID_PRIVATE_ROOM, inviteCode: "AB12CD" });
      };

      const room = await validateInviteCode(" ab12cd ", USER_ID);
      assert.equal(captured.path, "/rooms/join/AB12CD");
      assert.equal(captured.init.cache, "no-store");
      assert.equal(captured.expectedUserId, USER_ID);
      assert.equal(room.inviteCode, null);
      assert.equal(room.visibility, "PRIVATE");

      globalThis.__PRIVATE_ROOMS_TEST_API__ = async () => jsonResponse({ ...VALID_PRIVATE_ROOM, visibility: "PUBLIC" });
      await assert.rejects(() => validateInviteCode("AB12CD", USER_ID), /Phòng riêng không hợp lệ\./);
    });

    it("rejects when session generation or user changes mid-flight", async () => {
      globalThis.__PRIVATE_ROOMS_TEST_API__ = async () => {
        globalThis.__PRIVATE_ROOMS_TEST_SESSION__ = {
          status: "authenticated",
          user: { id: OTHER_USER_ID, email: "o@focoya.test", displayName: "Binh", avatarKey: null, role: "user" },
          error: "",
        };
        return jsonResponse(VALID_PRIVATE_ROOM);
      };

      await assert.rejects(
        () => validateInviteCode("AB12CD", USER_ID),
        (err) => err instanceof ApiError && err.status === 401
      );
    });
  });

  describe("fetchOwnedRooms", () => {
    it("requests /rooms/me with signal and userId, validates PRIVATE rooms, and rejects stale generations", async () => {
      let captured = null;
      const controller = new globalThis.AbortController();
      globalThis.__PRIVATE_ROOMS_TEST_API__ = async (path, init, expectedUserId) => {
        captured = { path, init, expectedUserId };
        return jsonResponse([{ ...VALID_PRIVATE_ROOM, image: "https://evil.test/x.jpg" }]);
      };

      const rooms = await fetchOwnedRooms(USER_ID, controller.signal);
      assert.equal(captured.path, "/rooms/me");
      assert.equal(captured.init.signal, controller.signal);
      assert.equal(captured.expectedUserId, USER_ID);
      assert.equal(rooms.length, 1);
      assert.equal(rooms[0].image, "/room-assets/rainy.jpg");
      assert.equal(rooms[0].inviteCode, "AB12CD");

      globalThis.__PRIVATE_ROOMS_TEST_API__ = async () => jsonResponse({ rooms: [] });
      await assert.rejects(() => fetchOwnedRooms(USER_ID), /Danh sách phòng không hợp lệ\./);

      globalThis.__PRIVATE_ROOMS_TEST_API__ = async () => jsonResponse([{ ...VALID_PRIVATE_ROOM, visibility: "PUBLIC" }]);
      await assert.rejects(() => fetchOwnedRooms(USER_ID), /Danh sách phòng riêng không hợp lệ\./);

      globalThis.__PRIVATE_ROOMS_TEST_API__ = async () => {
        globalThis.__PRIVATE_ROOMS_TEST_GEN__ = 9;
        return jsonResponse([VALID_PRIVATE_ROOM]);
      };
      await assert.rejects(
        () => fetchOwnedRooms(USER_ID),
        (err) => err instanceof ApiError && err.status === 401
      );
    });
  });

  describe("isUncertainCreate & privateRoomMessage", () => {
    it("identifies uncertain create failures only for non-ApiError or 5xx status", () => {
      assert.equal(isUncertainCreate(new Error("Network lost")), true);
      assert.equal(isUncertainCreate(null), true);
      assert.equal(isUncertainCreate(new ApiError(500, "Internal")), true);
      assert.equal(isUncertainCreate(new ApiError(503, "Unavailable")), true);

      for (const status of [400, 401, 403, 404, 429]) {
        assert.equal(isUncertainCreate(new ApiError(status, "Client err")), false);
      }
    });

    it("maps error statuses and operations cleanly without exposing raw errors", () => {
      assert.match(privateRoomMessage(new Error("raw stack"), "create"), /Chưa rõ phòng đã được tạo hay chưa.*My Rooms/);
      assert.doesNotMatch(privateRoomMessage(new Error("raw stack"), "create"), /raw stack/);
      assert.match(privateRoomMessage(new Error("raw stack"), "join"), /Không thể kết nối hoặc dữ liệu không hợp lệ/);

      assert.match(privateRoomMessage(new ApiError(401, "x"), "join"), /Phiên đăng nhập đã hết hạn/);
      assert.match(privateRoomMessage(new ApiError(403, "x"), "create"), /Bạn chưa được phép truy cập phòng riêng/);
      assert.match(privateRoomMessage(new ApiError(404, "x"), "join"), /Mã mời không đúng/);
      assert.match(privateRoomMessage(new ApiError(404, "x"), "mine"), /Phòng không tồn tại/);
      assert.match(privateRoomMessage(new ApiError(429, "x"), "join"), /quá nhiều lần/);
      assert.match(privateRoomMessage(new ApiError(400, "x"), "join"), /Phòng đã đầy/);
      assert.match(privateRoomMessage(new ApiError(400, "x"), "create"), /giới hạn 2 phòng riêng/);
      assert.match(privateRoomMessage(new ApiError(500, "raw"), "create"), /chưa rõ kết quả tạo phòng/);
      assert.match(privateRoomMessage(new ApiError(502, "raw"), "mine"), /Máy chủ gặp lỗi/);
    });
  });
});
