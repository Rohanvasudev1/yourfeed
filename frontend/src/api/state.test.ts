import { afterEach, describe, expect, it, vi } from "vitest";
import { apiAccount } from "./account";
import { apiSession } from "./session";
import { apiServerState } from "./state";

type Reply = Readonly<{ status?: number; body: unknown }>;

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
const DOC = { version: 4, state: { feeds: [] } };

afterEach(() => vi.unstubAllGlobals());

describe("the state API client", () => {
  it("loads the saved document, or null before the first save", async () => {
    const fetch = serverSays(ok(DOC), ok(null));
    const state = apiServerState(apiSession());
    expect(await state.load()).toEqual(DOC);
    expect(await state.load()).toBeNull();
    expect(fetch.mock.calls[0][0]).toBe("/api/state");
  });

  it("saves with a PUT that carries the session's CSRF token from the account client", async () => {
    const fetch = serverSays(SIGNED_IN, ok({ version: 4 }));
    const session = apiSession();
    await apiAccount(session).status();
    await apiServerState(session).save(DOC);
    const [url, init] = fetch.mock.calls[1];
    expect(url).toBe("/api/state");
    expect(init?.method).toBe("PUT");
    expect(init?.headers).toEqual({ "X-CSRF-Token": "csrf-123", "Content-Type": "application/json" });
    expect(JSON.parse(init?.body as string)).toEqual(DOC);
  });

  it("says why a save was refused", async () => {
    serverSays({ status: 413, body: { success: false, data: null, error: "Your saved state is too large to keep." } });
    await expect(apiServerState(apiSession()).save(DOC)).rejects.toThrow("Your saved state is too large to keep.");
  });
});
