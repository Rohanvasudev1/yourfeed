import { afterEach, describe, expect, it, vi } from "vitest";
import { apiSession } from "./session";
import { apiTopicSearch } from "./topicSearch";

function serverSays(body: unknown) {
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify(body)));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const VIDEO = { id: "yt-1", title: "T", honestTitle: "T", channel: "C", topic: "Chess & Go", minutes: 3 };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the topic search API client", () => {
  it("asks for each topic and drops malformed videos", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetch = serverSays({ success: true, data: { videos: [VIDEO, { id: 3 }], paused: true }, error: null });
    expect(await apiTopicSearch(apiSession())(["Chess & Go", "Jazz"])).toEqual({ videos: [VIDEO], paused: true });
    expect(fetch.mock.calls[0][0]).toBe("/api/catalog/topics?topic=Chess%20%26%20Go&topic=Jazz");
  });

  it("rejects an answer that isn't topic videos", async () => {
    serverSays({ success: true, data: { videos: "none" }, error: null });
    await expect(apiTopicSearch(apiSession())(["Jazz"])).rejects.toThrow();
  });
});
