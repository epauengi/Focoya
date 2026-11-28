import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import { setTimeout } from "node:timers";
import { URL } from "node:url";
import ts from "typescript";

// Set up minimal DOM before importing react-dom/client so React detects oninput support.
class DomNode {
  constructor(nodeType) {
    this.nodeType = nodeType;
    this.childNodes = [];
    this.parentNode = null;
    this._cap = {};
    this._bub = {};
  }
  appendChild(child) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  insertBefore(child, ref) {
    const idx = this.childNodes.indexOf(ref);
    if (idx < 0) return this.appendChild(child);
    child.parentNode = this;
    this.childNodes.splice(idx, 0, child);
    return child;
  }
  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx >= 0) this.childNodes.splice(idx, 1);
    child.parentNode = null;
    return child;
  }
  addEventListener(type, fn, opts) {
    const cap = typeof opts === "boolean" ? opts : Boolean(opts?.capture);
    const map = cap ? this._cap : this._bub;
    (map[type] ??= []).push(fn);
  }
  removeEventListener(type, fn, opts) {
    const cap = typeof opts === "boolean" ? opts : Boolean(opts?.capture);
    const map = cap ? this._cap : this._bub;
    if (map[type]) map[type] = map[type].filter((f) => f !== fn);
  }
  set textContent(v) {
    this.childNodes = [];
    if (v) this.appendChild(new DomText(String(v), this.ownerDocument ?? this));
  }
  get textContent() {
    return this.childNodes.map((c) => c.textContent).join("");
  }
}

class DomElement extends DomNode {
  constructor(tag, ownerDocument) {
    super(1);
    this.tagName = tag.toUpperCase();
    this.nodeName = this.tagName;
    this.ownerDocument = ownerDocument;
    this.style = {};
    this.attrs = {};
    this.type = this.tagName === "INPUT" ? "text" : "";
    this._value = "";
    this.open = false;
    this.disabled = false;
    this.oninput = null;
  }
  get value() {
    return this._value;
  }
  set value(v) {
    this._value = String(v);
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
    if (k === "type") this.type = String(v);
    if (k === "disabled") this.disabled = true;
  }
  removeAttribute(k) {
    delete this.attrs[k];
    if (k === "disabled") this.disabled = false;
  }
  get firstChild() {
    return this.childNodes[0] ?? null;
  }
  focus() {}
}

class DomText extends DomNode {
  constructor(nodeValue, ownerDocument) {
    super(3);
    this.nodeValue = String(nodeValue);
    this.ownerDocument = ownerDocument;
  }
  get textContent() {
    return this.nodeValue;
  }
  set textContent(v) {
    this.nodeValue = String(v);
  }
}

const doc = new DomNode(9);
Object.assign(doc, {
  defaultView: globalThis,
  oninput: null,
  activeElement: null,
  createElement: (tag) => new DomElement(tag, doc),
  createTextNode: (text) => new DomText(text, doc),
  createElementNS: (_, tag) => new DomElement(tag, doc),
  createEvent: () => ({ initEvent() {} }),
});
doc.documentElement = new DomElement("html", doc);
doc.body = new DomElement("body", doc);

globalThis.window = globalThis;
globalThis.document = doc;
globalThis.HTMLIFrameElement = function () {};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
globalThis.addEventListener ??= () => {};
globalThis.removeEventListener ??= () => {};

const protoValueSet = Object.getOwnPropertyDescriptor(DomElement.prototype, "value").set;

function dispatchDomEvent(el, type) {
  const ev = {
    type,
    target: el,
    currentTarget: el,
    bubbles: true,
    cancelable: true,
    defaultPrevented: false,
    eventPhase: 3,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {},
  };
  for (let cur = el; cur; cur = cur.parentNode) {
    ev.currentTarget = cur;
    for (const fn of [...(cur._bub[type] ?? [])]) fn(ev);
  }
}

function findElements(root, predicate, acc = []) {
  if (root instanceof DomElement && predicate(root)) acc.push(root);
  for (const child of root.childNodes) findElements(child, predicate, acc);
  return acc;
}

const React = (await import("react")).default;
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { renderToString } = await import("react-dom/server");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { MemoryRouter, createMemoryRouter, RouterProvider } = await import("react-router");

const reactUrl = import.meta.resolve("react");
const reactJsxRuntimeUrl = import.meta.resolve("react/jsx-runtime");
const reactRouterUrl = import.meta.resolve("react-router");
const reactQueryUrl = import.meta.resolve("@tanstack/react-query");

// React shim supplies getServerSnapshot so renderToString works with hooks calling 2-arg useSyncExternalStore.
const reactShimSource = `
import RealReact, * as ReactNs from "${reactUrl}";
export * from "${reactUrl}";
export function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
  return ReactNs.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot ? () => getSnapshot() : getSnapshot
  );
}
export default { ...RealReact, useSyncExternalStore };
`;
const reactShimUrl = `data:text/javascript;base64,${Buffer.from(reactShimSource).toString("base64")}`;

