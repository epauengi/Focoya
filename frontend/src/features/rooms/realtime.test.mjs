import assert from "node:assert/strict";
import { after, afterEach, describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { setTimeout } from "node:timers";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import ts from "typescript";

const testDirectory = fs.mkdtempSync(path.join(path.dirname(fileURLToPath(import.meta.url)), ".realtime-test-"));
const source = fs.readFileSync(new URL("./realtime.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
}).outputText;
const modulePath = path.join(testDirectory, "realtime.mjs");
fs.writeFileSync(modulePath, compiled);
const { createRoomPresence, parsePresenceSnapshot } = await import(pathToFileURL(modulePath));

after(() => fs.rmSync(testDirectory, { recursive: true, force: true }));

const ROOM_ID = "6d719321-3e10-411d-93ad-0411e2f3e984";
const USER_ID = "4251cc03-c9a7-42ac-a3d1-e75850417ab4";
const OTHER_USER_ID = "df9c1a30-2d69-4e76-9c02-2eeb748341d2";
const sessions = [];

function parseFrame(raw) {
  const boundary = raw.indexOf("\n\n");
  assert.notEqual(boundary, -1, `Invalid STOMP frame: ${raw}`);
  const lines = raw.slice(0, boundary).split("\n");
  const headers = Object.fromEntries(lines.slice(1).map((line) => {
    const separator = line.indexOf(":");
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
  return { command: lines[0], headers, body: raw.slice(boundary + 2).replace(/\0$/, "") };
}

function serializeFrame(command, headers = {}, body = "") {
  return `${command}\n${Object.entries(headers).map(([key, value]) => `${key}:${value}`).join("\n")}\n\n${body}\0`;
}

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor({ autoAcknowledgeLeave = true } = {}) {
    this.readyState = FakeWebSocket.CONNECTING;
    this.url = "ws://localhost:8080/ws-room";
    this.protocol = "";
    this.extensions = "";
    this.binaryType = "blob";
    this.autoAcknowledgeLeave = autoAcknowledgeLeave;
    this.frames = [];
    this.subscriptions = new Map();
    this.pendingCommands = [];
    globalThis.queueMicrotask(() => this.open());
  }

  open() {
    if (this.readyState !== FakeWebSocket.CONNECTING) return;
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.({ target: this });
  }

  send(raw) {
    if (this.readyState !== FakeWebSocket.OPEN) throw new Error("Socket is not open");
    if (raw === "\n") return;
    const frame = parseFrame(raw);
    this.frames.push(frame);
    if (frame.command === "CONNECT") {
      globalThis.queueMicrotask(() => this.receive(serializeFrame("CONNECTED", { version: "1.2", "heart-beat": "0,0" })));
    } else if (frame.command === "SUBSCRIBE") {
      this.subscriptions.set(frame.headers.id, frame.headers.destination);
    } else if (frame.command === "UNSUBSCRIBE") {
      this.subscriptions.delete(frame.headers.id);
    } else if (frame.command === "SEND" && frame.headers.destination.endsWith("/leave") && this.autoAcknowledgeLeave) {
      this.pendingCommands.push("leave");
      globalThis.queueMicrotask(() => {
        let revision = 100;
        while (this.pendingCommands.length) this.message("/user/queue/presence", snapshot(revision++));
      });
    } else if (frame.command === "SEND" && frame.headers.destination.startsWith("/app/rooms/")) {
      this.pendingCommands.push(frame.headers.destination.split("/").at(-1));
    } else if (frame.command === "DISCONNECT" && frame.headers.receipt) {
      globalThis.queueMicrotask(() => {
        this.receipt(frame.headers.receipt);
        this.close();
      });
    }
  }

  receive(raw) {
    if (this.readyState === FakeWebSocket.OPEN) this.onmessage?.({ data: raw, target: this });
  }

  receipt(id) {
    this.receive(serializeFrame("RECEIPT", { "receipt-id": id }));
  }

  message(destination, body) {
    const subscription = [...this.subscriptions]
      .find(([, subscribedDestination]) => subscribedDestination === destination)?.[0];
    assert.ok(subscription, `No active subscription for ${destination}`);
    if (destination === "/user/queue/presence") this.pendingCommands.shift();
    this.receive(serializeFrame("MESSAGE", {
      subscription,
      destination,
      "message-id": `message-${this.frames.length}`,
    }, typeof body === "string" ? body : JSON.stringify(body)));
  }

  close(code = 1000, reason = "closed") {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    globalThis.queueMicrotask(() => this.onclose?.({ code, reason, wasClean: true, target: this }));
  }

  terminate() { this.close(1006, "terminated"); }
}

function snapshot(revision, users = [{ userId: USER_ID, displayName: "An", avatarKey: null, status: "IDLE" }]) {
  return { type: "SNAPSHOT", roomId: ROOM_ID, revision, onlineCount: users.length, users };
}

function waitFor(predicate, message, timeoutMs = 800) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (predicate()) return resolve();
      if (Date.now() - started >= timeoutMs) return reject(new Error(`Timed out: ${message}`));
      setTimeout(poll, 5);
    };
    poll();
  });
}

