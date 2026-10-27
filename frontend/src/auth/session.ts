export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  avatarKey: string | null;
  role: string;
};

type AuthResponse = { accessToken: string; refreshToken: string; user: AuthUser };
type AuthState = { status: "loading" | "authenticated" | "anonymous" | "error"; user: AuthUser | null; error: string };
const STORAGE_KEY = "focoya-refresh-token";
const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL?.replace(/\/$/, "");
let state: AuthState = { status: "loading", user: null, error: "" };
let accessToken = "";
let expiresAt = 0;
let generation = 0;
let refreshPending: Promise<void> | null = null;
const listeners = new Set<() => void>();

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const getSession = () => state;
export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function publish(next: AuthState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function logout() {
  generation++;
  accessToken = "";
  expiresAt = 0;
  refreshPending = null;
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem("focoya-demo-session");
  publish({ status: "anonymous", user: null, error: "" });
}

async function request(path: string, init: RequestInit = {}) {
  if (!API_BASE_URL) throw new Error("Chưa cấu hình VITE_API_BASE_URL.");
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("Không thể kết nối máy chủ. Vui lòng thử lại.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = response.status < 500 && typeof body?.message === "string"
      ? body.message
      : "Máy chủ gặp lỗi. Vui lòng thử lại.";
    throw new ApiError(response.status, message);
  }
  return response;
}

function post(path: string, body: unknown) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function acceptSession(data: AuthResponse, remember: boolean) {
  if (!data || typeof data.accessToken !== "string" || !data.accessToken ||
      typeof data.refreshToken !== "string" || !data.refreshToken ||
      !data.user || typeof data.user.id !== "string" ||
      typeof data.user.email !== "string" || typeof data.user.displayName !== "string") {
    throw new Error("Phản hồi đăng nhập không hợp lệ.");
  }
  let expiry: number;
  try {
    // JWT claims only schedule refresh; the backend verifies authentication.
    const payload = data.accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    expiry = JSON.parse(atob(payload)).exp * 1000;
    if (!Number.isFinite(expiry) || expiry <= Date.now()) throw new Error();
  } catch {
    throw new Error("Access token không hợp lệ hoặc đã hết hạn.");
  }
  // ponytail: bearer-only backend; move refresh tokens to HttpOnly cookies when supported.
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(STORAGE_KEY, data.refreshToken);
  (remember ? sessionStorage : localStorage).removeItem(STORAGE_KEY);
  sessionStorage.removeItem("focoya-demo-session");
  accessToken = data.accessToken;
  expiresAt = expiry;
  publish({ status: "authenticated", user: data.user, error: "" });
}

export async function login(email: string, password: string, remember: boolean) {
  const version = ++generation;
  const data = await (await post("/auth/login", { email: email.trim(), password })).json();
  if (version === generation) acceptSession(data, remember);
}

export async function register(displayName: string, email: string, password: string) {
  // Registration returns tokens, but this flow deliberately requires login next.
  await post("/auth/register", { displayName: displayName.trim(), email: email.trim(), password });
}

export function refreshSession(): Promise<void> {
  if (refreshPending) return refreshPending;
  const version = generation;
  const remembered = localStorage.getItem(STORAGE_KEY);
  const refreshToken = remembered ?? sessionStorage.getItem(STORAGE_KEY);
  if (!refreshToken) {
    logout();
    return Promise.resolve();
  }
  const pending = (async () => {
    try {
      const data = await (await post("/auth/refresh", { refreshToken })).json();
      if (version === generation) acceptSession(data, remembered !== null);
    } catch (error) {
      if (version !== generation) return;
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        logout();
      } else {
        accessToken = "";
        expiresAt = 0;
        publish({ status: "error", user: null, error: error instanceof Error ? error.message : "Không thể khôi phục phiên đăng nhập." });
      }
    }
  })().finally(() => {
    if (refreshPending === pending) refreshPending = null;
  });
  refreshPending = pending;
  return pending;
}

export function ensureSession() {
  if (accessToken && expiresAt > Date.now() + 30000) return Promise.resolve();
  return refreshSession();
}

export function sessionRefreshDelay() {
  return Math.max(1000, expiresAt - Date.now() - 30000);
}

/** Paths are relative to VITE_API_BASE_URL; never forward bearer tokens to arbitrary URLs. */
export async function apiRequest(path: string, init: RequestInit = {}) {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Đường dẫn API không hợp lệ.");
  await ensureSession();
  if (!accessToken) throw new ApiError(401, "Vui lòng đăng nhập lại.");
  const version = generation;
  const sentToken = accessToken;
  const send = () => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    return request(path, { ...init, headers });
  };
  try {
    return await send();
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    if (version !== generation) throw error;
    if (sentToken === accessToken) await refreshSession();
    if (!accessToken || version !== generation) throw error;
    try {
      return await send();
    } catch (retryError) {
      if (version === generation && retryError instanceof ApiError && retryError.status === 401) logout();
      throw retryError;
    }
  }
}
