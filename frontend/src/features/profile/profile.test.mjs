import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import { URL } from "node:url";
import ts from "typescript";
import { QueryClient, QueryObserver, MutationObserver } from "@tanstack/react-query";

const reactQueryUrl = import.meta.resolve("@tanstack/react-query");
const profileSource = fs.readFileSync(new URL("./profile.ts", import.meta.url), "utf8");
const profileCode = ts.transpileModule(profileSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
}).outputText;
const profileUrl = `data:text/javascript;base64,${Buffer.from(profileCode).toString("base64")}`;
const profile = await import(profileUrl);

const sessionStub = `
export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; this.name = "ApiError"; }
}
export async function apiRequest(path, init, expectedUserId) {
  if (!globalThis.__PROFILE_TEST_API_REQUEST__) throw new Error("Unexpected apiRequest call: " + path);
  return globalThis.__PROFILE_TEST_API_REQUEST__(path, init, expectedUserId);
}
export function getSession() { return globalThis.__PROFILE_TEST_SESSION__; }
export function getSessionGeneration() { return globalThis.__PROFILE_TEST_GENERATION__; }
`;
const sessionUrl = `data:text/javascript;base64,${Buffer.from(sessionStub).toString("base64")}`;
let queryModuleCounter = 0;

async function loadProfileQueries() {
  const source = fs.readFileSync(new URL("./profileQueries.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
  }).outputText
    .replace(/(from\s+["'])@tanstack\/react-query(["'])/g, `$1${reactQueryUrl}$2`)
    .replace(/(from\s+["'])\.\/profile(["'])/g, `$1${profileUrl}$2`)
    .replace(/(from\s+["'])\.\.\/\.\.\/auth\/session(["'])/g, `$1${sessionUrl}$2`);
  const uniqueCode = `${code}\n// instance:${++queryModuleCounter}`;
  return import(`data:text/javascript;base64,${Buffer.from(uniqueCode).toString("base64")}`);
}

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const EMPTY_PROFILE = {
  id: USER_ID,
  email: "user@example.test",
  displayName: "Study buddy",
  bio: null,
  avatarKey: null,
  role: "USER",
  totalXp: 0,
  level: 1,
  currentStreak: 0,
  longestStreak: 0,
  totalStudyHours: 0,
  badgesCount: 0,
};

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe("profile model", () => {
  it("parses an empty backend profile and preserves nullable profile fields", () => {
    assert.deepEqual(profile.parseProfile(EMPTY_PROFILE), EMPTY_PROFILE);
    assert.deepEqual(profile.parseProfile({ ...EMPTY_PROFILE, bio: "  Quiet focus  ", avatarKey: "avatar-4" }), {
      ...EMPTY_PROFILE,
      bio: "  Quiet focus  ",
      avatarKey: "avatar-4",
    });
  });

  it("rejects non-profile values and malformed required fields", () => {
    for (const value of [null, undefined, "profile", 3, []]) {
      assert.throws(() => profile.parseProfile(value));
    }
    for (const invalid of [
      { ...EMPTY_PROFILE, displayName: 7 },
      { ...EMPTY_PROFILE, totalXp: "0" },
      { ...EMPTY_PROFILE, bio: 12 },
    ]) {
      assert.throws(() => profile.parseProfile(invalid));
    }
  });

  it("validates display name, bio, and avatar limits while accepting a valid update", () => {
    const valid = { displayName: "Study buddy", bio: "Ready to focus", avatarKey: "avatar-1" };
    assert.deepEqual(profile.validateProfile(valid), {});

    const errors = profile.validateProfile({
      displayName: " ",
      bio: "b".repeat(201),
      avatarKey: "a".repeat(51),
    });
    for (const field of ["displayName", "bio", "avatarKey"]) {
      assert.equal(typeof errors[field], "string", `${field} should have a validation message`);
      assert.notEqual(errors[field].length, 0);
    }
    assert.equal(profile.validateProfile({ ...valid, displayName: "x" }).displayName !== undefined, true);
    assert.equal(profile.validateProfile({ ...valid, displayName: "x".repeat(51) }).displayName !== undefined, true);
  });

  it("builds a complete PUT update, trimming values and clearing blank optional fields", () => {
    const update = profile.profileUpdate({ displayName: "  Alex  ", bio: "  about me  ", avatarKey: " avatar-3 " });
    assert.deepEqual(update, { displayName: "Alex", bio: "about me", avatarKey: "avatar-3" });
    assert.deepEqual(profile.profileUpdate({ displayName: " Name ", bio: "  ", avatarKey: "" }), {
      displayName: "Name",
      bio: null,
      avatarKey: null,
    });
    assert.deepEqual(Object.keys(update).sort(), ["avatarKey", "bio", "displayName"]);
  });

  it("exposes exactly eight stable avatar choices and rejects unknown keys", () => {
    assert.deepEqual(profile.avatarChoices.map(({ key }) => key), Array.from({ length: 8 }, (_, i) => `avatar-${i + 1}`));
    assert.ok(profile.avatarChoices.every(({ label }) => typeof label === "string" && label.length > 0));
    assert.equal(profile.getAvatarKey("avatar-1"), "avatar-1");
    assert.equal(profile.getAvatarKey("avatar-8"), "avatar-8");
    for (const value of [null, undefined, "", "avatar-0", "avatar-9", "custom-avatar"]) {
      assert.equal(profile.getAvatarKey(value), null);
    }
  });

  it("reports XP progress at level boundaries", () => {
    assert.deepEqual(profile.xpProgress(0, 1), {
      xpIntoLevel: 0,
      xpRequiredForLevel: 100,
      progress: 0,
      remainingXp: 100,
    });
    assert.deepEqual(profile.xpProgress(99, 1), {
      xpIntoLevel: 99,
      xpRequiredForLevel: 100,
      progress: 99,
      remainingXp: 1,
    });
    assert.deepEqual(profile.xpProgress(100, 2), {
      xpIntoLevel: 0,
      xpRequiredForLevel: 300,
      progress: 0,
      remainingXp: 300,
    });
    assert.deepEqual(profile.xpProgress(400, 3), {
      xpIntoLevel: 0,
      xpRequiredForLevel: 500,
      progress: 0,
      remainingXp: 500,
    });
  });
});

describe("profile queries and mutations", () => {
  beforeEach(() => {
    globalThis.__PROFILE_TEST_SESSION__ = { status: "authenticated", user: { id: USER_ID } };
    globalThis.__PROFILE_TEST_GENERATION__ = 1;
    globalThis.__PROFILE_TEST_API_REQUEST__ = null;
  });

  it("exposes loading then success through QueryObserver and requests the authenticated user profile", async () => {
    const { profileQuery } = await loadProfileQueries();
    const queryClient = createQueryClient();
    const observer = new QueryObserver(queryClient, profileQuery(USER_ID));
    const requestStarted = deferred();
    const response = deferred();
    let captured;
    globalThis.__PROFILE_TEST_API_REQUEST__ = (path, init, expectedUserId) => {
      captured = { path, init, expectedUserId };
      requestStarted.resolve();
      return response.promise;
    };

    const success = new Promise((resolve) => {
      let unsubscribe = () => {};
      unsubscribe = observer.subscribe((result) => {
        if (result.isSuccess) {
          unsubscribe();
          resolve(result);
        }
      });
    });
    assert.equal(observer.getCurrentResult().isPending, true);
    await requestStarted.promise;
    assert.equal(captured.expectedUserId, USER_ID);
    assert.ok(captured.init.signal instanceof globalThis.AbortSignal);
    response.resolve(jsonResponse(EMPTY_PROFILE));
    const result = await success;
    assert.equal(result.data.id, USER_ID);
    assert.deepEqual(queryClient.getQueryData(profileQuery(USER_ID).queryKey), EMPTY_PROFILE);
    observer.destroy();
    queryClient.clear();
  });

  it("exposes request errors through QueryObserver", async () => {
    const { profileQuery } = await loadProfileQueries();
    const queryClient = createQueryClient();
    globalThis.__PROFILE_TEST_API_REQUEST__ = async () => { throw new Error("profile unavailable"); };
    const observer = new QueryObserver(queryClient, profileQuery(USER_ID));
    const errorResult = new Promise((resolve) => {
      let unsubscribe = () => {};
      unsubscribe = observer.subscribe((result) => {
        if (result.isError) {
          unsubscribe();
          resolve(result);
        }
      });
    });
    const result = await errorResult;
    assert.equal(result.error.message, "profile unavailable");
    assert.equal(queryClient.getQueryData(profileQuery(USER_ID).queryKey), undefined);
    observer.destroy();
    queryClient.clear();
  });

  it("rejects a response belonging to a different account", async () => {
    const { profileQuery } = await loadProfileQueries();
    globalThis.__PROFILE_TEST_API_REQUEST__ = async () => jsonResponse({ ...EMPTY_PROFILE, id: OTHER_USER_ID });
    await assert.rejects(profileQuery(USER_ID).queryFn({ signal: undefined }));
  });

  it("keeps cache keys isolated per account", async () => {
    const { profileQuery } = await loadProfileQueries();
    const queryClient = createQueryClient();
    const otherProfile = { ...EMPTY_PROFILE, id: OTHER_USER_ID, email: "other@example.test" };
    globalThis.__PROFILE_TEST_API_REQUEST__ = async (_path, _init, expectedUserId) =>
      jsonResponse(expectedUserId === USER_ID ? EMPTY_PROFILE : otherProfile);

    await queryClient.fetchQuery(profileQuery(USER_ID));
    globalThis.__PROFILE_TEST_SESSION__ = { status: "authenticated", user: { id: OTHER_USER_ID } };
    await queryClient.fetchQuery(profileQuery(OTHER_USER_ID));
    assert.notDeepEqual(profileQuery(USER_ID).queryKey, profileQuery(OTHER_USER_ID).queryKey);
    assert.deepEqual(queryClient.getQueryData(profileQuery(USER_ID).queryKey), EMPTY_PROFILE);
    assert.deepEqual(queryClient.getQueryData(profileQuery(OTHER_USER_ID).queryKey), otherProfile);
    queryClient.clear();
  });

  it("caches a successful save under its user key", async () => {
    const { profileQuery, profileMutation } = await loadProfileQueries();
    const queryClient = createQueryClient();
    const updated = { ...EMPTY_PROFILE, displayName: "Alex", bio: null, avatarKey: "avatar-2" };
    await queryClient.setQueryData(profileQuery(USER_ID).queryKey, EMPTY_PROFILE);
    let captured;
    globalThis.__PROFILE_TEST_API_REQUEST__ = async (path, init, expectedUserId) => {
      captured = { path, init, expectedUserId };
      return jsonResponse(updated);
    };

    const observer = new MutationObserver(queryClient, profileMutation(USER_ID, 1));
    const result = await observer.mutate({ displayName: "Alex", bio: null, avatarKey: "avatar-2" });
    assert.equal(result.displayName, "Alex");
    assert.equal(captured.expectedUserId, USER_ID);
    assert.equal(captured.init.method, "PUT");
    assert.deepEqual(JSON.parse(captured.init.body), { displayName: "Alex", bio: null, avatarKey: "avatar-2" });
    assert.deepEqual(queryClient.getQueryData(profileQuery(USER_ID).queryKey), updated);
    observer.reset();
    queryClient.clear();
  });

  it("preserves the last cached profile when a save fails", async () => {
    const { profileQuery, profileMutation } = await loadProfileQueries();
    const queryClient = createQueryClient();
    await queryClient.setQueryData(profileQuery(USER_ID).queryKey, EMPTY_PROFILE);
    globalThis.__PROFILE_TEST_API_REQUEST__ = async () => { throw new Error("save failed"); };
    const observer = new MutationObserver(queryClient, profileMutation(USER_ID, 1));

    await assert.rejects(observer.mutate({ displayName: "Alex", bio: null, avatarKey: null }), /save failed/);
    assert.deepEqual(queryClient.getQueryData(profileQuery(USER_ID).queryKey), EMPTY_PROFILE);
    observer.reset();
    queryClient.clear();
  });

  it("does not cache a late save after the account generation changes", async () => {
    const { profileQuery, profileMutation } = await loadProfileQueries();
    const queryClient = createQueryClient();
    const response = deferred();
    const started = deferred();
    globalThis.__PROFILE_TEST_API_REQUEST__ = () => {
      started.resolve();
      return response.promise;
    };
    const observer = new MutationObserver(queryClient, profileMutation(USER_ID, 1));
    const pending = observer.mutate({ displayName: "Alex", bio: null, avatarKey: null })
      .then((value) => ({ value }), (error) => ({ error }));

    await started.promise;
    globalThis.__PROFILE_TEST_SESSION__ = { status: "authenticated", user: { id: OTHER_USER_ID } };
    globalThis.__PROFILE_TEST_GENERATION__ = 2;
    response.resolve(jsonResponse({ ...EMPTY_PROFILE, displayName: "Alex" }));
    const outcome = await pending;

    assert.ok(outcome.error instanceof Error, "save should reject after switching accounts");
    assert.equal(queryClient.getQueryData(profileQuery(USER_ID).queryKey), undefined);
    assert.equal(queryClient.getQueryData(profileQuery(OTHER_USER_ID).queryKey), undefined);
    observer.reset();
    queryClient.clear();
  });
});
