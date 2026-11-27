import { afterEach, beforeEach, describe, it } from "node:test";
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

export async function apiRequest(path, init, expectedUserId) {
  if (!globalThis.__STUDY_SESSION_TEST_API_REQUEST__) {
    throw new Error("Unexpected apiRequest call: " + path);
  }
  return globalThis.__STUDY_SESSION_TEST_API_REQUEST__(path, init, expectedUserId);
}

export function getSession() {
  return globalThis.__STUDY_SESSION_TEST_SESSION__;
}

export function getSessionGeneration() {
  return globalThis.__STUDY_SESSION_TEST_GENERATION__;
}
`;
const sessionStubUrl = `data:text/javascript;base64,${Buffer.from(sessionStubSource).toString("base64")}`;

const studySessionTsSource = fs.readFileSync(new URL("./studySession.ts", import.meta.url), "utf8");
const transpiledTemplate = ts.transpileModule(studySessionTsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
}).outputText;

const stubbedCode = transpiledTemplate
  .replace(/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, `$1${sessionStubUrl}$2`)
  .replace(/(from\s+["'])\.\/rooms(["'])/g, `$1${roomsDataUrl}$2`);
const stubbedStudySession = await import(
  `data:text/javascript;base64,${Buffer.from(stubbedCode).toString("base64")}`
);

const {
  StudySessionError,
  acquireStudyLock,
  captureStudyIdentity,
  finishStudySession,
  isStudyIdentityCurrent,
  startStudySession,
} = stubbedStudySession;

const USER_ID = "11111111-2222-4333-8444-555555555555";
const OTHER_USER_ID = "99999999-2222-4333-8444-555555555555";
const ROOM_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const OTHER_ROOM_ID = "c9b2e04f-6d27-4402-9993-2fb53bf1cf02";
const SESSION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const OTHER_SESSION_ID = "ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function makeRunningSession(overrides = {}) {
  return {
    id: SESSION_ID,
    userId: USER_ID,
    roomId: ROOM_ID,
    status: "IN_PROGRESS",
    startedAt: "2026-11-27T10:00:00Z",
    endedAt: null,
    durationMinutes: null,
    xpEarned: 0,
    ...overrides,
  };
}

function makeFinishedSession(overrides = {}) {
  return {
    id: SESSION_ID,
    userId: USER_ID,
    roomId: ROOM_ID,
    status: "COMPLETED",
    startedAt: "2026-11-27T10:00:00Z",
    endedAt: "2026-11-27T10:25:00Z",
    durationMinutes: 25,
    xpEarned: 25,
    ...overrides,
  };
}

class MemoryStorage {
  constructor() {
    this.map = new Map();
    this.touches = 0;
  }
  getItem(k) {
    this.touches++;
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    this.touches++;
    this.map.set(String(k), String(v));
  }
  removeItem(k) {
    this.touches++;
    this.map.delete(String(k));
  }
  clear() {
    this.map.clear();
  }
}

function createFakeWebLocks() {
  const held = new Set();
  return {
    held,
    async request(name, options, callback) {
      if (typeof options === "function") {
        callback = options;
        options = {};
      }
      if (options?.ifAvailable && held.has(name)) {
        return callback(null);
      }
      held.add(name);
      try {
        return await callback({ name, mode: options?.mode ?? "exclusive" });
      } finally {
        held.delete(name);
      }
    },
  };
}

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalSessionStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
const originalFetch = globalThis.fetch;

function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
}

function restoreGlobal(name, descriptor) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
  } else {
    delete globalThis[name];
  }
}

describe("studySession identity, API validation & cross-tab lock", () => {
  let fakeLocalStorage;
  let fakeSessionStorage;

  beforeEach(() => {
    globalThis.__STUDY_SESSION_TEST_SESSION__ = {
      status: "authenticated",
      user: { id: USER_ID },
      error: "",
    };
    globalThis.__STUDY_SESSION_TEST_GENERATION__ = 1;
    globalThis.__STUDY_SESSION_TEST_API_REQUEST__ = null;
    fakeLocalStorage = new MemoryStorage();
    fakeSessionStorage = new MemoryStorage();
    setGlobal("localStorage", fakeLocalStorage);
    setGlobal("sessionStorage", fakeSessionStorage);
  });

  afterEach(() => {
    restoreGlobal("navigator", originalNavigatorDescriptor);
    restoreGlobal("localStorage", originalLocalStorageDescriptor);
    restoreGlobal("sessionStorage", originalSessionStorageDescriptor);
    globalThis.fetch = originalFetch;
  });

  describe("captureStudyIdentity & isStudyIdentityCurrent", () => {
    it("captures userId, generation, roomId when authenticated with valid roomId", () => {
      const identity = captureStudyIdentity(ROOM_ID);
      assert.deepEqual(identity, { userId: USER_ID, generation: 1, roomId: ROOM_ID });
      assert.equal(isStudyIdentityCurrent(identity), true);
    });

    it("rejects definitively when unauthenticated or roomId invalid", () => {
      assert.throws(
        () => captureStudyIdentity("not-a-uuid"),
        (err) => err instanceof StudySessionError && err.uncertain === false && err.message.length > 0,
      );

      globalThis.__STUDY_SESSION_TEST_SESSION__ = { status: "anonymous", user: null, error: "" };
      assert.throws(
        () => captureStudyIdentity(ROOM_ID),
        (err) => err instanceof StudySessionError && err.uncertain === false && err.message.length > 0,
      );
    });

    it("detects logout, account switch, and same-user re-login via generation", () => {
      const identity = captureStudyIdentity(ROOM_ID);
      assert.equal(isStudyIdentityCurrent(identity), true);

      globalThis.__STUDY_SESSION_TEST_GENERATION__ = 2;
      assert.equal(isStudyIdentityCurrent(identity), false);

      globalThis.__STUDY_SESSION_TEST_GENERATION__ = 1;
      globalThis.__STUDY_SESSION_TEST_SESSION__ = {
        status: "authenticated",
        user: { id: OTHER_USER_ID },
        error: "",
      };
      assert.equal(isStudyIdentityCurrent(identity), false);

      globalThis.__STUDY_SESSION_TEST_SESSION__ = { status: "error", user: null, error: "err" };
      assert.equal(isStudyIdentityCurrent(identity), false);
      assert.equal(isStudyIdentityCurrent(null), false);
    });
  });

  describe("startStudySession", () => {
    it("posts to /study-sessions/start without /api prefix and validates response", async () => {
      const identity = captureStudyIdentity(ROOM_ID);
      let captured = null;
      globalThis.__STUDY_SESSION_TEST_API_REQUEST__ = async (path, init, expectedUserId) => {
        captured = { path, init, expectedUserId };
        return jsonResponse(makeRunningSession(), 201);
      };

      const session = await startStudySession(identity);
      assert.equal(captured.path, "/study-sessions/start");
      assert.equal(captured.init.method, "POST");
      assert.deepEqual(JSON.parse(captured.init.body), { roomId: ROOM_ID });
      assert.equal(captured.expectedUserId, USER_ID);
      assert.deepEqual(session, makeRunningSession());
    });

    it("accepts case-insensitive UUID matching for userId and roomId", async () => {
      const identity = captureStudyIdentity(ROOM_ID);
      globalThis.__STUDY_SESSION_TEST_API_REQUEST__ = async () =>
        jsonResponse(
          makeRunningSession({
            userId: USER_ID.toUpperCase(),
            roomId: ROOM_ID.toUpperCase(),
          }),
          201,
        );

      const session = await startStudySession(identity);
      assert.equal(session.status, "IN_PROGRESS");
    });

    it("rejects definitively before HTTP when identity is stale", async () => {
      const identity = captureStudyIdentity(ROOM_ID);
      globalThis.__STUDY_SESSION_TEST_GENERATION__ = 2;
      let calls = 0;
      globalThis.__STUDY_SESSION_TEST_API_REQUEST__ = async () => {
        calls++;
        return jsonResponse(makeRunningSession(), 201);
      };

      await assert.rejects(
        () => startStudySession(identity),
        (err) => err instanceof StudySessionError && err.uncertain === false,
      );
      assert.equal(calls, 0);
    });

    it("rejects definitively when identity changes while request is in flight", async () => {
      const identity = captureStudyIdentity(ROOM_ID);
      globalThis.__STUDY_SESSION_TEST_API_REQUEST__ = async () => {
        globalThis.__STUDY_SESSION_TEST_GENERATION__ = 2;
        return jsonResponse(makeRunningSession(), 201);
      };

      await assert.rejects(
        () => startStudySession(identity),
        (err) => err instanceof StudySessionError && err.uncertain === false,
      );
    });

    it("treats definitive 4xx rejections (400/401/403/404) as uncertain=false", async () => {
      const { ApiError } = await import(sessionStubUrl);
      const identity = captureStudyIdentity(ROOM_ID);

      for (const [status, msg] of [
        [400, "roomId không hợp lệ"],
        [401, "Vui lòng đăng nhập lại."],
        [403, "Không có quyền."],
        [404, "Phòng không tồn tại hoặc đã đóng"],
      ]) {
        globalThis.__STUDY_SESSION_TEST_API_REQUEST__ = async () => {
          throw new ApiError(status, msg);
        };
        await assert.rejects(
          () => startStudySession(identity),
          (err) =>
            err instanceof StudySessionError &&
            err.uncertain === false &&
            err.status === status &&
            err.message === msg,
        );
      }
    });

    it("treats network error, 5xx, malformed JSON, invalid payload, and mismatches as uncertain=true without retrying", async () => {
      const { ApiError } = await import(sessionStubUrl);
      const identity = captureStudyIdentity(ROOM_ID);

      const uncertainCases = [
        async () => {
          throw new TypeError("Failed to fetch");
        },
        async () => {
          throw new ApiError(500, "Máy chủ gặp lỗi.");
        },
        async () => ({
          ok: true,
          status: 201,
          json: async () => {
            throw new SyntaxError("Unexpected token");
          },
        }),
        async () => jsonResponse(null, 201),
        async () => jsonResponse(makeRunningSession({ id: "bad-uuid" }), 201),
        async () => jsonResponse(makeRunningSession({ startedAt: "not-a-date" }), 201),
        async () => jsonResponse(makeRunningSession({ endedAt: "2026-11-27T10:10:00Z" }), 201),
        async () => jsonResponse(makeRunningSession({ xpEarned: 5 }), 201),
        async () => jsonResponse(makeRunningSession({ userId: OTHER_USER_ID }), 201),
        async () => jsonResponse(makeRunningSession({ roomId: OTHER_ROOM_ID }), 201),
        async () => jsonResponse(makeFinishedSession(), 201),
      ];

      for (const handler of uncertainCases) {
        let calls = 0;
        globalThis.__STUDY_SESSION_TEST_API_REQUEST__ = async () => {
          calls++;
          return handler();
        };
        await assert.rejects(
          () => startStudySession(identity),
          (err) =>
            err instanceof StudySessionError &&
            err.uncertain === true &&
            typeof err.message === "string" &&
            err.message.length > 0 &&
            !/Failed to fetch|Unexpected token/.test(err.message),
        );
        assert.equal(calls, 1);
      }
    });
  });

  describe("finishStudySession", () => {
    it("posts to /study-sessions/finish with no body and validates COMPLETED and CANCELLED", async () => {
      const identity = captureStudyIdentity(ROOM_ID);
      let captured = null;
      globalThis.__STUDY_SESSION_TEST_API_REQUEST__ = async (path, init, expectedUserId) => {
        captured = { path, init, expectedUserId };
        return jsonResponse(makeFinishedSession(), 200);
      };

      const completed = await finishStudySession(identity, SESSION_ID);
      assert.equal(captured.path, "/study-sessions/finish");
      assert.equal(captured.init.method, "POST");
      assert.equal(captured.init.body, undefined);
      assert.equal(captured.expectedUserId, USER_ID);
      assert.deepEqual(completed, makeFinishedSession());

      const cancelledPayload = makeFinishedSession({
        status: "CANCELLED",
        durationMinutes: 3,
        xpEarned: 0,
      });
      globalThis.__STUDY_SESSION_TEST_API_REQUEST__ = async () => jsonResponse(cancelledPayload, 200);
      const cancelled = await finishStudySession(identity, SESSION_ID.toUpperCase());
      assert.equal(cancelled.status, "CANCELLED");
      assert.equal(cancelled.xpEarned, 0);
    });

    it("rejects definitively before HTTP when expectedSessionId is missing/invalid or identity is stale", async () => {
      const identity = captureStudyIdentity(ROOM_ID);
      let calls = 0;
      globalThis.__STUDY_SESSION_TEST_API_REQUEST__ = async () => {
        calls++;
        return jsonResponse(makeFinishedSession(), 200);
      };

      for (const badId of [undefined, null, "", "   ", "bad-session-id"]) {
        await assert.rejects(
          () => finishStudySession(identity, badId),
          (err) => err instanceof StudySessionError && err.uncertain === false,
        );
      }

      globalThis.__STUDY_SESSION_TEST_GENERATION__ = 9;
      await assert.rejects(
        () => finishStudySession(identity, SESSION_ID),
        (err) => err instanceof StudySessionError && err.uncertain === false,
      );
      assert.equal(calls, 0);
    });

    it("treats 401/403/400 as uncertain=false and finish404/network/5xx/invalid/mismatch as uncertain=true", async () => {
      const { ApiError } = await import(sessionStubUrl);
      const identity = captureStudyIdentity(ROOM_ID);

      for (const status of [400, 401, 403]) {
        globalThis.__STUDY_SESSION_TEST_API_REQUEST__ = async () => {
          throw new ApiError(status, "Lỗi xác thực");
        };
        await assert.rejects(
          () => finishStudySession(identity, SESSION_ID),
          (err) => err instanceof StudySessionError && err.uncertain === false && err.status === status,
        );
      }

      const uncertainCases = [
        async () => {
          throw new ApiError(404, "Bạn không có phiên học nào đang diễn ra");
        },
        async () => {
          throw new ApiError(503, "Unavailable");
        },
        async () => {
          throw new Error("Network failure");
        },
        async () => jsonResponse(makeFinishedSession({ endedAt: null }), 200),
        async () => jsonResponse(makeFinishedSession({ endedAt: "2026-11-27T09:59:00Z" }), 200),
        async () => jsonResponse(makeFinishedSession({ durationMinutes: -1 }), 200),
        async () => jsonResponse(makeFinishedSession({ status: "CANCELLED", xpEarned: 10 }), 200),
        async () => jsonResponse(makeFinishedSession({ id: OTHER_SESSION_ID }), 200),
        async () => jsonResponse(makeFinishedSession({ userId: OTHER_USER_ID }), 200),
        async () => jsonResponse(makeFinishedSession({ roomId: OTHER_ROOM_ID }), 200),
        async () => jsonResponse(makeRunningSession(), 200),
      ];

      for (const handler of uncertainCases) {
        let calls = 0;
        globalThis.__STUDY_SESSION_TEST_API_REQUEST__ = async () => {
          calls++;
          return handler();
        };
        await assert.rejects(
          () => finishStudySession(identity, SESSION_ID),
          (err) => err instanceof StudySessionError && err.uncertain === true,
        );
        assert.equal(calls, 1);
      }
    });
  });

  describe("acquireStudyLock", () => {
    it("rejects conservatively when Web Locks API is unavailable without touching localStorage", async () => {
      setGlobal("navigator", {});
      await assert.rejects(
        () => acquireStudyLock(USER_ID),
        (err) => err instanceof StudySessionError && err.uncertain === false,
      );
      assert.equal(fakeLocalStorage.touches, 0);
      assert.equal(fakeSessionStorage.touches, 0);
    });

    it("holds Web Lock until release(), blocks concurrent same-user acquires, allows different users, and releases idempotently", async () => {
      const fakeLocks = createFakeWebLocks();
      setGlobal("navigator", { locks: fakeLocks });

      const release = await acquireStudyLock(USER_ID);
      assert.equal(fakeLocks.held.has(`focoya:study-session:${USER_ID}`), true);

      await assert.rejects(
        () => acquireStudyLock(USER_ID.toUpperCase()),
        (err) => err instanceof StudySessionError && err.uncertain === false,
      );

      const releaseOther = await acquireStudyLock(OTHER_USER_ID);
      releaseOther();

      release();
      release();
      await Promise.resolve();
      assert.equal(fakeLocks.held.has(`focoya:study-session:${USER_ID}`), false);

      const reacquired = await acquireStudyLock(USER_ID);
      reacquired();
      assert.equal(fakeLocalStorage.touches, 0);
      assert.equal(fakeSessionStorage.touches, 0);
    });

    it("rejects conservatively if Web Locks API throws", async () => {
      setGlobal("navigator", {
        locks: {
          request() {
            return Promise.reject(new Error("SecurityError"));
          },
        },
      });

      await assert.rejects(
        () => acquireStudyLock(USER_ID),
        (err) => err instanceof StudySessionError && err.uncertain === false,
      );
      assert.equal(fakeLocalStorage.touches, 0);
    });
  });

  describe("real auth/session integration (401 auth replay & no retry on 500)", () => {
    function createJwt(expiresInSeconds = 3600) {
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
      const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
      const payload = Buffer.from(JSON.stringify({ exp, sub: USER_ID })).toString("base64url");
      return `${header}.${payload}.sig`;
    }

    async function loadWithRealSession() {
      globalThis.__STUDY_SESSION_REAL_ENV__ = { VITE_API_BASE_URL: "https://api.focoya.test/api" };
      const realSessionSource = fs
        .readFileSync(new URL("../../auth/session.ts", import.meta.url), "utf8")
        .replace(/import\.meta\.env/g, "globalThis.__STUDY_SESSION_REAL_ENV__");
      const realSessionJs = ts.transpileModule(realSessionSource, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
      }).outputText;
      const realSessionUrl = `data:text/javascript;base64,${Buffer.from(realSessionJs).toString("base64")}`;
      const realSessionMod = await import(realSessionUrl);

      const integratedCode = transpiledTemplate
        .replace(/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, `$1${realSessionUrl}$2`)
        .replace(/(from\s+["'])\.\/rooms(["'])/g, `$1${roomsDataUrl}$2`);
      const integratedMod = await import(
        `data:text/javascript;base64,${Buffer.from(integratedCode).toString("base64")}`
      );
      return { sessionMod: realSessionMod, studyMod: integratedMod };
    }

    it("safely replays uncommitted 401 after refresh and never retries 500", async () => {
      const { sessionMod, studyMod } = await loadWithRealSession();
      const token1 = createJwt(3600);
      const token2 = createJwt(3600);

      globalThis.fetch = async (url) => {
        if (String(url) === "https://api.focoya.test/api/auth/login") {
          return new globalThis.Response(
            JSON.stringify({
              accessToken: token1,
              refreshToken: "ref-1",
              user: { id: USER_ID, email: "u@focoya.test", displayName: "User", avatarKey: null, role: "USER" },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        throw new Error(`Unexpected url: ${url}`);
      };
      await sessionMod.login("u@focoya.test", "secret123", false);

      const identity = studyMod.captureStudyIdentity(ROOM_ID);
      let startCalls = 0;
      globalThis.fetch = async (url, init) => {
        const u = String(url);
        if (u === "https://api.focoya.test/api/study-sessions/start") {
          startCalls++;
          const auth = new globalThis.Headers(init.headers).get("Authorization");
          if (startCalls === 1) {
            assert.equal(auth, `Bearer ${token1}`);
            return new globalThis.Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 });
          }
          assert.equal(auth, `Bearer ${token2}`);
          return new globalThis.Response(JSON.stringify(makeRunningSession()), { status: 201 });
        }
        if (u === "https://api.focoya.test/api/auth/refresh") {
          return new globalThis.Response(
            JSON.stringify({
              accessToken: token2,
              refreshToken: "ref-2",
              user: { id: USER_ID, email: "u@focoya.test", displayName: "User", avatarKey: null, role: "USER" },
            }),
            { status: 200 },
          );
        }
        throw new Error(`Unexpected url: ${u}`);
      };

      const started = await studyMod.startStudySession(identity);
      assert.equal(startCalls, 2);
      assert.equal(started.id, SESSION_ID);

      let finishCalls = 0;
      globalThis.fetch = async (url) => {
        if (String(url) === "https://api.focoya.test/api/study-sessions/finish") {
          finishCalls++;
          return new globalThis.Response(JSON.stringify({ message: "DB down" }), { status: 500 });
        }
        throw new Error(`Unexpected url: ${url}`);
      };

      await assert.rejects(
        () => studyMod.finishStudySession(identity, SESSION_ID),
        (err) => err instanceof studyMod.StudySessionError && err.uncertain === true && err.status === 500,
      );
      assert.equal(finishCalls, 1);
    });

    it("does not replay 401 if user logs out and logs back in during refresh", async () => {
      const { sessionMod, studyMod } = await loadWithRealSession();
      const token1 = createJwt(3600);
      const userObj = { id: USER_ID, email: "u@focoya.test", displayName: "User", avatarKey: null, role: "USER" };

      globalThis.fetch = async () =>
        new globalThis.Response(
          JSON.stringify({ accessToken: token1, refreshToken: "ref-1", user: userObj }),
          { status: 200 },
        );
      await sessionMod.login("u@focoya.test", "secret123", false);

      const identity = studyMod.captureStudyIdentity(ROOM_ID);
      let startCalls = 0;
      let resolveRefresh;
      const refreshGate = new Promise((resolve) => {
        resolveRefresh = resolve;
      });

      globalThis.fetch = async (url) => {
        const u = String(url);
        if (u === "https://api.focoya.test/api/study-sessions/start") {
          startCalls++;
          return new globalThis.Response(JSON.stringify({ message: "Expired" }), { status: 401 });
        }
        if (u === "https://api.focoya.test/api/auth/refresh") {
          await refreshGate;
          return new globalThis.Response(
            JSON.stringify({ accessToken: createJwt(3600), refreshToken: "ref-2", user: userObj }),
            { status: 200 },
          );
        }
        return new globalThis.Response(
          JSON.stringify({ accessToken: createJwt(3600), refreshToken: "ref-3", user: userObj }),
          { status: 200 },
        );
      };

      const pending = studyMod.startStudySession(identity);
      await Promise.resolve();
      await Promise.resolve();
      sessionMod.logout();
      await sessionMod.login("u@focoya.test", "secret123", false);
      resolveRefresh();

      await assert.rejects(
        () => pending,
        (err) => err instanceof studyMod.StudySessionError && err.uncertain === false,
      );
      assert.equal(startCalls, 1);
    });
  });
});