function makePresence({ autoAcknowledgeLeave = true, token = async () => "access-token", ...options } = {}) {
  const sockets = [];
  const states = [];
  const presence = createRoomPresence({
    roomId: ROOM_ID,
    url: "ws://localhost:8080/ws-room",
    getToken: token,
    onChange: (state) => states.push(state),
    webSocketFactory: () => {
      const socket = new FakeWebSocket({ autoAcknowledgeLeave });
      sockets.push(socket);
      return socket;
    },
    ...options,
  });
  sessions.push(presence);
  return { presence, sockets, states, get state() { return states.at(-1); } };
}

async function waitForSocket(session, index = 0, timeoutMs = 800) {
  await waitFor(() => session.sockets.length > index, `socket ${index + 1} created`, timeoutMs);
  const socket = session.sockets[index];
  await waitFor(() => socket.frames.some((frame) => frame.command === "CONNECT"), "CONNECT sent");
  return socket;
}

async function establish(session, socket, firstRevision = 1, secondRevision = 2) {
  await waitFor(() => socket.frames.filter((frame) => frame.command === "SUBSCRIBE").length >= 2,
    "both user queue subscriptions sent");
  await waitFor(() => socket.frames.filter((frame) => frame.command === "SEND" && frame.headers.destination.endsWith("/join")).length === 1,
    "initial JOIN sent");
  socket.message("/user/queue/presence", snapshot(firstRevision));
  await waitFor(() => socket.frames.some((frame) => frame.command === "SUBSCRIBE" && frame.headers.destination === `/topic/rooms/${ROOM_ID}/presence`),
    "room topic subscription sent");
  await waitFor(() => socket.frames.filter((frame) => frame.command === "SEND" && frame.headers.destination.endsWith("/join")).length === 2,
    "resync JOIN sent");
  socket.message("/user/queue/presence", snapshot(secondRevision));
  await waitFor(() => session.state?.connection === "connected", "presence ready");
}

afterEach(async () => {
  for (const session of sessions.splice(0)) session.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 5));
});

describe("parsePresenceSnapshot", () => {
  it("accepts complete snapshots and rejects malformed, inconsistent, or duplicate users", () => {
    const valid = snapshot(0, [
      { userId: USER_ID, displayName: "An", avatarKey: null, status: "IDLE" },
      { userId: OTHER_USER_ID, displayName: "Bình", avatarKey: "avatar-2", status: "STUDYING" },
    ]);
    assert.deepEqual(parsePresenceSnapshot(JSON.stringify(valid)), valid);
    for (const invalid of [
      "{not json",
      { ...valid, roomId: "room-1" },
      { ...valid, revision: -1 },
      { ...valid, onlineCount: 3 },
      { ...valid, users: [{ ...valid.users[0], status: "PAUSED" }] },
      { ...valid, users: [{ ...valid.users[0], avatarKey: 42 }] },
      { ...valid, users: [valid.users[0], { ...valid.users[0], userId: USER_ID.toUpperCase() }] },
    ]) {
      assert.throws(() => parsePresenceSnapshot(typeof invalid === "string" ? invalid : JSON.stringify(invalid)));
    }
  });
});

