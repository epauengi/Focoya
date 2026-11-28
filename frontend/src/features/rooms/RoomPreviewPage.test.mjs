import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import { URL } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router";

const reactUrl = import.meta.resolve("react");
const reactJsxRuntimeUrl = import.meta.resolve("react/jsx-runtime");
const reactRouterUrl = import.meta.resolve("react-router");
const reactQueryUrl = import.meta.resolve("@tanstack/react-query");

// Shim useSyncExternalStore server snapshot for SSR rendering of client-only external stores.
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

export async function apiRequest(path, init, expectedUserId) {
  if (!globalThis.__ROOM_PREVIEW_TEST_API_REQUEST__) {
    throw new Error(\`Unexpected apiRequest call: \${path}\`);
  }
  return globalThis.__ROOM_PREVIEW_TEST_API_REQUEST__(path, init, expectedUserId);
}
`;
const sessionStubDataUrl = `data:text/javascript;base64,${Buffer.from(sessionStubSource).toString("base64")}`;
const { ApiError, __setTestSession, getSessionGeneration } = await import(sessionStubDataUrl);

function transpileModule(relPath, replacements = []) {
  const source = fs
    .readFileSync(new URL(relPath, import.meta.url), "utf8")
    .replace(/^\s*import\s+["'][^"']+\.css["'];?\s*$/gm, "");
  let transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const [pattern, target] of replacements) {
    transpiled = transpiled.replace(pattern, `$1${target}$2`);
  }
  return `data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`;
}

const roomsDataUrl = transpileModule("./rooms.ts");
const privateRoomsDataUrl = transpileModule("./privateRooms.ts", [
  [/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, sessionStubDataUrl],
  [/(from\s+["'])\.\/rooms(["'])/g, roomsDataUrl],
]);
const privateRoomQueriesDataUrl = transpileModule("./privateRoomQueries.ts", [
  [/(from\s+["'])@tanstack\/react-query(["'])/g, reactQueryUrl],
  [/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, sessionStubDataUrl],
  [/(from\s+["'])\.\/rooms(["'])/g, roomsDataUrl],
  [/(from\s+["'])\.\/privateRooms(["'])/g, privateRoomsDataUrl],
]);
const privateRoomAccessDataUrl = transpileModule("./privateRoomAccess.ts", [
  [/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, sessionStubDataUrl],
  [/(from\s+["'])\.\/privateRooms(["'])/g, privateRoomsDataUrl],
  [/(from\s+["'])\.\/rooms(["'])/g, roomsDataUrl],
]);
const useAccessibleRoomDataUrl = transpileModule("./useAccessibleRoom.ts", [
  [/(from\s+["'])react(["'])/g, reactShimUrl],
  [/(from\s+["'])@tanstack\/react-query(["'])/g, reactQueryUrl],
  [/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, sessionStubDataUrl],
  [/(from\s+["'])\.\/privateRoomAccess(["'])/g, privateRoomAccessDataUrl],
  [/(from\s+["'])\.\/privateRoomQueries(["'])/g, privateRoomQueriesDataUrl],
]);
const roomQueryStateDataUrl = transpileModule("./RoomQueryState.tsx", [
  [/(from\s+["'])react\/jsx-runtime(["'])/g, reactJsxRuntimeUrl],
  [/(from\s+["'])react-router(["'])/g, reactRouterUrl],
  [/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, sessionStubDataUrl],
]);
const joinByCodeFormDataUrl = transpileModule("./JoinByCodeForm.tsx", [
  [/(from\s+["'])react\/jsx-runtime(["'])/g, reactJsxRuntimeUrl],
  [/(from\s+["'])react(["'])/g, reactShimUrl],
  [/(from\s+["'])react-router(["'])/g, reactRouterUrl],
  [/(from\s+["'])@\/auth\/session(["'])/g, sessionStubDataUrl],
  [/(from\s+["'])\.\/rooms(["'])/g, roomsDataUrl],
  [/(from\s+["'])\.\/privateRooms(["'])/g, privateRoomsDataUrl],
  [/(from\s+["'])\.\/privateRoomAccess(["'])/g, privateRoomAccessDataUrl],
]);
const privateRoomGateDataUrl = transpileModule("./PrivateRoomGate.tsx", [
  [/(from\s+["'])react\/jsx-runtime(["'])/g, reactJsxRuntimeUrl],
  [/(from\s+["'])react-router(["'])/g, reactRouterUrl],
  [/(from\s+["'])\.\/JoinByCodeForm(["'])/g, joinByCodeFormDataUrl],
]);
const inviteCodeShareDataUrl = transpileModule("./InviteCodeShare.tsx", [
  [/(from\s+["'])react\/jsx-runtime(["'])/g, reactJsxRuntimeUrl],
  [/(from\s+["'])react(["'])/g, reactShimUrl],
]);
const previewDataUrl = transpileModule("./RoomPreviewPage.tsx", [
  [/(from\s+["'])react\/jsx-runtime(["'])/g, reactJsxRuntimeUrl],
  [/(from\s+["'])react(["'])/g, reactShimUrl],
  [/(from\s+["'])react-router(["'])/g, reactRouterUrl],
  [/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, sessionStubDataUrl],
  [/(from\s+["'])\.\/useAccessibleRoom(["'])/g, useAccessibleRoomDataUrl],
  [/(from\s+["'])\.\/RoomQueryState(["'])/g, roomQueryStateDataUrl],
  [/(from\s+["'])\.\/PrivateRoomGate(["'])/g, privateRoomGateDataUrl],
  [/(from\s+["'])\.\/InviteCodeShare(["'])/g, inviteCodeShareDataUrl],
]);

const { privateRoomDetailQuery } = await import(privateRoomQueriesDataUrl);
const {
  clearPrivateRoomAccess,
  getPrivateRoomAccess,
  getPrivateRoomRejection,
  grantPrivateRoomAccess,
  rejectPrivateRoomAccess,
} = await import(privateRoomAccessDataUrl);
const { RoomPreviewPage } = await import(previewDataUrl);

const USER_ID = "4251cc03-c9a7-42ac-a3d1-e75850417ab4";
const VALID_ROOM_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const SAMPLE_ROOM = {
  id: VALID_ROOM_ID,
  name: "Cozy Café",
  theme: "Café",
  online: 3,
  maxSlots: 16,
  image: "/room-assets/rainy.jpg",
  description: "Phòng học yên tĩnh cùng tiếng mưa",
  visibility: "PUBLIC",
  inviteCode: null,
};

const PRIVATE_ROOM = {
  ...SAMPLE_ROOM,
  name: "Nhóm Ôn Thi",
  theme: "Study",
  visibility: "PRIVATE",
  inviteCode: "AB12CD",
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryOnMount: false,
        gcTime: 0,
      },
    },
  });
}

function detailKey(roomId) {
  return privateRoomDetailQuery(roomId, USER_ID).queryKey;
}

function renderPreview(roomId, client) {
  const queryClient = client ?? createTestQueryClient();
  const entry = roomId ? `/rooms/${roomId}/preview` : "/rooms";
  return renderToString(
    React.createElement(QueryClientProvider, { client: queryClient },
      React.createElement(MemoryRouter, { initialEntries: [entry] },
        React.createElement(Routes, null,
          React.createElement(Route, { path: "/rooms/:roomId/preview", element: React.createElement(RoomPreviewPage) }),
          React.createElement(Route, { path: "/rooms", element: React.createElement(RoomPreviewPage) })
        )
      )
    )
  );
}

describe("RoomPreviewPage regression suite", () => {
  beforeEach(() => {
    clearPrivateRoomAccess();
    globalThis.__ROOM_PREVIEW_TEST_API_REQUEST__ = null;
    __setTestSession({
      status: "authenticated",
      user: { id: USER_ID, email: "u@focoya.test", displayName: "An", avatarKey: null, role: "user" },
      error: "",
    }, true);
  });

  describe("Success state rendering", () => {
    it("renders public room details, scene image, metadata, and active navigation links", () => {
      const client = createTestQueryClient();
      client.setQueryData(detailKey(VALID_ROOM_ID), SAMPLE_ROOM);

      const html = renderPreview(VALID_ROOM_ID, client);

      assert.match(html, /<main[^>]*aria-busy="false"/);
      assert.match(html, /<a[^>]*class="rooms-back"[^>]*href="\/rooms"/);
      assert.match(html, /Quay lại Explore/);
      assert.match(html, /<h1[^>]*id="preview-title"[^>]*>Cozy Café<\/h1>/);
      assert.match(html, /Chủ đề:(?:<!-- -->|\s)*Café/);
      assert.doesNotMatch(html, /Phòng riêng ·/);
      assert.match(html, /Phòng học yên tĩnh cùng tiếng mưa/);
      assert.match(html, /<dd>16<span class="rooms-sr-only">\s*người<\/span><\/dd>/);
      assert.match(html, /<img[^>]*src="\/room-assets\/rainy\.jpg"/);
      assert.match(html, /alt="Không gian Cozy Café"/);
      assert.match(html, /decoding="async"/);
      assert.match(html, /fetchpriority="high"/i);
      assert.match(html, /<a[^>]*class="rooms-button"[^>]*href="\/rooms\/3fa85f64-5717-4562-b3fc-2c963f66afa6"[^>]*>Vào phòng/);
      assert.match(html, /<a[^>]*class="rooms-text-link"[^>]*href="\/rooms"[^>]*>Chọn phòng khác<\/a>/);
    });

    it("renders fallback 'Phòng chưa có mô tả.' when room description is empty or whitespace", () => {
      for (const emptyDesc of ["", "   ", "\n\t  "]) {
        const client = createTestQueryClient();
        client.setQueryData(detailKey(VALID_ROOM_ID), {
          ...SAMPLE_ROOM,
          description: emptyDesc,
        });

        const html = renderPreview(VALID_ROOM_ID, client);
        assert.match(html, /<p class="rooms-preview-description">Phòng chưa có mô tả\.<\/p>/);
      }
    });

    it("shows REST last-known counts with no-reservation note and keeps Join active even when online >= maxSlots", () => {
      const client = createTestQueryClient();
      client.setQueryData(detailKey(VALID_ROOM_ID), {
        ...SAMPLE_ROOM,
        online: 16,
        maxSlots: 16,
      });

      const html = renderPreview(VALID_ROOM_ID, client);

      assert.match(html, /<dt>Online gần nhất<\/dt><dd>16<\/dd>/);
      assert.match(html, /<dt>Tối đa<\/dt><dd>16<span class="rooms-sr-only">\s*người<\/span><\/dd>/);
      assert.match(html, /<dt>Chỗ trống gần nhất<\/dt><dd>0<\/dd>/);
      assert.match(
        html,
        /id="room-presence-note"[^>]*>Số online là lần ghi nhận từ máy chủ, không giữ chỗ\. Kết nối realtime xác nhận quyền vào phòng và số người thực tế; phòng có thể đầy trước khi bạn vào\./
      );
      assert.match(html, /<a[^>]*class="rooms-button"[^>]*href="\/rooms\/3fa85f64-5717-4562-b3fc-2c963f66afa6"[^>]*>Vào phòng/);
      assert.doesNotMatch(html, /disabled/i);

      // Clamps remaining slots at 0 if online exceeds maxSlots
      const overClient = createTestQueryClient();
      overClient.setQueryData(detailKey(VALID_ROOM_ID), {
        ...SAMPLE_ROOM,
        online: 20,
        maxSlots: 16,
      });
      const overHtml = renderPreview(VALID_ROOM_ID, overClient);
      assert.match(overHtml, /<dt>Chỗ trống gần nhất<\/dt><dd>0<\/dd>/);
    });

    it("renders private room back link to /my-rooms, shares owner invite code, and hides it for guests", () => {
      const ownerClient = createTestQueryClient();
      ownerClient.setQueryData(detailKey(VALID_ROOM_ID), PRIVATE_ROOM);

      const ownerHtml = renderPreview(VALID_ROOM_ID, ownerClient);
      assert.match(ownerHtml, /<a[^>]*class="rooms-back"[^>]*href="\/my-rooms"/);
      assert.match(ownerHtml, /Quay lại My Rooms/);
      assert.match(ownerHtml, /Phòng riêng · (?:<!-- -->|\s)*Chủ đề:(?:<!-- -->|\s)*Study/);
      assert.match(ownerHtml, /value="AB12CD"/);
      assert.match(ownerHtml, /Sao chép mã/);

      grantPrivateRoomAccess(PRIVATE_ROOM, "AB12CD", USER_ID, getSessionGeneration());
      const guestClient = createTestQueryClient();
      const guestHtml = renderPreview(VALID_ROOM_ID, guestClient);
      assert.match(guestHtml, /<main[^>]*aria-busy="false"/);
      assert.match(guestHtml, /<a[^>]*class="rooms-back"[^>]*href="\/my-rooms"/);
      assert.match(guestHtml, /Quay lại My Rooms/);
      assert.match(guestHtml, /<h1[^>]*id="preview-title"[^>]*>Nhóm Ôn Thi<\/h1>/);
      assert.doesNotMatch(guestHtml, /AB12CD/);
      assert.doesNotMatch(guestHtml, /Sao chép mã/);
    });
  });

  describe("Loading state", () => {
    it("sets main aria-busy true, displays loading indicator, and preserves back link", () => {
      const client = createTestQueryClient();
      const html = renderPreview(VALID_ROOM_ID, client);

      assert.match(html, /<main[^>]*aria-busy="true"/);
      assert.match(html, /<a[^>]*class="rooms-back"[^>]*href="\/rooms"/);
      assert.match(html, /<section[^>]*class="rooms-empty"[^>]*role="status"/);
      assert.match(html, /<h2>Đang tải phòng\.\.\.<\/h2>/);
      assert.doesNotMatch(html, /class="rooms-preview"/);
    });
  });

  describe("Error states and PrivateRoomGate handling", () => {
    it("renders retry button and error message for network/server error with visible back link", () => {
      const client = createTestQueryClient();
      const query = client.getQueryCache().build(client, {
        queryKey: detailKey(VALID_ROOM_ID),
      });
      query.setState({
        status: "error",
        error: new Error("Mất kết nối máy chủ"),
        errorUpdatedAt: Date.now(),
      });

      const html = renderPreview(VALID_ROOM_ID, client);

      assert.match(html, /<a[^>]*class="rooms-back"[^>]*href="\/rooms"/);
      assert.match(html, /<section[^>]*class="rooms-empty"[^>]*role="alert"/);
      assert.match(html, /<h2>Không tải được phòng<\/h2>/);
      assert.match(html, /<p>Mất kết nối máy chủ<\/p>/);
      assert.match(html, /<button class="rooms-button">Thử lại<\/button>/);
      assert.match(html, /<a[^>]*class="rooms-text-link"[^>]*href="\/rooms"[^>]*>Khám phá phòng<\/a>/);
    });

    it("renders PrivateRoomGate on 403 Forbidden without guest access", () => {
      const client = createTestQueryClient();
      const query = client.getQueryCache().build(client, {
        queryKey: detailKey(VALID_ROOM_ID),
      });
      query.setState({
        status: "error",
        error: new ApiError(403, "Bạn không có quyền truy cập phòng này."),
        errorUpdatedAt: Date.now(),
      });

      const html = renderPreview(VALID_ROOM_ID, client);

      assert.match(html, /<section[^>]*class="prooms-access"[^>]*aria-labelledby="private-access-title"/);
      assert.match(html, /<h1 id="private-access-title">Phòng riêng được bảo vệ<\/h1>/);
      assert.match(html, /<form[^>]*aria-labelledby="private-access-title"/);
      assert.doesNotMatch(html, /<h2[^>]*>/);
      assert.doesNotMatch(html, /Nhập lại mã mời để truy cập phòng/);
      assert.match(html, /<button class="rooms-button" type="submit">Tham gia<\/button>/);
      assert.match(html, /<a[^>]*class="rooms-text-link"[^>]*href="\/my-rooms"[^>]*>Quay về My Rooms<\/a>/);
      assert.doesNotMatch(html, /<button[^>]*>Thử lại<\/button>/);
    });

    it("renders PrivateRoomGate with preserved errorCode and 0 detail requests after guest rejection", () => {
      let detailCalls = 0;
      globalThis.__ROOM_PREVIEW_TEST_API_REQUEST__ = async () => {
        detailCalls++;
        return new globalThis.Response(JSON.stringify(PRIVATE_ROOM), { status: 200 });
      };

      grantPrivateRoomAccess(PRIVATE_ROOM, "AB12CD", USER_ID, getSessionGeneration());
      rejectPrivateRoomAccess(VALID_ROOM_ID, "UNAUTHORIZED");

      assert.equal(getPrivateRoomAccess(VALID_ROOM_ID), null);
      assert.equal(getPrivateRoomRejection(VALID_ROOM_ID)?.code, "UNAUTHORIZED");

      const rejectedHtml = renderPreview(VALID_ROOM_ID, createTestQueryClient());
      assert.equal(detailCalls, 0);
      assert.match(rejectedHtml, /<h1 id="private-access-title">Phòng riêng được bảo vệ<\/h1>/);
      assert.match(rejectedHtml, /Phiên kết nối đã hết hạn\. Đăng nhập lại để tiếp tục\./);
      assert.match(rejectedHtml, /<a[^>]*href="\/login"[^>]*>Đăng nhập lại<\/a>/);

      // Revalidation clears rejection and restores guest preview
      grantPrivateRoomAccess(PRIVATE_ROOM, "XY98ZA", USER_ID, getSessionGeneration());
      assert.equal(getPrivateRoomRejection(VALID_ROOM_ID), null);
      const restoredHtml = renderPreview(VALID_ROOM_ID, createTestQueryClient());
      assert.match(restoredHtml, /<h1[^>]*id="preview-title"[^>]*>Nhóm Ôn Thi<\/h1>/);
    });

    it("renders 404 Not Found without retry button and preserves back link", () => {
      const client = createTestQueryClient();
      const query = client.getQueryCache().build(client, {
        queryKey: detailKey(VALID_ROOM_ID),
      });
      query.setState({
        status: "error",
        error: new ApiError(404, "Phòng không tồn tại."),
        errorUpdatedAt: Date.now(),
      });

      const html = renderPreview(VALID_ROOM_ID, client);

      assert.match(html, /<a[^>]*class="rooms-back"[^>]*href="\/rooms"/);
      assert.match(html, /<section[^>]*class="rooms-empty"[^>]*role="alert"/);
      assert.match(html, /<h2>Không tìm thấy phòng<\/h2>/);
      assert.match(html, /<p>Phòng không tồn tại\.<\/p>/);
      assert.doesNotMatch(html, /<button[^>]*>Thử lại<\/button>/);
      assert.match(html, /<a[^>]*class="rooms-text-link"[^>]*href="\/rooms"[^>]*>Khám phá phòng<\/a>/);
    });
  });

  describe("Query code and invalid UUID handling", () => {
    it("rejects invalid UUID with 404 ApiError immediately without making HTTP request", async () => {
      let networkCalled = false;
      globalThis.__ROOM_PREVIEW_TEST_API_REQUEST__ = async () => {
        networkCalled = true;
        return { ok: true, json: async () => SAMPLE_ROOM };
      };

      const query = privateRoomDetailQuery("invalid-uuid", USER_ID);
      await assert.rejects(
        async () => query.queryFn({ signal: undefined }),
        (err) => err instanceof ApiError && err.status === 404
      );
      assert.equal(networkCalled, false);
    });
  });

  describe("Navigation destinations", () => {
    it("ensures public back link targets /rooms and private back link targets /my-rooms with join targeting /rooms/:id", () => {
      const publicClient = createTestQueryClient();
      publicClient.setQueryData(detailKey(VALID_ROOM_ID), SAMPLE_ROOM);
      const publicHtml = renderPreview(VALID_ROOM_ID, publicClient);
      const publicHrefs = [...publicHtml.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      assert.ok(publicHrefs.includes("/rooms"));
      assert.ok(publicHrefs.includes(`/rooms/${VALID_ROOM_ID}`));

      const privateClient = createTestQueryClient();
      privateClient.setQueryData(detailKey(VALID_ROOM_ID), PRIVATE_ROOM);
      const privateHtml = renderPreview(VALID_ROOM_ID, privateClient);
      const privateHrefs = [...privateHtml.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      assert.ok(privateHrefs.includes("/my-rooms"));
      assert.ok(privateHrefs.includes(`/rooms/${VALID_ROOM_ID}`));
      assert.ok(privateHrefs.includes("/rooms"));
    });
  });
});