const sessionStubSource = `
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const listeners = new Set();
let currentSession = { status: "anonymous", user: null, error: "" };
let currentGen = 0;

export function __setTestSession(next, bumpGen = true) {
  currentSession = next;
  if (bumpGen) currentGen++;
  listeners.forEach((l) => l());
}

export function __setTestGeneration(gen) {
  currentGen = gen;
  listeners.forEach((l) => l());
}

export function getSession() {
  return currentSession;
}

export function getSessionGeneration() {
  return currentGen;
}

export function subscribeSession(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function getAccessToken() {
  return "mock-access-token";
}

export async function apiRequest(path, init, expectedUserId) {
  if (!globalThis.__ACCESS_TEST_API__) {
    throw new Error(\`Unexpected apiRequest call: \${path}\`);
  }
  return globalThis.__ACCESS_TEST_API__(path, init, expectedUserId);
}
`;
const sessionStubUrl = `data:text/javascript;base64,${Buffer.from(sessionStubSource).toString("base64")}`;
const { ApiError, __setTestSession, __setTestGeneration, getSessionGeneration } = await import(sessionStubUrl);

function transpileModule(relPath, replacements = []) {
  let src = fs.readFileSync(new URL(relPath, import.meta.url), "utf8");
  src = src
    .replace(/^\s*import\s+["'][^"']+\.css["'];?\s*$/gm, "")
    .replace(/import\.meta\.env/g, "globalThis.__ACCESS_TEST_ENV__");
  let out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const [pattern, target] of replacements) {
    out = out.replace(pattern, `$1${target}$2`);
  }
  return `data:text/javascript;base64,${Buffer.from(out).toString("base64")}`;
}

