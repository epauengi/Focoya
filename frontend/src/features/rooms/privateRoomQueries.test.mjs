import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import { URL } from "node:url";
import ts from "typescript";
import { QueryClient } from "@tanstack/react-query";

const reactQueryUrl = import.meta.resolve("@tanstack/react-query");

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
  return globalThis.__PRIVATE_ROOM_QUERIES_SESSION__ ?? { status: "anonymous", user: null, error: "" };
}

export function getSessionGeneration() {
  return globalThis.__PRIVATE_ROOM_QUERIES_GEN__ ?? 0;
}

export async function apiRequest(path, init, expectedUserId) {
  if (!globalThis.__PRIVATE_ROOM_QUERIES_API__) {
    throw new Error(\`Unexpected apiRequest call: \${path}\`);
  }
  return globalThis.__PRIVATE_ROOM_QUERIES_API__(path, init, expectedUserId);
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

const privateRoomQueriesTsSource = fs.readFileSync(new URL("./privateRoomQueries.ts", import.meta.url), "utf8");
const transpiledQueries = ts.transpileModule(privateRoomQueriesTsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
}).outputText
  .replace(/(from\s+["'])@tanstack\/react-query(["'])/g, `$1${reactQueryUrl}$2`)
  .replace(/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, `$1${sessionStubDataUrl}$2`)
  .replace(/(from\s+["'])\.\/rooms(["'])/g, `$1${roomsDataUrl}$2`)
  .replace(/(from\s+["'])\.\/privateRooms(["'])/g, `$1${privateRoomsDataUrl}$2`);
const privateRoomQueriesDataUrl = `data:text/javascript;base64,${Buffer.from(transpiledQueries).toString("base64")}`;
const { ownedRoomsKey, ownedRoomsQuery, privateRoomDetailQuery } = await import(privateRoomQueriesDataUrl);

function jsonResponse(body, status = 200) {
  return new globalThis.Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const USER_A = "4251cc03-c9a7-42ac-a3d1-e75850417ab4";
const USER_B = "df9c1a30-2d69-4e76-9c02-2eeb748341d2";
const ROOM_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const ROOM_ID_B = "c9b2e04f-6d27-4402-9993-2fb53bf1cf02";

const ROOM_A = {
  id: ROOM_ID,
  name: "Phòng A",
  theme: "Study",
  online: 2,
  maxSlots: 12,
  image: "/room-assets/rainy.jpg",
  description: "Phòng của A",
  visibility: "PRIVATE",
  inviteCode: "AA11BB",
};

const ROOM_B = {
  id: ROOM_ID_B,
  name: "Phòng B",
  theme: "Chill",
  online: 1,
  maxSlots: 10,
  image: "/room-assets/bg.png",
  description: "Phòng của B",
  visibility: "PRIVATE",
  inviteCode: "CC22DD",
};

describe("privateRoomQueries unit & QueryClient integration tests", () => {
  beforeEach(() => {
    globalThis.__PRIVATE_ROOM_QUERIES_SESSION__ = {
      status: "authenticated",
      user: { id: USER_A, email: "a@focoya.test", displayName: "A", avatarKey: null, role: "user" },
      error: "",
    };
    globalThis.__PRIVATE_ROOM_QUERIES_GEN__ = 1;
    globalThis.__PRIVATE_ROOM_QUERIES_API__ = null;
  });

  describe("ownedRoomsQuery", () => {
    it("scopes queryKey per userId without any invite code, sets gcTime 0 and sensitive meta", () => {
      assert.deepEqual(ownedRoomsKey(USER_A), ["rooms", "mine", USER_A]);
      assert.deepEqual(ownedRoomsKey(USER_B), ["rooms", "mine", USER_B]);
      assert.notDeepEqual(ownedRoomsKey(USER_A), ownedRoomsKey(USER_B));

      const anonQuery = ownedRoomsQuery(undefined);
      assert.equal(anonQuery.enabled, false);
      assert.deepEqual(anonQuery.queryKey, ["rooms", "mine", ""]);
      assert.equal(anonQuery.gcTime, 0);
      assert.deepEqual(anonQuery.meta, { sensitive: true });

      const userQuery = ownedRoomsQuery(USER_A);
      assert.equal(userQuery.enabled, true);
      assert.deepEqual(userQuery.queryKey, ["rooms", "mine", USER_A]);
      assert.equal(userQuery.gcTime, 0);
      assert.deepEqual(userQuery.meta, { sensitive: true });
    });

    it("isolates QueryClient cache entries per user and never includes inviteCode in keys", async () => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      globalThis.__PRIVATE_ROOM_QUERIES_API__ = async (path, init, expectedUserId) => {
        assert.equal(path, "/rooms/me");
        assert.equal(expectedUserId, USER_A);
        return jsonResponse([ROOM_A]);
      };
      const roomsA = await client.fetchQuery(ownedRoomsQuery(USER_A));
      assert.deepEqual(roomsA, [ROOM_A]);

      globalThis.__PRIVATE_ROOM_QUERIES_SESSION__ = {
        status: "authenticated",
        user: { id: USER_B, email: "b@focoya.test", displayName: "B", avatarKey: null, role: "user" },
        error: "",
      };
      globalThis.__PRIVATE_ROOM_QUERIES_GEN__ = 2;
      globalThis.__PRIVATE_ROOM_QUERIES_API__ = async (path, init, expectedUserId) => {
        assert.equal(path, "/rooms/me");
        assert.equal(expectedUserId, USER_B);
        return jsonResponse([ROOM_B]);
      };
      const roomsB = await client.fetchQuery(ownedRoomsQuery(USER_B));
      assert.deepEqual(roomsB, [ROOM_B]);

      const serializedKeys = client.getQueryCache().getAll().map((q) => JSON.stringify(q.queryKey)).join("|");
      assert.equal(serializedKeys.includes("AA11BB"), false);
      assert.equal(serializedKeys.includes("CC22DD"), false);
      assert.deepEqual(client.getQueryData(ownedRoomsKey(USER_A)), [ROOM_A]);
      assert.deepEqual(client.getQueryData(ownedRoomsKey(USER_B)), [ROOM_B]);
    });
  });

  describe("privateRoomDetailQuery", () => {
    it("scopes detail key by userId and roomId with gcTime 0 and sensitive meta", () => {
      const q = privateRoomDetailQuery(ROOM_ID, USER_A);
      assert.deepEqual(q.queryKey, ["rooms", "private-detail", USER_A, ROOM_ID]);
      assert.equal(q.enabled, true);
      assert.equal(q.gcTime, 0);
      assert.deepEqual(q.meta, { sensitive: true });

      const unauth = privateRoomDetailQuery(ROOM_ID, undefined);
      assert.equal(unauth.enabled, false);
    });

    it("rejects immediately with 401 when unauthenticated or mismatched user without calling API", async () => {
      let called = false;
      globalThis.__PRIVATE_ROOM_QUERIES_API__ = async () => {
        called = true;
        return jsonResponse(ROOM_A);
      };

      await assert.rejects(
        () => privateRoomDetailQuery(ROOM_ID, undefined).queryFn({ signal: undefined }),
        (err) => err instanceof ApiError && err.status === 401
      );
      await assert.rejects(
        () => privateRoomDetailQuery(ROOM_ID, USER_B).queryFn({ signal: undefined }),
        (err) => err instanceof ApiError && err.status === 401
      );
      assert.equal(called, false);
    });

    it("rejects invalid UUID with 404 before calling API", async () => {
      let called = false;
      globalThis.__PRIVATE_ROOM_QUERIES_API__ = async () => {
        called = true;
        return jsonResponse(ROOM_A);
      };

      for (const badId of [undefined, "", "invalid-id", "../rooms"]) {
        await assert.rejects(
          () => privateRoomDetailQuery(badId, USER_A).queryFn({ signal: undefined }),
          (err) => err instanceof ApiError && err.status === 404
        );
      }
      assert.equal(called, false);
    });

    it("requests /rooms/:id with no-store, rejects stale generation mid-flight, and validates room id", async () => {
      let captured = null;
      const controller = new globalThis.AbortController();
      globalThis.__PRIVATE_ROOM_QUERIES_API__ = async (path, init, expectedUserId) => {
        captured = { path, init, expectedUserId };
        return jsonResponse({ ...ROOM_A, id: ROOM_ID.toUpperCase() });
      };

      const room = await privateRoomDetailQuery(ROOM_ID, USER_A).queryFn({ signal: controller.signal });
      assert.equal(captured.path, `/rooms/${ROOM_ID}`);
      assert.equal(captured.init.signal, controller.signal);
      assert.equal(captured.init.cache, "no-store");
      assert.equal(captured.expectedUserId, USER_A);
      assert.equal(room.id, ROOM_ID.toUpperCase());

      globalThis.__PRIVATE_ROOM_QUERIES_API__ = async () => {
        globalThis.__PRIVATE_ROOM_QUERIES_GEN__ = 5;
        return jsonResponse(ROOM_A);
      };
      await assert.rejects(
        () => privateRoomDetailQuery(ROOM_ID, USER_A).queryFn({ signal: undefined }),
        (err) => err instanceof ApiError && err.status === 401
      );

      globalThis.__PRIVATE_ROOM_QUERIES_GEN__ = 1;
      globalThis.__PRIVATE_ROOM_QUERIES_API__ = async () => jsonResponse({ ...ROOM_A, id: ROOM_ID_B });
      await assert.rejects(
        () => privateRoomDetailQuery(ROOM_ID, USER_A).queryFn({ signal: undefined }),
        /Dữ liệu phòng không khớp\./
      );
    });
  });
});
