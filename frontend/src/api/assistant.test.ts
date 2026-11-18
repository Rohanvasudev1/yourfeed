import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeedContext } from "../domain/assistant";
import { requestAssistant } from "./assistant";

const CONTEXT: FeedContext = {
  kind: "topics",
  name: "Learn",
  topics: ["AI"],
  channels: [],
  muted: [],
  length: [10, 60],
  session: [30, 90],
  pinned: [],
  upNext: [],
};

const answer = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

afterEach(() => vi.unstubAllGlobals());

describe("the assistant API client", () => {
  it("posts the request and returns the checked result", async () => {
    const data = { actions: [{ type: "set_topics", add: ["Cooking"], remove: [] }], reply: null, answeredBy: "rules", notice: null };
    const fetch = answer(200, { success: true, data, error: null });
    vi.stubGlobal("fetch", fetch);

    expect(await requestAssistant("add cooking", "edit", CONTEXT)).toEqual(data);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/assistant/request");
    expect(JSON.parse(init.body as string)).toEqual({ text: "add cooking", mode: "edit", context: CONTEXT });
  });

  it("passes on the server's error", async () => {
    vi.stubGlobal("fetch", answer(422, { success: false, data: null, error: "text: too long" }));
    await expect(requestAssistant("x", "edit", CONTEXT)).rejects.toThrow("text: too long");
  });

  it("rejects an answer that breaks the contract", async () => {
    const data = { actions: [{ type: "turn_on_filter" }], answeredBy: "rules" };
    vi.stubGlobal("fetch", answer(200, { success: true, data, error: null }));
    await expect(requestAssistant("x", "edit", CONTEXT)).rejects.toThrow("didn't match the contract");
  });

  it("says what the server answered when the body isn't JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 502 })));
    await expect(requestAssistant("x", "edit", CONTEXT)).rejects.toThrow("The server answered 502.");
  });
});