const roomsUrl = transpileModule("./rooms.ts");
const privateRoomsUrl = transpileModule("./privateRooms.ts", [
  [/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, sessionStubUrl],
  [/(from\s+["'])\.\/rooms(["'])/g, roomsUrl],
]);
const privateRoomQueriesUrl = transpileModule("./privateRoomQueries.ts", [
  [/(from\s+["'])@tanstack\/react-query(["'])/g, reactQueryUrl],
  [/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, sessionStubUrl],
  [/(from\s+["'])\.\/rooms(["'])/g, roomsUrl],
  [/(from\s+["'])\.\/privateRooms(["'])/g, privateRoomsUrl],
]);
const privateRoomAccessUrl = transpileModule("./privateRoomAccess.ts", [
  [/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, sessionStubUrl],
  [/(from\s+["'])\.\/privateRooms(["'])/g, privateRoomsUrl],
  [/(from\s+["'])\.\/rooms(["'])/g, roomsUrl],
]);
const useAccessibleRoomUrl = transpileModule("./useAccessibleRoom.ts", [
  [/(from\s+["'])react(["'])/g, reactShimUrl],
  [/(from\s+["'])@tanstack\/react-query(["'])/g, reactQueryUrl],
  [/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, sessionStubUrl],
  [/(from\s+["'])\.\/privateRoomAccess(["'])/g, privateRoomAccessUrl],
  [/(from\s+["'])\.\/privateRoomQueries(["'])/g, privateRoomQueriesUrl],
]);

const joinByCodeFormUrl = transpileModule("./JoinByCodeForm.tsx", [
  [/(from\s+["'])react\/jsx-runtime(["'])/g, reactJsxRuntimeUrl],
  [/(from\s+["'])react(["'])/g, reactShimUrl],
  [/(from\s+["'])react-router(["'])/g, reactRouterUrl],
  [/(from\s+["'])@\/auth\/session(["'])/g, sessionStubUrl],
  [/(from\s+["'])\.\/rooms(["'])/g, roomsUrl],
  [/(from\s+["'])\.\/privateRooms(["'])/g, privateRoomsUrl],
  [/(from\s+["'])\.\/privateRoomAccess(["'])/g, privateRoomAccessUrl],
]);
const privateRoomGateUrl = transpileModule("./PrivateRoomGate.tsx", [
  [/(from\s+["'])react\/jsx-runtime(["'])/g, reactJsxRuntimeUrl],
  [/(from\s+["'])react-router(["'])/g, reactRouterUrl],
  [/(from\s+["'])\.\/JoinByCodeForm(["'])/g, joinByCodeFormUrl],
]);
const roomQueryStateUrl = transpileModule("./RoomQueryState.tsx", [
  [/(from\s+["'])react\/jsx-runtime(["'])/g, reactJsxRuntimeUrl],
  [/(from\s+["'])react-router(["'])/g, reactRouterUrl],
  [/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, sessionStubUrl],
]);

const profileUrl = transpileModule("../profile/profile.ts");
const profileAvatarUrl = transpileModule("../profile/ProfileAvatar.tsx", [
  [/(from\s+["'])react\/jsx-runtime(["'])/g, reactJsxRuntimeUrl],
  [/(from\s+["'])\.\/profile(["'])/g, profileUrl],
]);
const presencePresentationUrl = transpileModule("./presencePresentation.ts");

const realtimeStubSource = `
export function createRoomPresence(options) {
  const controller = {
    options,
    connected: false,
    disconnected: false,
    statuses: [],
    timerStatuses: [],
    connect() { this.connected = true; },
    disconnect() {
      this.disconnected = true;
      options.onChange({ connection: "disconnected", snapshot: null, error: "", errorCode: null });
    },
    setStatus(s) { this.statuses.push(s); },
    setTimerStatus(s) { this.timerStatuses.push(s); },
    emit(state) { options.onChange(state); },
  };
  globalThis.__ACCESS_TEST_PRESENCE_INSTANCES__.push(controller);
  return controller;
}
`;
const realtimeStubUrl = `data:text/javascript;base64,${Buffer.from(realtimeStubSource).toString("base64")}`;

const roomPresenceUrl = transpileModule("./RoomPresence.tsx", [
  [/(from\s+["'])react\/jsx-runtime(["'])/g, reactJsxRuntimeUrl],
  [/(from\s+["'])react(["'])/g, reactShimUrl],
  [/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, sessionStubUrl],
  [/(from\s+["'])react-router(["'])/g, reactRouterUrl],
  [/(from\s+["'])\.\/privateRoomAccess(["'])/g, privateRoomAccessUrl],
  [/(from\s+["'])\.\.\/profile\/ProfileAvatar(["'])/g, profileAvatarUrl],
  [/(from\s+["'])\.\/realtime(["'])/g, realtimeStubUrl],
  [/(from\s+["'])\.\/presencePresentation(["'])/g, presencePresentationUrl],
]);

// Spy RoomPresence module for FocusRoomPage integration test to capture initialInviteCode without running FocusRoomExperience effects.
const roomPresenceSpySource = `
import { jsx as _jsx } from "${reactJsxRuntimeUrl}";
export const useTimerPresence = () => ({ ready: false, setTimerStatus: () => {} });
export function RoomPresence(props) {
  globalThis.__FOCUS_PAGE_PRESENCE_PROPS__.push({
    roomId: props.roomId,
    maxSlots: props.maxSlots,
    initialInviteCode: props.initialInviteCode,
  });
  return _jsx("div", {
    "data-presence-spy": props.initialInviteCode ?? "none",
    children: props.children(_jsx("span", { children: "presence" }), null),
  });
}
`;
const roomPresenceSpyUrl = `data:text/javascript;base64,${Buffer.from(roomPresenceSpySource).toString("base64")}`;

const stubSimpleSource = (body) => `data:text/javascript;base64,${Buffer.from(body).toString("base64")}`;
const usePomodoroStubUrl = stubSimpleSource(`
export function usePomodoro() {
  return {
    state: { phase: "idle", mode: "focus", remaining: 1500, message: "", session: null },
    intent: null,
    busy: false,
    hasUnfinished: false,
    start: async () => {},
    pause: () => {},
    reset: async () => {},
    selectMode: async () => {},
    end: async () => true,
    abandon: () => {},
  };
}
`);
const profileQueriesStubUrl = stubSimpleSource(`
export function profileQuery(userId) { return { queryKey: ["profile", userId] }; }
`);
const roomsLayoutStubUrl = stubSimpleSource(`
export function useRoomPreferences() {
  return {
    wallpaper: "",
    displayName: "An",
    notifications: false,
    autoStart: false,
    durations: { focus: 25, short: 5, long: 15 },
    setTimerPending: () => {},
    openSettings: () => {},
    notify: () => {},
    registerBeforeSignOut: () => {},
  };
}
`);
const roomSceneLayerStubUrl = stubSimpleSource(`
import { jsx as _jsx } from "${reactJsxRuntimeUrl}";
export function RoomScene() { return _jsx("div", {}); }
`);
const ambientAudioStubUrl = stubSimpleSource(`
import { jsx as _jsx } from "${reactJsxRuntimeUrl}";
export function AmbientAudioControls() { return _jsx("div", {}); }
`);
const roomSceneStubUrl = stubSimpleSource(`
export function resolveRoomScene(room) { return { image: room.image, fallback: room.image, effect: "none", preset: "rain" }; }
`);

const focusRoomPageUrl = transpileModule("./FocusRoomPage.tsx", [
  [/(from\s+["'])react\/jsx-runtime(["'])/g, reactJsxRuntimeUrl],
  [/(from\s+["'])react(["'])/g, reactShimUrl],
  [/(from\s+["'])react-router(["'])/g, reactRouterUrl],
  [/(from\s+["'])@tanstack\/react-query(["'])/g, reactQueryUrl],
  [/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, sessionStubUrl],
  [/(from\s+["'])\.\/rooms(["'])/g, roomsUrl],
  [/(from\s+["'])\.\/usePomodoro(["'])/g, usePomodoroStubUrl],
  [/(from\s+["'])\.\.\/profile\/profileQueries(["'])/g, profileQueriesStubUrl],
  [/(from\s+["'])\.\/RoomsLayout(["'])/g, roomsLayoutStubUrl],
  [/(from\s+["'])\.\/useAccessibleRoom(["'])/g, useAccessibleRoomUrl],
  [/(from\s+["'])\.\/PrivateRoomGate(["'])/g, privateRoomGateUrl],
  [/(from\s+["'])\.\/RoomQueryState(["'])/g, roomQueryStateUrl],
  [/(from\s+["'])\.\/RoomPresence(["'])/g, roomPresenceSpyUrl],
  [/(from\s+["'])\.\/RoomSceneLayer(["'])/g, roomSceneLayerStubUrl],
  [/(from\s+["'])\.\/AmbientAudioControls(["'])/g, ambientAudioStubUrl],
  [/(from\s+["'])\.\/roomScene(["'])/g, roomSceneStubUrl],
]);

const {
  clearPrivateRoomAccess,
  getPrivateRoomAccess,
  getPrivateRoomRejection,
  grantPrivateRoomAccess,
  rejectPrivateRoomAccess,
  retainPrivateRoomAccessForPath,
  subscribePrivateRoomAccess,
} = await import(privateRoomAccessUrl);
const { privateRoomDetailQuery } = await import(privateRoomQueriesUrl);
const { useAccessibleRoom } = await import(useAccessibleRoomUrl);
const { RoomPresence } = await import(roomPresenceUrl);
const { FocusRoomPage } = await import(focusRoomPageUrl);

function jsonResponse(body, status = 200) {
  return new globalThis.Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const USER_1 = "4251cc03-c9a7-42ac-a3d1-e75850417ab4";
const USER_2 = "df9c1a30-2d69-4e76-9c02-2eeb748341d2";
const ROOM_1 = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const ROOM_2 = "c9b2e04f-6d27-4402-9993-2fb53bf1cf02";

const PRIVATE_ROOM = {
  id: ROOM_1,
  name: "Phòng Nhóm A",
  theme: "Study",
  online: 2,
  maxSlots: 16,
  image: "/room-assets/rainy.jpg",
  description: "Ôn thi",
  visibility: "PRIVATE",
  inviteCode: "OWNER1",
};

const PUBLIC_ROOM = {
  ...PRIVATE_ROOM,
  id: ROOM_2,
  visibility: "PUBLIC",
  inviteCode: null,
};

let mountedRoots = [];
let createdClients = [];

function createTestQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryOnMount: false, gcTime: 0 },
    },
  });
  createdClients.push(client);
  return client;
}

async function mountElement(element) {
  const container = doc.createElement("div");
  const root = createRoot(container);
  mountedRoots.push(root);
  await act(async () => {
    root.render(element);
  });
  return container;
}

describe("privateRoomAccess, useAccessibleRoom & RoomPresence invite integration", () => {
  beforeEach(() => {
    clearPrivateRoomAccess();
    globalThis.__ACCESS_TEST_API__ = null;
    globalThis.__ACCESS_TEST_ENV__ = { VITE_API_BASE_URL: "https://api.focoya.test" };
    globalThis.__ACCESS_TEST_PRESENCE_INSTANCES__ = [];
    globalThis.__FOCUS_PAGE_PRESENCE_PROPS__ = [];
    __setTestSession({
      status: "authenticated",
      user: { id: USER_1, email: "u1@focoya.test", displayName: "An", avatarKey: null, role: "user" },
      error: "",
    }, true);
  });

  afterEach(async () => {
    for (const root of mountedRoots.splice(0)) {
      await act(async () => {
        root.unmount();
      });
    }
    for (const client of createdClients.splice(0)) {
      client.clear();
    }
    clearPrivateRoomAccess();
  });

  describe("privateRoomAccess state scoping and lifecycle", () => {
    it("grants access only for current user/generation, normalizes code, and strips inviteCode from room", () => {
      const gen = getSessionGeneration();
      let notifications = 0;
      const unsub = subscribePrivateRoomAccess(() => notifications++);

      // Stale user / stale generation ignored silently
      grantPrivateRoomAccess(PRIVATE_ROOM, "ab12cd", USER_2, gen);
      grantPrivateRoomAccess(PRIVATE_ROOM, "ab12cd", USER_1, gen - 1);
      assert.equal(getPrivateRoomAccess(ROOM_1), null);
      assert.equal(notifications, 0);

      // PUBLIC room or invalid invite code throws
      assert.throws(() => grantPrivateRoomAccess(PUBLIC_ROOM, "ab12cd", USER_1, gen), /Phòng riêng không hợp lệ\./);
      assert.throws(() => grantPrivateRoomAccess(PRIVATE_ROOM, "bad", USER_1, gen), /Mã mời gồm đúng 6 chữ cái/);

      grantPrivateRoomAccess(PRIVATE_ROOM, " ab12cd ", USER_1, gen);
      assert.equal(notifications, 1);

      // Case-insensitive UUID lookup; mismatched UUID returns null
      const matched = getPrivateRoomAccess(ROOM_1.toUpperCase());
      assert.ok(matched);
      assert.equal(matched.inviteCode, "AB12CD");
      assert.equal(matched.room.inviteCode, null);
      assert.equal(matched.userId, USER_1);
      assert.equal(matched.generation, gen);
      assert.equal(getPrivateRoomAccess(ROOM_2), null);
      assert.equal(getPrivateRoomAccess(undefined), null);

      clearPrivateRoomAccess();
      assert.equal(getPrivateRoomAccess(ROOM_1), null);
      assert.equal(notifications, 2);

      // Idempotent clear does not re-notify
      clearPrivateRoomAccess();
      assert.equal(notifications, 2);
      unsub();
    });

    it("retains access only on matching room/preview paths and clears on out-of-flow navigation", () => {
      const gen = getSessionGeneration();

      for (const keepPath of [
        `/rooms/${ROOM_1}`,
        `/rooms/${ROOM_1}/`,
        `/rooms/${ROOM_1.toUpperCase()}/preview`,
        `/rooms/${ROOM_1}/preview/`,
      ]) {
        grantPrivateRoomAccess(PRIVATE_ROOM, "AB12CD", USER_1, gen);
        retainPrivateRoomAccessForPath(keepPath);
        assert.ok(getPrivateRoomAccess(ROOM_1), `Expected retention for ${keepPath}`);
      }

      for (const clearPath of [
        "",
        "/rooms",
        "/my-rooms",
        "/profile",
        "/login",
        `/rooms/${ROOM_2}`,
        `/rooms/${ROOM_2}/preview`,
        `/rooms/${ROOM_1}/settings`,
        `/rooms/${ROOM_1}/preview/extra`,
      ]) {
        grantPrivateRoomAccess(PRIVATE_ROOM, "AB12CD", USER_1, gen);
        retainPrivateRoomAccessForPath(clearPath);
        assert.equal(getPrivateRoomAccess(ROOM_1), null, `Expected clear for ${clearPath}`);
      }
    });

    it("automatically clears access and notifies listeners on logout, user switch, or generation bump", () => {
      const gen = getSessionGeneration();
      grantPrivateRoomAccess(PRIVATE_ROOM, "AB12CD", USER_1, gen);
      let clearedNotified = 0;
      const unsub = subscribePrivateRoomAccess(() => {
        if (!getPrivateRoomAccess(ROOM_1)) clearedNotified++;
      });

      // Token refresh / generation bump clears credential
      __setTestGeneration(gen + 1);
      assert.equal(getPrivateRoomAccess(ROOM_1), null);
      assert.equal(clearedNotified, 1);

      // Switch user clears
      grantPrivateRoomAccess(PRIVATE_ROOM, "AB12CD", USER_1, getSessionGeneration());
      __setTestSession({
        status: "authenticated",
        user: { id: USER_2, email: "u2@focoya.test", displayName: "Binh", avatarKey: null, role: "user" },
        error: "",
      }, false);
      assert.equal(getPrivateRoomAccess(ROOM_1), null);
      assert.equal(clearedNotified, 2);

      // Logout clears
      __setTestSession({
        status: "authenticated",
        user: { id: USER_1, email: "u1@focoya.test", displayName: "An", avatarKey: null, role: "user" },
        error: "",
      }, true);
      grantPrivateRoomAccess(PRIVATE_ROOM, "AB12CD", USER_1, getSessionGeneration());
      __setTestSession({ status: "anonymous", user: null, error: "" }, true);
      assert.equal(getPrivateRoomAccess(ROOM_1), null);
      assert.equal(clearedNotified, 3);
      unsub();
    });

    it("rejectPrivateRoomAccess clears credential, records credential-free exact-room rejection, and clears on cleanup/revalidation/session change", () => {
      const gen = getSessionGeneration();

      // Ignored when no active credential or mismatched roomId
      rejectPrivateRoomAccess(ROOM_1, "FORBIDDEN");
      assert.equal(getPrivateRoomRejection(ROOM_1), null);

      grantPrivateRoomAccess(PRIVATE_ROOM, "AB12CD", USER_1, gen);
      rejectPrivateRoomAccess(ROOM_2, "FORBIDDEN");
      assert.ok(getPrivateRoomAccess(ROOM_1));
      assert.equal(getPrivateRoomRejection(ROOM_1), null);

      // Rejecting exact room (case-insensitive) clears credential & stores credential-free rejection
      let notified = 0;
      const unsub = subscribePrivateRoomAccess(() => notified++);
      rejectPrivateRoomAccess(ROOM_1.toUpperCase(), "UNAUTHORIZED");

      assert.equal(getPrivateRoomAccess(ROOM_1), null);
      assert.equal(notified, 1);

      const rej = getPrivateRoomRejection(ROOM_1);
      assert.ok(rej);
      assert.deepEqual(Object.keys(rej).sort(), ["code", "generation", "roomId", "userId"]);
      assert.equal(rej.code, "UNAUTHORIZED");
      assert.equal(rej.roomId, ROOM_1);
      assert.equal(rej.userId, USER_1);
      assert.equal(rej.generation, gen);
      assert.equal("inviteCode" in rej, false);
      assert.equal("room" in rej, false);

      // Exact room only (case-insensitive match for ROOM_1, null for ROOM_2)
      assert.ok(getPrivateRoomRejection(ROOM_1.toUpperCase()));
      assert.equal(getPrivateRoomRejection(ROOM_2), null);
      assert.equal(getPrivateRoomRejection(undefined), null);

      // Path retention keeps rejection on same room/preview and clears out-of-flow
      retainPrivateRoomAccessForPath(`/rooms/${ROOM_1}`);
      assert.ok(getPrivateRoomRejection(ROOM_1));
      retainPrivateRoomAccessForPath(`/rooms/${ROOM_1.toUpperCase()}/preview`);
      assert.ok(getPrivateRoomRejection(ROOM_1));
      retainPrivateRoomAccessForPath("/rooms");
      assert.equal(getPrivateRoomRejection(ROOM_1), null);

      // Revalidation via grantPrivateRoomAccess clears rejection
      grantPrivateRoomAccess(PRIVATE_ROOM, "AB12CD", USER_1, gen);
      rejectPrivateRoomAccess(ROOM_1, "FORBIDDEN");
      assert.equal(getPrivateRoomRejection(ROOM_1)?.code, "FORBIDDEN");
      grantPrivateRoomAccess(PRIVATE_ROOM, "XY98ZA", USER_1, gen);
      assert.equal(getPrivateRoomRejection(ROOM_1), null);
      assert.equal(getPrivateRoomAccess(ROOM_1)?.inviteCode, "XY98ZA");

      // clearPrivateRoomAccess clears rejection
      rejectPrivateRoomAccess(ROOM_1, "ROOM_NOT_FOUND");
      assert.equal(getPrivateRoomRejection(ROOM_1)?.code, "ROOM_NOT_FOUND");
      clearPrivateRoomAccess();
      assert.equal(getPrivateRoomRejection(ROOM_1), null);

      // Session generation bump / user switch / logout clears rejection
      grantPrivateRoomAccess(PRIVATE_ROOM, "AB12CD", USER_1, getSessionGeneration());
      rejectPrivateRoomAccess(ROOM_1, "FORBIDDEN");
      __setTestGeneration(getSessionGeneration() + 1);
      assert.equal(getPrivateRoomRejection(ROOM_1), null);

      grantPrivateRoomAccess(PRIVATE_ROOM, "AB12CD", USER_1, getSessionGeneration());
      rejectPrivateRoomAccess(ROOM_1, "UNAUTHORIZED");
      __setTestSession({
        status: "authenticated",
        user: { id: USER_2, email: "u2@focoya.test", displayName: "Binh", avatarKey: null, role: "user" },
        error: "",
      }, false);
      assert.equal(getPrivateRoomRejection(ROOM_1), null);
      unsub();
    });
  });

  describe("useAccessibleRoom guest bypass, rejection guard, and private detail query", () => {
    it("bypasses privateRoomDetailQuery completely when guest access is active", async () => {
      const gen = getSessionGeneration();
      grantPrivateRoomAccess(PRIVATE_ROOM, "AB12CD", USER_1, gen);

      let apiCalls = 0;
      globalThis.__ACCESS_TEST_API__ = async () => {
        apiCalls++;
        return jsonResponse(PRIVATE_ROOM);
      };

      const client = createTestQueryClient();
      let observed = null;
      function Probe() {
        observed = useAccessibleRoom(ROOM_1);
        return React.createElement("div", null, observed.room?.name ?? "missing");
      }

      const container = await mountElement(
        React.createElement(QueryClientProvider, { client }, React.createElement(Probe))
      );

      assert.equal(apiCalls, 0);
      assert.ok(observed.guest);
      assert.equal(observed.rejection, null);
      assert.equal(observed.guest.inviteCode, "AB12CD");
      assert.equal(observed.room.id, ROOM_1);
      assert.equal(observed.room.inviteCode, null);
      assert.equal(client.getQueryData(privateRoomDetailQuery(ROOM_1, USER_1).queryKey), undefined);
      assert.match(container.textContent, /Phòng Nhóm A/);
    });

    it("disables privateRoomDetailQuery with 0 detail requests on rejection and restores on revalidation", async () => {
      const gen = getSessionGeneration();
      grantPrivateRoomAccess(PRIVATE_ROOM, "AB12CD", USER_1, gen);

      let apiCalls = 0;
      globalThis.__ACCESS_TEST_API__ = async () => {
        apiCalls++;
        return jsonResponse(PRIVATE_ROOM);
      };

      const client = createTestQueryClient();
      let observed = null;
      function Probe() {
        observed = useAccessibleRoom(ROOM_1);
        return React.createElement("div", null, observed.rejection?.code ?? observed.room?.name ?? "empty");
      }

      const container = await mountElement(
        React.createElement(QueryClientProvider, { client }, React.createElement(Probe))
      );

      for (const code of ["FORBIDDEN", "UNAUTHORIZED"]) {
        await act(async () => {
          grantPrivateRoomAccess(PRIVATE_ROOM, "AB12CD", USER_1, getSessionGeneration());
        });
        await act(async () => {
          rejectPrivateRoomAccess(ROOM_1, code);
        });
        assert.equal(apiCalls, 0);
        assert.equal(observed.guest, null);
        assert.equal(observed.rejection?.code, code);
        assert.equal(observed.room, undefined);
        assert.equal(client.getQueryData(privateRoomDetailQuery(ROOM_1, USER_1).queryKey), undefined);
        assert.equal(container.textContent, code);
      }

      // Revalidation clears rejection without triggering detail fetch
      await act(async () => {
        grantPrivateRoomAccess(PRIVATE_ROOM, "XY98ZA", USER_1, getSessionGeneration());
      });
      assert.equal(apiCalls, 0);
      assert.equal(observed.rejection, null);
      assert.equal(observed.guest?.inviteCode, "XY98ZA");
      assert.equal(observed.room?.id, ROOM_1);
    });

    it("executes privateRoomDetailQuery when authenticated without guest access, and skips when anonymous", async () => {
      let apiCalls = 0;
      globalThis.__ACCESS_TEST_API__ = async (path, init, expectedUserId) => {
        apiCalls++;
        assert.equal(path, `/rooms/${ROOM_1}`);
        assert.equal(expectedUserId, USER_1);
        return jsonResponse(PRIVATE_ROOM);
      };

      const client = createTestQueryClient();
      let observed = null;
      function Probe() {
        observed = useAccessibleRoom(ROOM_1);
        return React.createElement("div", null, observed.room?.name ?? "loading");
      }

      const container = await mountElement(
        React.createElement(QueryClientProvider, { client }, React.createElement(Probe))
      );
      await act(async () => {
        await new Promise((r) => setTimeout(r, 15));
      });

      assert.equal(apiCalls, 1);
      assert.equal(observed.guest, null);
      assert.equal(observed.room?.inviteCode, "OWNER1");
      assert.match(container.textContent, /Phòng Nhóm A/);

      // Anonymous session must not query private detail
      apiCalls = 0;
      __setTestSession({ status: "anonymous", user: null, error: "" }, true);
      const anonClient = createTestQueryClient();
      await mountElement(
        React.createElement(QueryClientProvider, { client: anonClient }, React.createElement(Probe))
      );
      assert.equal(apiCalls, 0);
    });
  });

  describe("FocusRoomPage -> RoomPresence invite forwarding & rejection gate", () => {
    function renderFocusPage(roomId, client) {
      const router = createMemoryRouter(
        [{ path: "/rooms/:roomId", element: React.createElement(FocusRoomPage) }],
        { initialEntries: [`/rooms/${roomId}`] }
      );
      try {
        return renderToString(
          React.createElement(QueryClientProvider, { client },
            React.createElement(RouterProvider, { router })
          )
        );
      } finally {
        router.dispose();
      }
    }

    it("passes guest.inviteCode to RoomPresence without fetching private detail", () => {
      grantPrivateRoomAccess(PRIVATE_ROOM, "xy98za", USER_1, getSessionGeneration());
      let apiCalls = 0;
      globalThis.__ACCESS_TEST_API__ = async () => {
        apiCalls++;
        return jsonResponse(PRIVATE_ROOM);
      };

      const client = createTestQueryClient();
      const html = renderFocusPage(ROOM_1, client);

      assert.equal(apiCalls, 0);
      assert.deepEqual(globalThis.__FOCUS_PAGE_PRESENCE_PROPS__, [
        { roomId: ROOM_1, maxSlots: 16, initialInviteCode: "XY98ZA" },
      ]);
      assert.match(html, /data-presence-spy="XY98ZA"/);
    });

    it("renders PrivateRoomGate with preserved errorCode and 0 detail requests on guest rejection", () => {
      let apiCalls = 0;
      globalThis.__ACCESS_TEST_API__ = async () => {
        apiCalls++;
        return jsonResponse(PRIVATE_ROOM);
      };

      grantPrivateRoomAccess(PRIVATE_ROOM, "AB12CD", USER_1, getSessionGeneration());
      rejectPrivateRoomAccess(ROOM_1, "FORBIDDEN");
      const forbiddenHtml = renderFocusPage(ROOM_1, createTestQueryClient());
      assert.equal(apiCalls, 0);
      assert.equal(globalThis.__FOCUS_PAGE_PRESENCE_PROPS__.length, 0);
      assert.match(forbiddenHtml, /<h1 id="private-access-title">Phòng riêng được bảo vệ<\/h1>/);
      assert.match(forbiddenHtml, /Quyền vào phòng đã bị từ chối\. Hãy xác thực lại mã mời\./);
      assert.doesNotMatch(forbiddenHtml, /href="\/login"/);

      grantPrivateRoomAccess(PRIVATE_ROOM, "AB12CD", USER_1, getSessionGeneration());
      rejectPrivateRoomAccess(ROOM_1, "UNAUTHORIZED");
      const unauthHtml = renderFocusPage(ROOM_1, createTestQueryClient());
      assert.equal(apiCalls, 0);
      assert.equal(globalThis.__FOCUS_PAGE_PRESENCE_PROPS__.length, 0);
      assert.match(unauthHtml, /Phiên kết nối đã hết hạn\. Đăng nhập lại để tiếp tục\./);
      assert.match(unauthHtml, /<a[^>]*href="\/login"[^>]*>Đăng nhập lại<\/a>/);
    });

    it("passes undefined initialInviteCode for owner cached room and renders PrivateRoomGate on 403", () => {
      const client = createTestQueryClient();
      client.setQueryData(privateRoomDetailQuery(ROOM_1, USER_1).queryKey, PRIVATE_ROOM);

      renderFocusPage(ROOM_1, client);
      assert.deepEqual(globalThis.__FOCUS_PAGE_PRESENCE_PROPS__, [
        { roomId: ROOM_1, maxSlots: 16, initialInviteCode: undefined },
      ]);

      const forbiddenClient = createTestQueryClient();
      const query = forbiddenClient.getQueryCache().build(forbiddenClient, {
        queryKey: privateRoomDetailQuery(ROOM_1, USER_1).queryKey,
      });
      query.setState({
        status: "error",
        error: new ApiError(403, "Forbidden"),
        errorUpdatedAt: Date.now(),
      });
      const gateHtml = renderFocusPage(ROOM_1, forbiddenClient);
      assert.match(gateHtml, /Phòng riêng được bảo vệ/);
    });
  });

  describe("RoomPresence invite forwarding and reconnect retention", () => {
    function renderRoomPresence(props) {
      return mountElement(
        React.createElement(MemoryRouter, { initialEntries: [`/rooms/${ROOM_1}`] },
          React.createElement(RoomPresence, props, (details, seats) =>
            React.createElement("div", null, details, seats)
          )
        )
      );
    }

    it("forwards initialInviteCode and retains it across disconnect and non-credential error reconnects", async () => {
      grantPrivateRoomAccess(PRIVATE_ROOM, "AB12CD", USER_1, getSessionGeneration());
      const container = await renderRoomPresence({ roomId: ROOM_1, maxSlots: 16, initialInviteCode: "AB12CD" });

      assert.equal(globalThis.__ACCESS_TEST_PRESENCE_INSTANCES__.length, 1);
      assert.equal(globalThis.__ACCESS_TEST_PRESENCE_INSTANCES__[0].options.inviteCode, "AB12CD");
      assert.equal(globalThis.__ACCESS_TEST_PRESENCE_INSTANCES__[0].connected, true);

      // Non-credential error (ROOM_FULL) must NOT revoke guest access and reconnect must retain inviteCode
      await act(async () => {
        globalThis.__ACCESS_TEST_PRESENCE_INSTANCES__[0].emit({
          connection: "error",
          snapshot: null,
          error: "Phòng đã đầy.",
          errorCode: "ROOM_FULL",
        });
      });
      assert.ok(getPrivateRoomAccess(ROOM_1), "ROOM_FULL must not clear privateRoomAccess");
      assert.equal(getPrivateRoomRejection(ROOM_1), null);

      const retryBtn = findElements(container, (el) => el.tagName === "BUTTON" && el.textContent === "Kết nối lại")[0];
      assert.ok(retryBtn);
      await act(async () => {
        dispatchDomEvent(retryBtn, "click");
      });

      assert.equal(globalThis.__ACCESS_TEST_PRESENCE_INSTANCES__.length, 2);
      assert.equal(globalThis.__ACCESS_TEST_PRESENCE_INSTANCES__[0].disconnected, true);
      assert.equal(globalThis.__ACCESS_TEST_PRESENCE_INSTANCES__[1].options.inviteCode, "AB12CD");

      // Manual disconnect + reconnect also retains inviteCode
      const disconnectBtn = findElements(container, (el) => el.tagName === "BUTTON" && el.textContent === "Ngắt kết nối")[0];
      assert.ok(disconnectBtn);
      await act(async () => {
        dispatchDomEvent(disconnectBtn, "click");
      });
      const reconnectBtn = findElements(container, (el) => el.tagName === "BUTTON" && el.textContent === "Kết nối lại")[0];
      assert.ok(reconnectBtn);
      await act(async () => {
        dispatchDomEvent(reconnectBtn, "click");
      });

      assert.equal(globalThis.__ACCESS_TEST_PRESENCE_INSTANCES__.length, 3);
      assert.equal(globalThis.__ACCESS_TEST_PRESENCE_INSTANCES__[2].options.inviteCode, "AB12CD");
    });

    it("rejects guest access on FORBIDDEN/UNAUTHORIZED, preserves rejection code, and retains newly submitted code", async () => {
      grantPrivateRoomAccess(PRIVATE_ROOM, "AB12CD", USER_1, getSessionGeneration());
      const container = await renderRoomPresence({ roomId: ROOM_1, maxSlots: 16, initialInviteCode: "AB12CD" });

      await act(async () => {
        globalThis.__ACCESS_TEST_PRESENCE_INSTANCES__[0].emit({
          connection: "error",
          snapshot: null,
          error: "Phòng riêng yêu cầu mã mời đúng.",
          errorCode: "FORBIDDEN",
        });
      });

      assert.equal(getPrivateRoomAccess(ROOM_1), null, "FORBIDDEN must clear stale guest access");
      assert.equal(getPrivateRoomRejection(ROOM_1)?.code, "FORBIDDEN");

      const form = findElements(container, (el) => el.tagName === "FORM")[0];
      const input = findElements(container, (el) => el.tagName === "INPUT")[0];
      assert.ok(form && input, "inline invite form renders on FORBIDDEN");

      await act(async () => {
        protoValueSet.call(input, " xy98za ");
        dispatchDomEvent(input, "input");
      });
      await act(async () => {
        dispatchDomEvent(form, "submit");
      });

      assert.equal(globalThis.__ACCESS_TEST_PRESENCE_INSTANCES__.length, 2);
      assert.equal(globalThis.__ACCESS_TEST_PRESENCE_INSTANCES__[1].options.inviteCode, "XY98ZA");

      // Subsequent reconnect retains the newly submitted normalized code
      await act(async () => {
        globalThis.__ACCESS_TEST_PRESENCE_INSTANCES__[1].emit({
          connection: "error",
          snapshot: null,
          error: "Phòng đã đầy.",
          errorCode: "ROOM_FULL",
        });
      });
      const retryBtn = findElements(container, (el) => el.tagName === "BUTTON" && el.textContent === "Kết nối lại")[0];
      await act(async () => {
        dispatchDomEvent(retryBtn, "click");
      });

      assert.equal(globalThis.__ACCESS_TEST_PRESENCE_INSTANCES__.length, 3);
      assert.equal(globalThis.__ACCESS_TEST_PRESENCE_INSTANCES__[2].options.inviteCode, "XY98ZA");

      // UNAUTHORIZED also calls rejectPrivateRoomAccess when initialInviteCode is present
      grantPrivateRoomAccess(PRIVATE_ROOM, "XY98ZA", USER_1, getSessionGeneration());
      await act(async () => {
        globalThis.__ACCESS_TEST_PRESENCE_INSTANCES__[2].emit({
          connection: "error",
          snapshot: null,
          error: "Phiên kết nối đã hết hạn.",
          errorCode: "UNAUTHORIZED",
        });
      });
      assert.equal(getPrivateRoomAccess(ROOM_1), null);
      assert.equal(getPrivateRoomRejection(ROOM_1)?.code, "UNAUTHORIZED");
    });
  });
});