describe("createRoomPresence STOMP session", () => {
  it("authenticates CONNECT and orders subscriptions and JOIN snapshots without broker receipts", async () => {
    const session = makePresence({ inviteCode: "ABC123" });
    session.presence.connect();
    session.presence.connect();
    const socket = await waitForSocket(session);

    assert.equal(socket.frames.filter((frame) => frame.command === "CONNECT").length, 1);
    assert.equal(socket.frames.find((frame) => frame.command === "CONNECT").headers.Authorization, "Bearer access-token");
    await waitFor(() => socket.frames.filter((frame) => frame.command === "SUBSCRIBE").length === 2, "two user subscriptions");
    assert.deepEqual(socket.frames.filter((frame) => frame.command === "SUBSCRIBE").map((frame) => frame.headers.destination).sort(),
      ["/user/queue/errors", "/user/queue/presence"]);
    const userSubscribes = socket.frames.filter((frame) => frame.command === "SUBSCRIBE");
    assert.ok(userSubscribes.every((frame) => !("receipt" in frame.headers)), "simple broker subscriptions do not request unsupported receipts");
    const firstJoinIndex = socket.frames.findIndex((frame) => frame.command === "SEND" && frame.headers.destination.endsWith("/join"));
    assert.ok(userSubscribes.every((frame) => socket.frames.indexOf(frame) < firstJoinIndex),
      "user subscriptions precede JOIN on the ordered STOMP connection");
    const firstJoin = socket.frames.find((frame) => frame.command === "SEND" && frame.headers.destination.endsWith("/join"));
    assert.equal(firstJoin.headers.destination, `/app/rooms/${ROOM_ID}/join`);
    assert.deepEqual(JSON.parse(firstJoin.body), { inviteCode: "ABC123" });
    assert.equal(socket.frames.some((frame) => frame.command === "SUBSCRIBE" && frame.headers.destination.startsWith("/topic/")), false,
      "room topic waits for first JOIN snapshot");

    socket.message("/user/queue/presence", snapshot(4));
    await waitFor(() => socket.frames.some((frame) => frame.command === "SUBSCRIBE" && frame.headers.destination.startsWith("/topic/")), "topic SUBSCRIBE");
    const topic = socket.frames.find((frame) => frame.command === "SUBSCRIBE" && frame.headers.destination.startsWith("/topic/"));
    const secondJoinIndex = socket.frames.findIndex((frame, index) => index > firstJoinIndex && frame.command === "SEND" && frame.headers.destination.endsWith("/join"));
    assert.ok(socket.frames.indexOf(topic) < secondJoinIndex, "topic SUBSCRIBE precedes the ordered resync JOIN");
    assert.equal("receipt" in topic.headers, false);
    socket.message("/user/queue/presence", snapshot(5));
    await waitFor(() => session.state.connection === "connected", "connected after second JOIN snapshot");
    assert.equal(socket.frames.filter((frame) => frame.command === "SEND" && frame.headers.destination.endsWith("/join")).length, 2);
  });

  it("replaces room state with full snapshots, discards stale revisions, and sends each desired status once", async () => {
    const session = makePresence({ userId: USER_ID });
    session.presence.setStatus("STUDYING");
    session.presence.connect();
    const socket = await waitForSocket(session);
    await establish(session, socket, 10, 11);

    const statusSends = () => socket.frames.filter((frame) => frame.command === "SEND" && frame.headers.destination.endsWith("/status"));
    assert.equal(statusSends().length, 1, "pre-connect status sent once after ready");
    assert.deepEqual(JSON.parse(statusSends()[0].body), { status: "STUDYING" });
    session.presence.setStatus("STUDYING");
    assert.equal(statusSends().length, 1, "repeated status does not publish again");

    const fullSnapshot = snapshot(12, [
      { userId: OTHER_USER_ID, displayName: "Bình", avatarKey: "avatar-2", status: "BREAK" },
      { userId: USER_ID, displayName: "An", avatarKey: null, status: "STUDYING" },
    ]);
    socket.message(`/topic/rooms/${ROOM_ID}/presence`, fullSnapshot);
    assert.deepEqual(session.state.snapshot, fullSnapshot, "snapshot replaces the complete user list");
    socket.message(`/topic/rooms/${ROOM_ID}/presence`, snapshot(9, []));
    assert.deepEqual(session.state.snapshot, fullSnapshot, "older room revision is ignored");

    session.presence.setStatus("BREAK");
    session.presence.setStatus("BREAK");
    assert.equal(statusSends().length, 2);
    assert.deepEqual(JSON.parse(statusSends()[1].body), { status: "BREAK" });
    socket.message(`/topic/rooms/${ROOM_ID}/presence`, snapshot(13, [
      { userId: USER_ID, displayName: "An", avatarKey: null, status: "IDLE" },
    ]));
    session.presence.setStatus("BREAK");
    assert.equal(statusSends().length, 3, "same status from the prior tab choice can be selected after another tab changes self status");
    assert.deepEqual(JSON.parse(statusSends()[2].body), { status: "BREAK" });
  });

  it("rejects invalid and duplicate-user snapshots as protocol errors without exposing payloads", async () => {
    const session = makePresence({ autoAcknowledgeLeave: false });
    session.presence.connect();
    const socket = await waitForSocket(session);
    await establish(session, socket);
    const secret = "private backend exception text";
    socket.message(`/topic/rooms/${ROOM_ID}/presence`, {
      ...snapshot(3),
      users: [snapshot(3).users[0], { ...snapshot(3).users[0] }],
      onlineCount: 2,
      debug: secret,
    });
    await waitFor(() => session.state.connection === "error", "protocol error state");
    assert.equal(session.state.errorCode, "PROTOCOL");
    assert.equal(session.state.error.includes(secret), false);
    assert.equal(socket.frames.some((frame) => frame.command === "DISCONNECT"), true);
  });

  it("reauthenticates and resubscribes once after reconnect, resets revisions, and replays status", async () => {
    const tokens = ["token-one", "token-two"];
    const session = makePresence({ token: async () => tokens.shift() });
    session.presence.setStatus("BREAK");
    session.presence.connect();
    const first = await waitForSocket(session);
    await establish(session, first, 98, 99);
    assert.equal(first.frames.find((frame) => frame.command === "CONNECT").headers.Authorization, "Bearer token-one");
    assert.equal(first.frames.filter((frame) => frame.command === "SUBSCRIBE").length, 3);

    first.close(1006, "network lost");
    await waitFor(() => session.state.connection === "reconnecting", "reconnecting state");
    const second = await waitForSocket(session, 1, 2500);
    assert.equal(second.frames.find((frame) => frame.command === "CONNECT").headers.Authorization, "Bearer token-two");
    await waitFor(() => second.frames.filter((frame) => frame.command === "SUBSCRIBE").length === 2, "fresh user subscriptions");
    assert.deepEqual(second.frames.filter((frame) => frame.command === "SUBSCRIBE").map((frame) => frame.headers.destination).sort(),
      ["/user/queue/errors", "/user/queue/presence"]);
    await establish(session, second, 1, 2);
    assert.equal(session.state.snapshot.revision, 2, "new connection accepts revisions below the previous connection");
    assert.equal(second.frames.filter((frame) => frame.command === "SUBSCRIBE").length, 3,
      "each destination subscribed once for the new connection");
    const statusSends = second.frames.filter((frame) => frame.command === "SEND" && frame.headers.destination.endsWith("/status"));
    assert.equal(statusSends.length, 1);
    assert.deepEqual(JSON.parse(statusSends[0].body), { status: "BREAK" });
  });

  it("cancels a pending token lookup on disconnect without opening a socket", async () => {
    let resolveToken;
    const session = makePresence({ token: () => new Promise((resolve) => { resolveToken = resolve; }) });
    session.presence.connect();
    await waitFor(() => typeof resolveToken === "function", "token lookup started");
    session.presence.disconnect();
    resolveToken("late-token");
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(session.sockets.length, 0);
    assert.equal(session.state.connection, "disconnected");
  });

  it("sends LEAVE, waits for its acknowledgement, unsubscribes, then deactivates STOMP", async () => {
    const session = makePresence({ autoAcknowledgeLeave: false });
    session.presence.connect();
    const socket = await waitForSocket(session);
    await establish(session, socket);
    session.presence.disconnect();

    await waitFor(() => socket.frames.some((frame) => frame.command === "SEND" && frame.headers.destination.endsWith("/leave")), "LEAVE sent");
    const leaveIndex = socket.frames.findIndex((frame) => frame.command === "SEND" && frame.headers.destination.endsWith("/leave"));
    assert.deepEqual(JSON.parse(socket.frames[leaveIndex].body), {});
    assert.equal(socket.frames.some((frame) => frame.command === "UNSUBSCRIBE"), false,
      "subscriptions stay until LEAVE is acknowledged");
    socket.message("/user/queue/presence", snapshot(3));
    await waitFor(() => socket.frames.some((frame) => frame.command === "DISCONNECT"), "STOMP deactivation");
    const unsubscribeIndices = socket.frames.map((frame, index) => frame.command === "UNSUBSCRIBE" ? index : -1).filter((index) => index >= 0);
    assert.equal(unsubscribeIndices.length, 3);
    assert.ok(unsubscribeIndices.every((index) => index > leaveIndex));
    assert.ok(socket.frames.findIndex((frame) => frame.command === "DISCONNECT") > unsubscribeIndices.at(-1));
    await waitFor(() => socket.readyState === FakeWebSocket.CLOSED, "transport closed");
  });

  it("ignores a pending status acknowledgement while leaving and cleans up only after the LEAVE acknowledgement", async () => {
    const session = makePresence({ autoAcknowledgeLeave: false });
    session.presence.connect();
    const socket = await waitForSocket(session);
    await establish(session, socket);
    session.presence.setStatus("STUDYING");
    assert.equal(socket.pendingCommands.at(-1), "status");

    session.presence.disconnect();
    await waitFor(() => socket.pendingCommands.at(-1) === "leave", "LEAVE queued after status");
    socket.message("/user/queue/presence", snapshot(3));
    assert.equal(socket.pendingCommands[0], "leave", "first ordered snapshot acknowledges pending status, not LEAVE");
    assert.equal(socket.frames.some((frame) => frame.command === "UNSUBSCRIBE"), false,
      "unsubscribing before LEAVE acknowledgement could retain server room membership");

    socket.message("/user/queue/presence", snapshot(4));
    await waitFor(() => socket.frames.some((frame) => frame.command === "DISCONNECT"), "LEAVE acknowledgement cleanup");
    assert.equal(socket.pendingCommands.length, 0);
    assert.equal(socket.frames.filter((frame) => frame.command === "UNSUBSCRIBE").length, 3);
  });

  it("maps business errors, hides raw details, and stops reconnect attempts", async () => {
    const session = makePresence();
    session.presence.connect();
    const socket = await waitForSocket(session);
    await establish(session, socket);
    socket.message("/user/queue/errors", { code: "ROOM_FULL", message: "secret backend stack" });
    await waitFor(() => session.state.connection === "error", "business error state");
    assert.equal(session.state.errorCode, "ROOM_FULL");
    assert.match(session.state.error, /đầy/i);
    assert.equal(session.state.error.includes("secret backend stack"), false);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.equal(session.sockets.length, 1, "business failures do not start another connection");
  });

  it("hides STOMP protocol error details and stops reconnect attempts", async () => {
    const session = makePresence();
    session.presence.connect();
    const socket = await waitForSocket(session);
    await establish(session, socket);
    socket.receive(serializeFrame("ERROR", { message: "secret protocol details" }, "secret broker traceback"));
    await waitFor(() => session.state.connection === "error", "protocol error state");
    assert.equal(session.state.errorCode, "PROTOCOL");
    assert.equal(session.state.error.includes("secret"), false);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.equal(session.sockets.length, 1, "protocol failures do not start another connection");
  });

  it("does not reconnect after disconnect while the transport is dropping", async () => {
    const session = makePresence({ autoAcknowledgeLeave: false });
    session.presence.connect();
    const socket = await waitForSocket(session);
    await establish(session, socket);
    session.presence.disconnect();
    await waitFor(() => socket.frames.some((frame) => frame.command === "SEND" && frame.headers.destination.endsWith("/leave")), "LEAVE sent");
    socket.close(1006, "network dropped during leave");
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.equal(session.sockets.length, 1, "stopped sessions do not schedule reconnects after transport close");
    assert.equal(session.state.connection, "disconnected");
  });
});
