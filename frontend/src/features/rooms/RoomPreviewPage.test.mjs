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

export async function apiRequest(path, init) {
  if (!globalThis.__ROOM_PREVIEW_TEST_API_REQUEST__) {
    throw new Error(\`Unexpected apiRequest call: \${path}\`);
  }
  return globalThis.__ROOM_PREVIEW_TEST_API_REQUEST__(path, init);
}
`;
const sessionStubDataUrl = `data:text/javascript;base64,${Buffer.from(sessionStubSource).toString("base64")}`;
const { ApiError } = await import(sessionStubDataUrl);

const roomQueriesTsSource = fs.readFileSync(new URL("./roomQueries.ts", import.meta.url), "utf8");
const transpiledRoomQueries = ts.transpileModule(roomQueriesTsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
}).outputText
  .replace(/(from\s+["'])@tanstack\/react-query(["'])/g, `$1${reactQueryUrl}$2`)
  .replace(/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, `$1${sessionStubDataUrl}$2`)
  .replace(/(from\s+["'])\.\/rooms(["'])/g, `$1${roomsDataUrl}$2`);
const roomQueriesDataUrl = `data:text/javascript;base64,${Buffer.from(transpiledRoomQueries).toString("base64")}`;
const { roomKeys, roomQuery } = await import(roomQueriesDataUrl);

const roomQueryStateTsSource = fs.readFileSync(new URL("./RoomQueryState.tsx", import.meta.url), "utf8");
const transpiledRoomQueryState = ts.transpileModule(roomQueryStateTsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.ReactJSX },
}).outputText
  .replace(/(from\s+["'])react\/jsx-runtime(["'])/g, `$1${reactJsxRuntimeUrl}$2`)
  .replace(/(from\s+["'])react-router(["'])/g, `$1${reactRouterUrl}$2`)
  .replace(/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, `$1${sessionStubDataUrl}$2`);
const roomQueryStateDataUrl = `data:text/javascript;base64,${Buffer.from(transpiledRoomQueryState).toString("base64")}`;

const previewTsSource = fs.readFileSync(new URL("./RoomPreviewPage.tsx", import.meta.url), "utf8");
const transpiledPreview = ts.transpileModule(previewTsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.ReactJSX },
}).outputText
  .replace(/(from\s+["'])react\/jsx-runtime(["'])/g, `$1${reactJsxRuntimeUrl}$2`)
  .replace(/(from\s+["'])react(["'])/g, `$1${reactUrl}$2`)
  .replace(/(from\s+["'])@tanstack\/react-query(["'])/g, `$1${reactQueryUrl}$2`)
  .replace(/(from\s+["'])react-router(["'])/g, `$1${reactRouterUrl}$2`)
  .replace(/(from\s+["'])\.\/roomQueries(["'])/g, `$1${roomQueriesDataUrl}$2`)
  .replace(/(from\s+["'])\.\/RoomQueryState(["'])/g, `$1${roomQueryStateDataUrl}$2`);
const previewDataUrl = `data:text/javascript;base64,${Buffer.from(transpiledPreview).toString("base64")}`;
const { RoomPreviewPage } = await import(previewDataUrl);

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

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryOnMount: false,
      },
    },
  });
}

function renderPreview(roomId, client) {
  const queryClient = client ?? createTestQueryClient();
  const entry = roomId ? `/rooms/${roomId}` : "/rooms";
  return renderToString(
    React.createElement(QueryClientProvider, { client: queryClient },
      React.createElement(MemoryRouter, { initialEntries: [entry] },
        React.createElement(Routes, null,
          React.createElement(Route, { path: "/rooms/:roomId", element: React.createElement(RoomPreviewPage) }),
          React.createElement(Route, { path: "/rooms", element: React.createElement(RoomPreviewPage) })
        )
      )
    )
  );
}

describe("RoomPreviewPage regression suite", () => {
  beforeEach(() => {
    globalThis.__ROOM_PREVIEW_TEST_API_REQUEST__ = null;
  });

  describe("Success state rendering", () => {
    it("renders room details, scene image, metadata, and active navigation links", () => {
      const client = createTestQueryClient();
      client.setQueryData(roomKeys.detail(VALID_ROOM_ID), SAMPLE_ROOM);

      const html = renderPreview(VALID_ROOM_ID, client);

      assert.match(html, /<main[^>]*aria-busy="false"/);
      assert.match(html, /<a[^>]*class="rooms-back"[^>]*href="\/rooms"/);
      assert.match(html, /Quay lại Explore/);
      assert.match(html, /<h1[^>]*id="preview-title"[^>]*>Cozy Café<\/h1>/);
      assert.match(html, /Chủ đề:(?:<!-- -->|\s)*Café/);
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
        client.setQueryData(roomKeys.detail(VALID_ROOM_ID), {
          ...SAMPLE_ROOM,
          description: emptyDesc,
        });

        const html = renderPreview(VALID_ROOM_ID, client);
        assert.match(html, /<p class="rooms-preview-description">Phòng chưa có mô tả\.<\/p>/);
      }
    });

    it("ignores API online count and never infers full room even when online >= maxSlots", () => {
      const client = createTestQueryClient();
      client.setQueryData(roomKeys.detail(VALID_ROOM_ID), {
        ...SAMPLE_ROOM,
        online: 16,
        maxSlots: 16,
      });

      const html = renderPreview(VALID_ROOM_ID, client);

      assert.match(
        html,
        /<dt>Đang online<\/dt><dd><span aria-hidden="true">—<\/span><span class="rooms-sr-only">Chưa có dữ liệu<\/span><\/dd>/
      );
      assert.match(
        html,
        /<dt>Chỗ trống<\/dt><dd><span aria-hidden="true">—<\/span><span class="rooms-sr-only">Chưa có dữ liệu<\/span><\/dd>/
      );
      assert.doesNotMatch(html, /<dt>Đang online<\/dt><dd>16/);
      assert.doesNotMatch(html, /<dt>Chỗ trống<\/dt><dd>0/);
      assert.match(html, /id="room-presence-note"[^>]*>Chưa có dữ liệu online và chỗ trống thực tế; chưa thể xác định phòng đầy\./);
      assert.match(html, /<a[^>]*class="rooms-button"[^>]*href="\/rooms\/3fa85f64-5717-4562-b3fc-2c963f66afa6"[^>]*>Vào phòng/);
      assert.doesNotMatch(html, /disabled/i);
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

  describe("Error states and retry handling via RoomQueryState", () => {
    it("renders retry button and error message for network/server error with visible back link", () => {
      const client = createTestQueryClient();
      const query = client.getQueryCache().build(client, {
        queryKey: roomKeys.detail(VALID_ROOM_ID),
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

    it("renders 403 Forbidden without retry button and preserves back link", () => {
      const client = createTestQueryClient();
      const query = client.getQueryCache().build(client, {
        queryKey: roomKeys.detail(VALID_ROOM_ID),
      });
      query.setState({
        status: "error",
        error: new ApiError(403, "Bạn không có quyền truy cập phòng này."),
        errorUpdatedAt: Date.now(),
      });

      const html = renderPreview(VALID_ROOM_ID, client);

      assert.match(html, /<a[^>]*class="rooms-back"[^>]*href="\/rooms"/);
      assert.match(html, /<section[^>]*class="rooms-empty"[^>]*role="alert"/);
      assert.match(html, /<h2>Không thể truy cập phòng<\/h2>/);
      assert.match(html, /<p>Bạn không có quyền truy cập phòng này\.<\/p>/);
      assert.doesNotMatch(html, /<button[^>]*>Thử lại<\/button>/);
      assert.match(html, /<a[^>]*class="rooms-text-link"[^>]*href="\/rooms"[^>]*>Khám phá phòng<\/a>/);
    });

    it("renders 404 Not Found without retry button and preserves back link", () => {
      const client = createTestQueryClient();
      const query = client.getQueryCache().build(client, {
        queryKey: roomKeys.detail(VALID_ROOM_ID),
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

      const query = roomQuery("invalid-uuid");
      await assert.rejects(
        async () => query.queryFn({ signal: undefined }),
        (err) => err instanceof ApiError && err.status === 404
      );
      assert.equal(networkCalled, false);
    });
  });

  describe("Navigation destinations", () => {
    it("ensures back link targets /rooms and join link targets /rooms/:id", () => {
      const client = createTestQueryClient();
      client.setQueryData(roomKeys.detail(VALID_ROOM_ID), SAMPLE_ROOM);

      const html = renderPreview(VALID_ROOM_ID, client);

      const backMatches = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      assert.ok(backMatches.includes("/rooms"));
      assert.ok(backMatches.includes(`/rooms/${VALID_ROOM_ID}`));
    });
  });
});
