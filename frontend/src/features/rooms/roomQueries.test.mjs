import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import { URL } from "node:url";
import ts from "typescript";
import { QueryClient } from "@tanstack/react-query";

const roomsTsSource = fs.readFileSync(new URL("./rooms.ts", import.meta.url), "utf8");
const transpiledRooms = ts.transpileModule(roomsTsSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ESNext,
  },
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

export async function apiRequest(path, init) {
  if (!globalThis.__ROOM_QUERIES_TEST_API_REQUEST__) {
    throw new Error(\`Unexpected apiRequest call: \${path}\`);
  }
  return globalThis.__ROOM_QUERIES_TEST_API_REQUEST__(path, init);
}
`;
const sessionStubDataUrl = `data:text/javascript;base64,${Buffer.from(sessionStubSource).toString("base64")}`;
const { ApiError } = await import(sessionStubDataUrl);

const reactQueryUrl = import.meta.resolve("@tanstack/react-query");

const roomQueriesTsSource = fs.readFileSync(new URL("./roomQueries.ts", import.meta.url), "utf8");
let transpiledRoomQueries = ts.transpileModule(roomQueriesTsSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ESNext,
  },
}).outputText;

transpiledRoomQueries = transpiledRoomQueries
  .replace(/(from\s+["'])@tanstack\/react-query(["'])/g, `$1${reactQueryUrl}$2`)
  .replace(/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, `$1${sessionStubDataUrl}$2`)
  .replace(/(from\s+["'])\.\/rooms(["'])/g, `$1${roomsDataUrl}$2`);

let moduleCounter = 0;
async function loadFreshRoomQueries() {
  const uniqueCode = `${transpiledRoomQueries}\n// instance:${++moduleCounter}`;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(uniqueCode).toString("base64")}`;
  return await import(dataUrl);
}

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

const VALID_ROOM_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const VALID_ROOM_ID_ALT = "c9b2e04f-6d27-4402-9993-2fb53bf1cf02";

const SAMPLE_ROOM = {
  id: VALID_ROOM_ID,
  name: "Cozy Café",
  theme: "Café",
  online: 3,
  maxSlots: 16,
  image: "/room-assets/rainy.jpg",
  description: "Phòng học yên tĩnh",
  visibility: "PUBLIC",
  inviteCode: null,
};

describe("roomQueries unit & integration tests", () => {
  beforeEach(() => {
    globalThis.__ROOM_QUERIES_TEST_API_REQUEST__ = null;
  });

  describe("roomKeys", () => {
    it("defines key hierarchies and trims search query string", async () => {
      const { roomKeys } = await loadFreshRoomQueries();
      assert.deepEqual(roomKeys.all, ["rooms"]);
      assert.deepEqual(roomKeys.list("All Rooms", ""), ["rooms", "list", { theme: "All Rooms", q: "" }]);
      assert.deepEqual(roomKeys.list("Nature", "   deep work   "), ["rooms", "list", { theme: "Nature", q: "deep work" }]);
      assert.deepEqual(roomKeys.detail(VALID_ROOM_ID), ["rooms", "detail", VALID_ROOM_ID]);
      assert.deepEqual(roomKeys.detail(undefined), ["rooms", "detail", undefined]);
    });
  });

  describe("roomsQuery", () => {
    it("requests /rooms without query params for default all rooms", async () => {
      const { roomsQuery } = await loadFreshRoomQueries();
      let captured = null;
      globalThis.__ROOM_QUERIES_TEST_API_REQUEST__ = async (path, init) => {
        captured = { path, init };
        return jsonResponse([SAMPLE_ROOM]);
      };

      const query = roomsQuery();
      const signal = new globalThis.AbortController().signal;
      const result = await query.queryFn({ signal });

      assert.equal(captured.path, "/rooms");
      assert.equal(captured.init.signal, signal);
      assert.deepEqual(result, [SAMPLE_ROOM]);
    });

    it("omits query parameters when theme is All Rooms and query contains only whitespace", async () => {
      const { roomsQuery } = await loadFreshRoomQueries();
      let capturedPath = null;
      globalThis.__ROOM_QUERIES_TEST_API_REQUEST__ = async (path) => {
        capturedPath = path;
        return jsonResponse([]);
      };

      const query = roomsQuery("All Rooms", "     ");
      await query.queryFn({ signal: undefined });
      assert.equal(capturedPath, "/rooms");
      assert.deepEqual(query.queryKey, ["rooms", "list", { theme: "All Rooms", q: "" }]);
    });

    it("encodes theme and search query with exact URLSearchParams escaping", async () => {
      const { roomsQuery } = await loadFreshRoomQueries();
      let capturedPath = null;
      globalThis.__ROOM_QUERIES_TEST_API_REQUEST__ = async (path) => {
        capturedPath = path;
        return jsonResponse([SAMPLE_ROOM]);
      };

      const query = roomsQuery("Café", "focus & chill");
      await query.queryFn({ signal: undefined });
      assert.equal(capturedPath, "/rooms?theme=Caf%C3%A9&q=focus+%26+chill");
      assert.deepEqual(query.queryKey, ["rooms", "list", { theme: "Café", q: "focus & chill" }]);
    });

    it("encodes search-only and theme-only query params correctly", async () => {
      const { roomsQuery } = await loadFreshRoomQueries();
      let capturedPath = null;
      globalThis.__ROOM_QUERIES_TEST_API_REQUEST__ = async (path) => {
        capturedPath = path;
        return jsonResponse([]);
      };

      const queryThemeOnly = roomsQuery("Study", "");
      await queryThemeOnly.queryFn({ signal: undefined });
      assert.equal(capturedPath, "/rooms?theme=Study");

      const querySearchOnly = roomsQuery("All Rooms", "matrix");
      await querySearchOnly.queryFn({ signal: undefined });
      assert.equal(capturedPath, "/rooms?q=matrix");
    });

    it("parses raw room objects and sanitizes unsafe image urls", async () => {
      const { roomsQuery } = await loadFreshRoomQueries();
      const rawRooms = [
        SAMPLE_ROOM,
        {
          id: VALID_ROOM_ID_ALT,
          name: "Study Hall",
          theme: "Study",
          online: 1,
          maxSlots: 10,
          image: "https://evil.test/exploit.png",
          description: "Phòng học tập",
          visibility: "PRIVATE",
          inviteCode: "secret",
        },
      ];

      globalThis.__ROOM_QUERIES_TEST_API_REQUEST__ = async () => jsonResponse(rawRooms);

      const query = roomsQuery();
      const rooms = await query.queryFn({ signal: undefined });

      assert.equal(rooms.length, 2);
      assert.equal(rooms[0].image, "/room-assets/rainy.jpg");
      assert.equal(rooms[1].image, "/room-assets/rainy.jpg");
      assert.equal(rooms[1].visibility, "PRIVATE");
      assert.equal(rooms[1].inviteCode, "secret");
    });

    it("throws specific error when backend returns non-array payload", async () => {
      const { roomsQuery } = await loadFreshRoomQueries();
      for (const nonArray of [null, {}, "invalid", 123, false]) {
        globalThis.__ROOM_QUERIES_TEST_API_REQUEST__ = async () => jsonResponse(nonArray);
        const query = roomsQuery();
        await assert.rejects(
          () => query.queryFn({ signal: undefined }),
          /Danh sách phòng không hợp lệ\./
        );
      }
    });

    it("throws specific error when array element contains malformed room", async () => {
      const { roomsQuery } = await loadFreshRoomQueries();
      const malformedCases = [
        [{ ...SAMPLE_ROOM, id: "invalid-uuid" }],
        [{ ...SAMPLE_ROOM, maxSlots: 0 }],
        [{ ...SAMPLE_ROOM, online: -1 }],
        [{ ...SAMPLE_ROOM, visibility: "UNKNOWN" }],
        [{ ...SAMPLE_ROOM, name: "   " }],
        [null],
      ];

      for (const malformedList of malformedCases) {
        globalThis.__ROOM_QUERIES_TEST_API_REQUEST__ = async () => jsonResponse(malformedList);
        const query = roomsQuery();
        await assert.rejects(
          () => query.queryFn({ signal: undefined }),
          /Dữ liệu phòng không hợp lệ\./
        );
      }
    });
  });

  describe("roomQuery", () => {
    it("requests /rooms/:id with valid UUID and forwards AbortSignal", async () => {
      const { roomQuery } = await loadFreshRoomQueries();
      let captured = null;
      globalThis.__ROOM_QUERIES_TEST_API_REQUEST__ = async (path, init) => {
        captured = { path, init };
        return jsonResponse(SAMPLE_ROOM);
      };

      const query = roomQuery(VALID_ROOM_ID);
      const signal = new globalThis.AbortController().signal;
      const room = await query.queryFn({ signal });

      assert.equal(captured.path, `/rooms/${VALID_ROOM_ID}`);
      assert.equal(captured.init.signal, signal);
      assert.deepEqual(room, SAMPLE_ROOM);
      assert.deepEqual(query.queryKey, ["rooms", "detail", VALID_ROOM_ID]);
    });

    it("rejects with 404 ApiError immediately without apiRequest call for invalid UUIDs", async () => {
      const { roomQuery } = await loadFreshRoomQueries();
      const invalidIds = [
        undefined,
        null,
        "",
        "1",
        "invalid-id",
        "../rooms",
        "3fa85f6457174562b3fc2c963f66afa6",
        "3fa85f64-5717-4562-b3fc-2c963f66afa6-extra",
      ];

      let apiCallCount = 0;
      globalThis.__ROOM_QUERIES_TEST_API_REQUEST__ = async () => {
        apiCallCount++;
        return jsonResponse(SAMPLE_ROOM);
      };

      for (const invalidId of invalidIds) {
        const query = roomQuery(invalidId);
        await assert.rejects(
          () => query.queryFn({ signal: undefined }),
          (err) => err instanceof ApiError && err.status === 404 && err.message === "Phòng không tồn tại."
        );
      }

      assert.equal(apiCallCount, 0);
    });

    it("throws error when returned payload fails room schema", async () => {
      const { roomQuery } = await loadFreshRoomQueries();
      globalThis.__ROOM_QUERIES_TEST_API_REQUEST__ = async () => jsonResponse({ ...SAMPLE_ROOM, maxSlots: "16" });

      const query = roomQuery(VALID_ROOM_ID);
      await assert.rejects(
        () => query.queryFn({ signal: undefined }),
        /Dữ liệu phòng không hợp lệ\./
      );
    });

    it("throws error when response room id does not match requested roomId", async () => {
      const { roomQuery } = await loadFreshRoomQueries();
      globalThis.__ROOM_QUERIES_TEST_API_REQUEST__ = async () => jsonResponse({
        ...SAMPLE_ROOM,
        id: VALID_ROOM_ID_ALT,
      });

      const query = roomQuery(VALID_ROOM_ID);
      await assert.rejects(
        () => query.queryFn({ signal: undefined }),
        /Dữ liệu phòng không khớp\./
      );
    });

    it("accepts case-insensitive matching room id from backend", async () => {
      const { roomQuery } = await loadFreshRoomQueries();
      const upperCaseId = VALID_ROOM_ID.toUpperCase();
      globalThis.__ROOM_QUERIES_TEST_API_REQUEST__ = async () => jsonResponse({
        ...SAMPLE_ROOM,
        id: upperCaseId,
      });

      const query = roomQuery(VALID_ROOM_ID);
      const room = await query.queryFn({ signal: undefined });
      assert.equal(room.id, upperCaseId);
    });
  });

  describe("QueryClient caching & retry integration", () => {
    it("caches roomsQuery results and avoids duplicate api requests", async () => {
      const { roomsQuery } = await loadFreshRoomQueries();
      let callCount = 0;
      globalThis.__ROOM_QUERIES_TEST_API_REQUEST__ = async () => {
        callCount++;
        return jsonResponse([SAMPLE_ROOM]);
      };

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: false,
          },
        },
      });

      const first = await queryClient.fetchQuery(roomsQuery("Chill", "lofi"));
      const second = await queryClient.fetchQuery(roomsQuery("Chill", "lofi"));

      assert.equal(callCount, 1);
      assert.deepEqual(first, [SAMPLE_ROOM]);
      assert.deepEqual(second, [SAMPLE_ROOM]);
    });

    it("caches roomQuery result and invalidates correctly", async () => {
      const { roomQuery, roomKeys } = await loadFreshRoomQueries();
      let callCount = 0;
      globalThis.__ROOM_QUERIES_TEST_API_REQUEST__ = async () => {
        callCount++;
        return jsonResponse(SAMPLE_ROOM);
      };

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: false,
          },
        },
      });

      await queryClient.fetchQuery(roomQuery(VALID_ROOM_ID));
      assert.equal(callCount, 1);

      await queryClient.fetchQuery(roomQuery(VALID_ROOM_ID));
      assert.equal(callCount, 1);

      await queryClient.invalidateQueries({ queryKey: roomKeys.detail(VALID_ROOM_ID) });
      await queryClient.fetchQuery(roomQuery(VALID_ROOM_ID));
      assert.equal(callCount, 2);
    });

    it("executes retry policy on transient apiRequest errors", async () => {
      const { roomQuery } = await loadFreshRoomQueries();
      let attempts = 0;
      globalThis.__ROOM_QUERIES_TEST_API_REQUEST__ = async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error("Temporary network glitch");
        }
        return jsonResponse(SAMPLE_ROOM);
      };

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            retryDelay: 1,
          },
        },
      });

      const result = await queryClient.fetchQuery(roomQuery(VALID_ROOM_ID));
      assert.equal(attempts, 2);
      assert.deepEqual(result, SAMPLE_ROOM);
    });
  });
});
