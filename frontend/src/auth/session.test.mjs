import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import { setTimeout } from "node:timers/promises";
import { URL } from "node:url";
import ts from "typescript";

class MockStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(String(key), String(value));
  }
  removeItem(key) {
    this.store.delete(String(key));
  }
  clear() {
    this.store.clear();
  }
  get length() {
    return this.store.size;
  }
  key(index) {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

const mockLocalStorage = new MockStorage();
const mockSessionStorage = new MockStorage();
globalThis.localStorage = mockLocalStorage;
globalThis.sessionStorage = mockSessionStorage;

let fetchHandler = null;
globalThis.fetch = async (url, init) => {
  if (!fetchHandler) throw new Error(`Unexpected fetch to ${url}`);
  return fetchHandler(url, init);
};

const sessionTsSource = fs.readFileSync(new URL("./session.ts", import.meta.url), "utf8");
const transpiledTemplate = ts.transpileModule(
  sessionTsSource.replace(/import\.meta\.env/g, "globalThis.__SESSION_TEST_ENV__"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
    },
  }
).outputText;

let moduleCounter = 0;
async function loadFreshSession(env = { VITE_API_BASE_URL: "https://api.focoya.test" }) {
  globalThis.__SESSION_TEST_ENV__ = env;
  const uniqueCode = `${transpiledTemplate}\n// instance:${++moduleCounter}`;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(uniqueCode).toString("base64")}`;
  return await import(dataUrl);
}

function createFakeJwt(expiresInSeconds = 3600, claims = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload = Buffer.from(JSON.stringify({ exp, sub: "user-123", ...claims })).toString("base64url");
  return `${header}.${payload}.mockSignature`;
}

function jsonResponse(body, status = 200) {
  return new globalThis.Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const STORAGE_KEY = "focoya-refresh-token";
const mockUser = {
  id: "u-123",
  email: "user@focoya.test",
  displayName: "Test User",
  avatarKey: null,
  role: "user",
};

describe("auth session unit & regression tests", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockSessionStorage.clear();
    fetchHandler = null;
  });

  describe("register DTO & tokens", () => {
    it("sends sanitized registration DTO and does not store returned tokens", async () => {
      const session = await loadFreshSession();
      let capturedRequest = null;

      fetchHandler = async (url, init) => {
        capturedRequest = { url: String(url), init };
        return jsonResponse({
          accessToken: createFakeJwt(3600),
          refreshToken: "backend-issued-refresh-token",
          user: mockUser,
        });
      };

      await session.register("  Focoya User  ", " user@example.com ", "secret123");

      assert.equal(capturedRequest.url, "https://api.focoya.test/auth/register");
      assert.equal(capturedRequest.init.method, "POST");
      assert.deepEqual(JSON.parse(capturedRequest.init.body), {
        displayName: "Focoya User",
        email: "user@example.com",
        password: "secret123",
      });

      assert.equal(mockLocalStorage.getItem(STORAGE_KEY), null);
      assert.equal(mockSessionStorage.getItem(STORAGE_KEY), null);
      assert.equal(session.getSession().status, "loading");
      assert.equal(session.getSession().user, null);
    });
  });

  describe("login & remember behavior", () => {
    it("stores refresh token in localStorage when remember=true and clears session artifacts", async () => {
      const session = await loadFreshSession();
      mockSessionStorage.setItem(STORAGE_KEY, "old-session-token");
      mockSessionStorage.setItem("focoya-demo-session", "active");

      const jwt = createFakeJwt(3600);
      fetchHandler = async (url) => {
        assert.equal(String(url), "https://api.focoya.test/auth/login");
        return jsonResponse({
          accessToken: jwt,
          refreshToken: "new-remember-refresh",
          user: mockUser,
        });
      };

      await session.login("  user@focoya.test ", "secret", true);

      assert.equal(mockLocalStorage.getItem(STORAGE_KEY), "new-remember-refresh");
      assert.equal(mockSessionStorage.getItem(STORAGE_KEY), null);
      assert.equal(mockSessionStorage.getItem("focoya-demo-session"), null);
      assert.deepEqual(session.getSession(), {
        status: "authenticated",
        user: mockUser,
        error: "",
      });
    });

    it("stores refresh token in sessionStorage when remember=false and clears localStorage", async () => {
      const session = await loadFreshSession();
      mockLocalStorage.setItem(STORAGE_KEY, "old-local-token");

      fetchHandler = async () => jsonResponse({
        accessToken: createFakeJwt(3600),
        refreshToken: "new-session-refresh",
        user: mockUser,
      });

      await session.login("user@focoya.test", "secret", false);

      assert.equal(mockSessionStorage.getItem(STORAGE_KEY), "new-session-refresh");
      assert.equal(mockLocalStorage.getItem(STORAGE_KEY), null);
      assert.deepEqual(session.getSession(), {
        status: "authenticated",
        user: mockUser,
        error: "",
      });
    });

    it("notifies subscribers on successful login and supports unsubscribe", async () => {
      const session = await loadFreshSession();
      let callCount = 0;
      const unsubscribe = session.subscribeSession(() => {
        callCount++;
      });

      fetchHandler = async () => jsonResponse({
        accessToken: createFakeJwt(3600),
        refreshToken: "ref-1",
        user: mockUser,
      });

      await session.login("user@focoya.test", "secret", false);
      assert.equal(callCount, 1);

      unsubscribe();
      session.logout();
      assert.equal(callCount, 1);
    });

    it("ignores login response if user logged out while login request was in flight", async () => {
      const session = await loadFreshSession();
      let resolveLogin;
      const loginGate = new Promise((resolve) => { resolveLogin = resolve; });

      fetchHandler = async () => {
        await loginGate;
        return jsonResponse({
          accessToken: createFakeJwt(3600),
          refreshToken: "late-token",
          user: mockUser,
        });
      };

      const loginPromise = session.login("user@focoya.test", "pass", true);
      session.logout();
      assert.equal(session.getSession().status, "anonymous");

      resolveLogin();
      await loginPromise;

      assert.equal(session.getSession().status, "anonymous");
      assert.equal(mockLocalStorage.getItem(STORAGE_KEY), null);
    });
  });

  describe("restore via refresh rotating tokens", () => {
    it("rotates refresh token in localStorage when previously remembered", async () => {
      const session = await loadFreshSession();
      mockLocalStorage.setItem(STORAGE_KEY, "prev-local-token");

      let receivedToken = null;
      fetchHandler = async (url, init) => {
        assert.equal(String(url), "https://api.focoya.test/auth/refresh");
        receivedToken = JSON.parse(init.body).refreshToken;
        return jsonResponse({
          accessToken: createFakeJwt(3600),
          refreshToken: "rotated-local-token",
          user: mockUser,
        });
      };

      await session.refreshSession();

      assert.equal(receivedToken, "prev-local-token");
      assert.equal(mockLocalStorage.getItem(STORAGE_KEY), "rotated-local-token");
      assert.equal(mockSessionStorage.getItem(STORAGE_KEY), null);
      assert.equal(session.getSession().status, "authenticated");
    });

    it("rotates refresh token in sessionStorage when previously stored in sessionStorage", async () => {
      const session = await loadFreshSession();
      mockSessionStorage.setItem(STORAGE_KEY, "prev-session-token");

      fetchHandler = async () => jsonResponse({
        accessToken: createFakeJwt(3600),
        refreshToken: "rotated-session-token",
        user: mockUser,
      });

      await session.refreshSession();

      assert.equal(mockSessionStorage.getItem(STORAGE_KEY), "rotated-session-token");
      assert.equal(mockLocalStorage.getItem(STORAGE_KEY), null);
      assert.equal(session.getSession().status, "authenticated");
    });

    it("immediately transitions to anonymous if no refresh token is stored", async () => {
      const session = await loadFreshSession();
      let fetchCalled = false;
      fetchHandler = async () => {
        fetchCalled = true;
        return jsonResponse({});
      };

      await session.refreshSession();

      assert.equal(fetchCalled, false);
      assert.equal(session.getSession().status, "anonymous");
    });
  });

  describe("apiRequest Authorization + 401 refresh retry & concurrency", () => {
    it("adds Bearer Authorization header to API requests", async () => {
      const session = await loadFreshSession();
      mockLocalStorage.setItem(STORAGE_KEY, "valid-token");

      const jwt = createFakeJwt(3600);
      let authHeader = null;

      fetchHandler = async (url, init) => {
        const u = String(url);
        if (u.endsWith("/auth/refresh")) {
          return jsonResponse({
            accessToken: jwt,
            refreshToken: "new-refresh",
            user: mockUser,
          });
        }
        if (u.endsWith("/rooms")) {
          authHeader = new globalThis.Headers(init.headers).get("Authorization");
          return jsonResponse({ rooms: [] });
        }
        throw new Error(`Unhandled URL: ${u}`);
      };

      const res = await session.apiRequest("/rooms");
      assert.equal(res.status, 200);
      assert.equal(authHeader, `Bearer ${jwt}`);
    });

    it("retries request after 401 using refreshed access token", async () => {
      const session = await loadFreshSession();
      const firstJwt = createFakeJwt(3600);
      const secondJwt = createFakeJwt(3600);

      // Authenticate initial session
      fetchHandler = async () => jsonResponse({
        accessToken: firstJwt,
        refreshToken: "ref-1",
        user: mockUser,
      });
      await session.login("u@focoya.test", "pass", true);

      let attempts = 0;
      let usedAuthHeader = null;

      fetchHandler = async (url, init) => {
        const u = String(url);
        if (u.endsWith("/protected")) {
          attempts++;
          usedAuthHeader = new globalThis.Headers(init.headers).get("Authorization");
          if (attempts === 1) {
            return jsonResponse({ message: "Token expired" }, 401);
          }
          return jsonResponse({ data: "success" }, 200);
        }
        if (u.endsWith("/auth/refresh")) {
          return jsonResponse({
            accessToken: secondJwt,
            refreshToken: "ref-2",
            user: mockUser,
          });
        }
        throw new Error(`Unhandled URL: ${u}`);
      };

      const res = await session.apiRequest("/protected");
      assert.equal(res.status, 200);
      assert.equal(attempts, 2);
      assert.equal(usedAuthHeader, `Bearer ${secondJwt}`);
    });

    it("logs out and rethrows if 401 persists after refresh retry", async () => {
      const session = await loadFreshSession();
      const jwt = createFakeJwt(3600);
      fetchHandler = async () => jsonResponse({
        accessToken: jwt,
        refreshToken: "ref-1",
        user: mockUser,
      });
      await session.login("u@focoya.test", "pass", true);

      fetchHandler = async (url) => {
        const u = String(url);
        if (u.endsWith("/protected")) {
          return jsonResponse({ message: "Unauthorized" }, 401);
        }
        if (u.endsWith("/auth/refresh")) {
          return jsonResponse({
            accessToken: createFakeJwt(3600),
            refreshToken: "ref-2",
            user: mockUser,
          });
        }
      };

      await assert.rejects(
        () => session.apiRequest("/protected"),
        (err) => err instanceof session.ApiError && err.status === 401
      );

      assert.equal(session.getSession().status, "anonymous");
      assert.equal(mockLocalStorage.getItem(STORAGE_KEY), null);
    });

    it("single-flights concurrent refresh calls into exactly one HTTP request", async () => {
      const session = await loadFreshSession();
      mockLocalStorage.setItem(STORAGE_KEY, "concurrent-token");

      let refreshCount = 0;
      fetchHandler = async (url) => {
        if (String(url).endsWith("/auth/refresh")) {
          refreshCount++;
          await setTimeout(15);
          return jsonResponse({
            accessToken: createFakeJwt(3600),
            refreshToken: "rotated-token",
            user: mockUser,
          });
        }
      };

      await Promise.all([
        session.refreshSession(),
        session.refreshSession(),
        session.ensureSession(),
      ]);

      assert.equal(refreshCount, 1);
      assert.equal(session.getSession().status, "authenticated");
    });
  });

  describe("invalid refresh clears session", () => {
    it("clears storage and sets anonymous state when refresh responds with 401", async () => {
      const session = await loadFreshSession();
      mockLocalStorage.setItem(STORAGE_KEY, "revoked-token");

      fetchHandler = async () => jsonResponse({ message: "Refresh token revoked" }, 401);

      await session.refreshSession();

      assert.equal(mockLocalStorage.getItem(STORAGE_KEY), null);
      assert.equal(session.getSession().status, "anonymous");
      assert.equal(session.getSession().user, null);
    });

    it("clears storage and sets anonymous state when refresh responds with 403", async () => {
      const session = await loadFreshSession();
      mockSessionStorage.setItem(STORAGE_KEY, "forbidden-token");

      fetchHandler = async () => jsonResponse({ message: "Forbidden" }, 403);

      await session.refreshSession();

      assert.equal(mockSessionStorage.getItem(STORAGE_KEY), null);
      assert.equal(session.getSession().status, "anonymous");
    });
  });

  describe("network failure preserves refresh for retry", () => {
    it("keeps stored refresh token and sets error state upon network failure", async () => {
      const session = await loadFreshSession();
      mockLocalStorage.setItem(STORAGE_KEY, "preserve-me-token");

      fetchHandler = async () => {
        throw new TypeError("Failed to fetch (offline)");
      };

      await session.refreshSession();

      assert.equal(mockLocalStorage.getItem(STORAGE_KEY), "preserve-me-token");
      assert.equal(session.getSession().status, "error");
      assert.equal(session.getSession().error, "Không thể kết nối máy chủ. Vui lòng thử lại.");

      // Subsequent retry succeeds once network recovers
      fetchHandler = async () => jsonResponse({
        accessToken: createFakeJwt(3600),
        refreshToken: "recovered-token",
        user: mockUser,
      });

      await session.refreshSession();
      assert.equal(mockLocalStorage.getItem(STORAGE_KEY), "recovered-token");
      assert.equal(session.getSession().status, "authenticated");
    });
  });

  describe("logout during refresh race condition", () => {
    it("cannot resurrect session if logout occurs while refresh request is in flight", async () => {
      const session = await loadFreshSession();
      mockLocalStorage.setItem(STORAGE_KEY, "racing-token");

      let finishRefresh;
      const refreshGate = new Promise((resolve) => { finishRefresh = resolve; });

      fetchHandler = async () => {
        await refreshGate;
        return jsonResponse({
          accessToken: createFakeJwt(3600),
          refreshToken: "late-resurrected-token",
          user: mockUser,
        });
      };

      const pendingRefresh = session.refreshSession();

      // Explicit user action during network latency
      session.logout();
      assert.equal(session.getSession().status, "anonymous");
      assert.equal(mockLocalStorage.getItem(STORAGE_KEY), null);

      finishRefresh();
      await pendingRefresh;

      // Must remain anonymous
      assert.equal(session.getSession().status, "anonymous");
      assert.equal(session.getSession().user, null);
      assert.equal(mockLocalStorage.getItem(STORAGE_KEY), null);
      assert.equal(mockSessionStorage.getItem(STORAGE_KEY), null);
    });
  });

  describe("invalid responses & error handling", () => {
    it("throws error when response data schema is missing required fields", async () => {
      const session = await loadFreshSession();
      const testCases = [
        null,
        {},
        { accessToken: "only-access" },
        { accessToken: createFakeJwt(), refreshToken: "" },
        { accessToken: createFakeJwt(), refreshToken: "ref", user: null },
        { accessToken: createFakeJwt(), refreshToken: "ref", user: { id: "1" } },
      ];

      for (const badData of testCases) {
        fetchHandler = async () => jsonResponse(badData);
        await assert.rejects(
          () => session.login("u@focoya.test", "pass", false),
          { message: "Phản hồi đăng nhập không hợp lệ." }
        );
      }
    });

    it("throws error when access token is not a valid or non-expired JWT", async () => {
      const session = await loadFreshSession();
      const expiredJwt = createFakeJwt(-100);
      const malformedJwt = "invalid.token";

      for (const token of [expiredJwt, malformedJwt]) {
        fetchHandler = async () => jsonResponse({
          accessToken: token,
          refreshToken: "ref",
          user: mockUser,
        });
        await assert.rejects(
          () => session.login("u@focoya.test", "pass", false),
          { message: "Access token không hợp lệ hoặc đã hết hạn." }
        );
      }
    });

    it("throws ApiError with backend message for 4xx errors", async () => {
      const session = await loadFreshSession();
      fetchHandler = async () => jsonResponse({ message: "Tài khoản không tồn tại." }, 404);

      await assert.rejects(
        () => session.login("unknown@focoya.test", "pass", false),
        (err) => err instanceof session.ApiError && err.status === 404 && err.message === "Tài khoản không tồn tại."
      );
    });

    it("throws ApiError with sanitized message for 5xx errors", async () => {
      const session = await loadFreshSession();
      fetchHandler = async () => jsonResponse({ message: "Postgres connection timeout error stack trace" }, 500);

      await assert.rejects(
        () => session.login("u@focoya.test", "pass", false),
        (err) => err instanceof session.ApiError && err.status === 500 && err.message === "Máy chủ gặp lỗi. Vui lòng thử lại."
      );
    });

    it("rejects invalid API paths before sending network requests", async () => {
      const session = await loadFreshSession();
      mockLocalStorage.setItem(STORAGE_KEY, "valid-token");
      fetchHandler = async () => jsonResponse({
        accessToken: createFakeJwt(3600),
        refreshToken: "ref",
        user: mockUser,
      });

      await assert.rejects(
        () => session.apiRequest("missing-leading-slash"),
        { message: "Đường dẫn API không hợp lệ." }
      );

      await assert.rejects(
        () => session.apiRequest("//arbitrary-host.com"),
        { message: "Đường dẫn API không hợp lệ." }
      );
    });

    it("throws when VITE_API_BASE_URL is not configured", async () => {
      const session = await loadFreshSession({ VITE_API_BASE_URL: "" });
      await assert.rejects(
        () => session.login("u@focoya.test", "pass", false),
        { message: "Chưa cấu hình VITE_API_BASE_URL." }
      );
    });

    it("computes sessionRefreshDelay correctly based on expiration", async () => {
      const session = await loadFreshSession();
      const futureJwt = createFakeJwt(90);
      fetchHandler = async () => jsonResponse({
        accessToken: futureJwt,
        refreshToken: "ref",
        user: mockUser,
      });
      await session.login("u@focoya.test", "pass", true);

      const delay = session.sessionRefreshDelay();
      assert.ok(delay >= 55000 && delay <= 61000, `Expected delay near 60000ms, got ${delay}`);
    });
  });
});
