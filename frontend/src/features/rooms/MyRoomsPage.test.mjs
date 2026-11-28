import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import { setTimeout } from "node:timers";
import { URL } from "node:url";
import ts from "typescript";

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
    this.checked = false;
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
  get options() {
    return this.childNodes.filter((c) => c instanceof DomElement && c.tagName === "OPTION");
  }
  get firstChild() {
    return this.childNodes[0] ?? null;
  }
  focus() {}
  select() {}
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

function isEffectivelyDisabled(el) {
  if (el.disabled) return true;
  for (let cur = el.parentNode; cur; cur = cur.parentNode) {
    if (cur instanceof DomElement && cur.tagName === "FIELDSET" && cur.disabled) return true;
  }
  return false;
}

const React = (await import("react")).default;
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { MemoryRouter } = await import("react-router");

const reactUrl = import.meta.resolve("react");
const reactJsxRuntimeUrl = import.meta.resolve("react/jsx-runtime");
const reactRouterUrl = import.meta.resolve("react-router");
const reactQueryUrl = import.meta.resolve("@tanstack/react-query");

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
export function getSession() { return currentSession; }
export function getSessionGeneration() { return currentGen; }
export function subscribeSession(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export async function apiRequest(path, init, expectedUserId) {
  if (!globalThis.__MY_ROOMS_TEST_API__) {
    throw new Error(\`Unexpected apiRequest call: \${path}\`);
  }
  return globalThis.__MY_ROOMS_TEST_API__(path, init, expectedUserId);
}
`;
const sessionStubUrl = `data:text/javascript;base64,${Buffer.from(sessionStubSource).toString("base64")}`;
const { ApiError, __setTestSession } = await import(sessionStubUrl);

function transpileModule(relPath, replacements = []) {
  const src = fs
    .readFileSync(new URL(relPath, import.meta.url), "utf8")
    .replace(/^\s*import\s+["'][^"']+\.css["'];?\s*$/gm, "");
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
const inviteCodeShareUrl = transpileModule("./InviteCodeShare.tsx", [
  [/(from\s+["'])react\/jsx-runtime(["'])/g, reactJsxRuntimeUrl],
  [/(from\s+["'])react(["'])/g, reactShimUrl],
]);
const createPrivateRoomFormUrl = transpileModule("./CreatePrivateRoomForm.tsx", [
  [/(from\s+["'])react\/jsx-runtime(["'])/g, reactJsxRuntimeUrl],
  [/(from\s+["'])react(["'])/g, reactShimUrl],
  [/(from\s+["'])react-router(["'])/g, reactRouterUrl],
  [/(from\s+["'])@tanstack\/react-query(["'])/g, reactQueryUrl],
  [/(from\s+["'])@\/auth\/session(["'])/g, sessionStubUrl],
  [/(from\s+["'])\.\/rooms(["'])/g, roomsUrl],
  [/(from\s+["'])\.\/privateRooms(["'])/g, privateRoomsUrl],
  [/(from\s+["'])\.\/privateRoomQueries(["'])/g, privateRoomQueriesUrl],
  [/(from\s+["'])\.\/privateRoomAccess(["'])/g, privateRoomAccessUrl],
  [/(from\s+["'])\.\/InviteCodeShare(["'])/g, inviteCodeShareUrl],
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
const myRoomsPageUrl = transpileModule("./MyRoomsPage.tsx", [
  [/(from\s+["'])react\/jsx-runtime(["'])/g, reactJsxRuntimeUrl],
  [/(from\s+["'])react(["'])/g, reactShimUrl],
  [/(from\s+["'])react-router(["'])/g, reactRouterUrl],
  [/(from\s+["'])@tanstack\/react-query(["'])/g, reactQueryUrl],
  [/(from\s+["'])@\/auth\/session(["'])/g, sessionStubUrl],
  [/(from\s+["'])\.\/rooms(["'])/g, roomsUrl],
  [/(from\s+["'])\.\/privateRooms(["'])/g, privateRoomsUrl],
  [/(from\s+["'])\.\/privateRoomQueries(["'])/g, privateRoomQueriesUrl],
  [/(from\s+["'])\.\/CreatePrivateRoomForm(["'])/g, createPrivateRoomFormUrl],
  [/(from\s+["'])\.\/JoinByCodeForm(["'])/g, joinByCodeFormUrl],
  [/(from\s+["'])\.\/InviteCodeShare(["'])/g, inviteCodeShareUrl],
]);

const { MyRoomsPage } = await import(myRoomsPageUrl);

function jsonResponse(body, status = 200) {
  return new globalThis.Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const USER_1 = "4251cc03-c9a7-42ac-a3d1-e75850417ab4";
const ROOM_1 = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const ROOM_2 = "c9b2e04f-6d27-4402-9993-2fb53bf1cf02";

const OWNED_ROOM_1 = {
  id: ROOM_1,
  name: "Phòng Ôn 1",
  theme: "Study",
  online: 0,
  maxSlots: 10,
  image: "/room-assets/rainy.jpg",
  description: "",
  visibility: "PRIVATE",
  inviteCode: "AA11BB",
};

const OWNED_ROOM_2 = {
  ...OWNED_ROOM_1,
  id: ROOM_2,
  name: "Phòng Ôn 2",
  inviteCode: "CC22DD",
};

let mountedRoots = [];
let createdClients = [];

function createTestQueryClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryOnMount: false, gcTime: 0 } },
  });
  createdClients.push(client);
  return client;
}

async function mountMyRooms(client) {
  const container = doc.createElement("div");
  const root = createRoot(container);
  mountedRoots.push(root);
  await act(async () => {
    root.render(
      React.createElement(QueryClientProvider, { client },
        React.createElement(MemoryRouter, { initialEntries: ["/my-rooms"] },
          React.createElement(MyRoomsPage)
        )
      )
    );
  });
  return container;
}

describe("MyRoomsPage !ownedKnown & uncertain create cancel/reopen guard", () => {
  beforeEach(() => {
    globalThis.__MY_ROOMS_TEST_API__ = null;
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
  });

  it("disables creation while owned rooms query is pending or errored (!ownedKnown)", async () => {
    let resolveOwned;
    globalThis.__MY_ROOMS_TEST_API__ = (path) => {
      assert.equal(path, "/rooms/me");
      return new Promise((resolve) => { resolveOwned = resolve; });
    };

    const client = createTestQueryClient();
    const container = await mountMyRooms(client);

    const createBtn = () => findElements(container, (el) => el.tagName === "BUTTON" && el.textContent === "Tạo phòng riêng")[0];
    assert.equal(isEffectivelyDisabled(createBtn()), true, "disabled while ownedRoomsQuery is pending");

    // Reject owned rooms fetch -> isError -> !ownedKnown keeps button disabled
    await act(async () => {
      resolveOwned(jsonResponse({ message: "Server down" }, 500));
      await new Promise((r) => setTimeout(r, 10));
    });
    assert.equal(isEffectivelyDisabled(createBtn()), true, "disabled while ownedRoomsQuery is in error");
  });

  it("disables creation after uncertain create + failed recheck, preventing cancel/reopen retry until owned rooms succeed", async () => {
    let ownedMode = "empty";
    let postCalls = 0;
    globalThis.__MY_ROOMS_TEST_API__ = async (path, init) => {
      if (path === "/rooms/me") {
        if (ownedMode === "empty") return jsonResponse([]);
        if (ownedMode === "fail") throw new ApiError(500, "Recheck failed");
        if (ownedMode === "two") return jsonResponse([OWNED_ROOM_1, OWNED_ROOM_2]);
      }
      if (path === "/rooms" && init?.method === "POST") {
        postCalls++;
        throw new ApiError(500, "Gateway timeout");
      }
      throw new Error(`Unexpected call: ${path}`);
    };

    const client = createTestQueryClient();
    const container = await mountMyRooms(client);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 15));
    });

    const getCreateBtn = () => findElements(container, (el) => el.tagName === "BUTTON" && el.textContent === "Tạo phòng riêng")[0];
    assert.equal(isEffectivelyDisabled(getCreateBtn()), false, "enabled once ownedKnown with 0 rooms");

    // Open CreatePrivateRoomForm
    await act(async () => {
      dispatchDomEvent(getCreateBtn(), "click");
    });
    const getCreatePanel = () => findElements(container, (el) => el.tagName === "SECTION" && el.attrs["aria-label"] === "Biểu mẫu tạo phòng riêng")[0];
    assert.ok(getCreatePanel(), "create form panel opened");

    // Fill room name and submit -> uncertain 500 + failed /rooms/me recheck
    ownedMode = "fail";
    const nameInput = findElements(getCreatePanel(), (el) => el.tagName === "INPUT" && el.type === "text")[0];
    const form = findElements(getCreatePanel(), (el) => el.tagName === "FORM")[0];
    assert.ok(nameInput && form);

    await act(async () => {
      protoValueSet.call(nameInput, "Nhóm Ôn Thi");
      dispatchDomEvent(nameInput, "input");
    });
    await act(async () => {
      dispatchDomEvent(form, "submit");
      await new Promise((r) => setTimeout(r, 20));
    });

    assert.equal(postCalls, 1);
    assert.match(container.textContent, /Không thể kiểm tra lại danh sách phòng lúc này/);

    // Cancel/close create form
    const closeBtn = findElements(getCreatePanel(), (el) => el.tagName === "BUTTON" && (el.textContent === "Hủy" || el.textContent === "Đóng"))[0];
    assert.ok(closeBtn, "close/cancel button available in create panel");
    await act(async () => {
      dispatchDomEvent(closeBtn, "click");
    });

    assert.equal(getCreatePanel(), undefined, "create form closed");
    assert.equal(isEffectivelyDisabled(getCreateBtn()), true, "create button must stay disabled when !ownedKnown after cancel");

    // Clicking disabled button must NOT reopen create form
    await act(async () => {
      if (!getCreateBtn().disabled) dispatchDomEvent(getCreateBtn(), "click");
    });
    assert.equal(getCreatePanel(), undefined, "cannot reopen create form while !ownedKnown");

    // Retry owned rooms -> succeeds with 2 rooms (limit reached) -> remains disabled with limit note
    ownedMode = "two";
    const retryBtn = findElements(container, (el) => el.tagName === "BUTTON" && el.textContent === "Thử lại")[0];
    assert.ok(retryBtn);
    await act(async () => {
      dispatchDomEvent(retryBtn, "click");
      await new Promise((r) => setTimeout(r, 20));
    });

    assert.match(container.textContent, /2\/2 phòng/);
    assert.equal(isEffectivelyDisabled(getCreateBtn()), true, "stays disabled when refreshed list reveals limit reached");
  });
});
