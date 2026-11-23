import { afterEach, describe, expect, it, vi } from "vitest";
import { apiAccount } from "./account";

type Reply = Readonly<{ status?: number; body: unknown }>;

/** A fetch that answers each call in turn and records what was sent. */
function serverSays(...replies: Reply[]) {
  const queue = [...replies];
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => {
    const next = queue.shift() ?? { status: 500, body: null };
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const ok = (data: unknown): Reply => ({ body: { success: true, data, error: null } });
const SIGNED_IN = ok({ signInAvailable: true, signedIn: true, csrfToken: "csrf-123" });
const SIGNED_OUT = ok({ signInAvailable: true, signedIn: false, csrfToken: null });

const headersOf = (fetch: ReturnType<typeof serverSays>, call: number) => (fetch.mock.calls[call][1]?.headers ?? {}) as Record<string, string>;

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("the account API client", () => {
  it("reads the three states", async () => {
    serverSays(ok({ signInAvailable: false, signedIn: false, csrfToken: null }), SIGNED_OUT, SIGNED_IN);
    const account = apiAccount();
    expect(await account.status()).toEqual({ kind: "unavailable" });
    expect(await account.status()).toEqual({ kind: "signedOut", signInFailed: false });
    expect(await account.status()).toEqual({ kind: "signedIn" });
  });

  it("sends the session's CSRF token with sign out and Delete my data", async () => {
    const fetch = serverSays(SIGNED_IN, ok({ signInAvailable: true, signedIn: false, csrfToken: null }), SIGNED_IN, ok({ revoked: true }));
    const account = apiAccount();
    await account.status();
    await account.signOut();
    expect(fetch.mock.calls[1][0]).toBe("/api/auth/logout");
    expect(fetch.mock.calls[1][1]?.method).toBe("POST");
    expect(headersOf(fetch, 1)).toEqual({ "X-CSRF-Token": "csrf-123" });

    await account.status();
    expect(await account.deleteData()).toEqual({ revoked: true });
    expect(fetch.mock.calls[3][0]).toBe("/api/account");
    expect(fetch.mock.calls[3][1]?.method).toBe("DELETE");
    expect(headersOf(fetch, 3)).toEqual({ "X-CSRF-Token": "csrf-123" });
  });

  it("forgets the token once signed out", async () => {
    const fetch = serverSays(SIGNED_IN, ok({}), { status: 401, body: { success: false, data: null, error: "Sign in with Google first." } });
    const account = apiAccount();
    await account.status();
    await account.signOut();
    await expect(account.signOut()).rejects.toThrow("Sign in with Google first.");
    expect(headersOf(fetch, 2)).toEqual({});
  });

  it("says sign-in failed when the page opened with the marker, every time it's asked, and takes the marker out of the address", async () => {
    window.history.replaceState(null, "", "/?signin=failed&x=1");
    serverSays(SIGNED_OUT, SIGNED_OUT, SIGNED_OUT);
    const account = apiAccount();
    expect(window.location.search).toBe("?x=1");
    expect(await account.status()).toEqual({ kind: "signedOut", signInFailed: true });
    expect(await account.status()).toEqual({ kind: "signedOut", signInFailed: true });
    expect(await apiAccount().status()).toEqual({ kind: "signedOut", signInFailed: false });
  });

  it("rejects answers that don't match the contract", async () => {
    serverSays(ok({ signInAvailable: "yes" }), { status: 502, body: "nope" });
    const account = apiAccount();
    await expect(account.status()).rejects.toThrow();
    await expect(account.status()).rejects.toThrow("The server answered 502.");
  });

  it("remembers in the browser whether it's signed in, and forgets on sign out", async () => {
    serverSays(SIGNED_IN, ok({}), SIGNED_IN, ok({ revoked: true }), SIGNED_IN, SIGNED_OUT);
    expect(apiAccount().expectsSignedIn()).toBe(false);
    const account = apiAccount();
    await account.status();
    expect(apiAccount().expectsSignedIn()).toBe(true);
    await account.signOut();
    expect(apiAccount().expectsSignedIn()).toBe(false);
    await account.status();
    await account.deleteData();
    expect(apiAccount().expectsSignedIn()).toBe(false);
    await account.status();
    await account.status();
    expect(apiAccount().expectsSignedIn()).toBe(false);
  });

  it("works without remembering when browser storage is blocked", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    serverSays(SIGNED_IN);
    const account = apiAccount();
    expect(account.expectsSignedIn()).toBe(false);
    expect(await account.status()).toEqual({ kind: "signedIn" });
  });

  it("signs in by leaving for the backend's login route", () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign, href: window.location.href });
    apiAccount().signIn();
    expect(assign).toHaveBeenCalledWith("/api/auth/login");
  });
});
