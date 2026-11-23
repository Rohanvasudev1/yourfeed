import { afterEach, describe, expect, it, vi } from "vitest";
import { apiSession } from "./session";
import { apiSharing } from "./sharing";

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
const refused = (status: number, error: string): Reply => ({ status, body: { success: false, data: null, error } });

const VIDEO = { id: "yt-1", title: "T", honestTitle: "T", channel: "C", topic: "Football", minutes: 3 };
const SENT = { id: 4, from: "maya.k", title: "Derby", videos: ["yt-1"], message: "", notes: {}, sentAt: "2026-11-23T00:00:00Z" };
const SHARE = { title: "Derby", videos: ["yt-1"] };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the sharing API client", () => {
  it("looks videos up by id and drops malformed ones", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetch = serverSays(ok([VIDEO, { id: 3 }]));
    expect(await apiSharing(apiSession()).lookupVideos(["yt-1", "a b"])).toEqual([VIDEO]);
    expect(fetch.mock.calls[0][0]).toBe("/api/videos?ids=yt-1,a%20b");
  });

  it("sends a share and gives back the username as the server keeps it", async () => {
    const fetch = serverSays(ok({ to: "maya.k" }));
    expect(await apiSharing(apiSession()).send("Maya.K", SHARE)).toEqual({ ok: true, to: "maya.k" });
    const [path, init] = fetch.mock.calls[0];
    expect(path).toBe("/api/shares");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ to: "Maya.K", share: SHARE });
  });

  it.each([404, 409, 429])("turns a %i refusal into the server's words", async (status) => {
    serverSays(refused(status, "No one has that username."));
    expect(await apiSharing(apiSession()).send("x.y.z", SHARE)).toEqual({ ok: false, problem: "No one has that username." });
  });

  it("rejects when the server fails", async () => {
    serverSays(refused(500, "Boom"));
    await expect(apiSharing(apiSession()).send("maya.k", SHARE)).rejects.toThrow("Boom");
  });

  it("reads the inbox after a cursor, keeping only shares within the limits", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetch = serverSays(ok([SENT, { ...SENT, id: 5, title: "x".repeat(61) }]));
    expect(await apiSharing(apiSession()).inbox(3)).toEqual([{ ...SENT, sentAt: Date.UTC(2026, 10, 23) }]);
    expect(fetch.mock.calls[0][0]).toBe("/api/inbox?after=3");
  });

  it("refuses an inbox answer that isn't a list", async () => {
    serverSays(ok({ shares: [] }));
    await expect(apiSharing(apiSession()).inbox(0)).rejects.toThrow("The server's answer wasn't a list.");
  });
});
