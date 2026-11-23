import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeedContext } from "../domain/assistant";
import { answerQuestion, assistantInfo, requestAssistant } from "./assistant";

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
  firstReason: null,
  explore: [],
};

const answer = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

const FOLLOW_UP = { request: "shorter videos", summary: "videos 1–15 min" };

afterEach(() => vi.unstubAllGlobals());

describe("the assistant API client", () => {
  it("posts the request and returns the checked result", async () => {
    const data = { actions: [{ type: "set_topics", add: ["Cooking"], remove: [] }], reply: null, answeredBy: "rules", notice: null };
    const fetch = answer(200, { success: true, data, error: null });
    vi.stubGlobal("fetch", fetch);

    expect(await requestAssistant("add cooking", "edit", CONTEXT, [FOLLOW_UP])).toEqual(data);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/assistant/request");
    expect(JSON.parse(init.body as string)).toEqual({ text: "add cooking", mode: "edit", context: CONTEXT, followUps: [FOLLOW_UP] });
  });

  it("passes on the server's error", async () => {
    vi.stubGlobal("fetch", answer(422, { success: false, data: null, error: "text: too long" }));
    await expect(requestAssistant("x", "edit", CONTEXT, [])).rejects.toThrow("text: too long");
  });

  it("rejects an answer that breaks the contract", async () => {
    const data = { actions: [{ type: "turn_on_filter" }], answeredBy: "rules" };
    vi.stubGlobal("fetch", answer(200, { success: true, data, error: null }));
    await expect(requestAssistant("x", "edit", CONTEXT, [])).rejects.toThrow("didn't match the contract");
  });

  it("says what the server answered when the body isn't JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 502 })));
    await expect(requestAssistant("x", "edit", CONTEXT, [])).rejects.toThrow("The server answered 502.");
  });
});

describe("the note answer API client", () => {
  it("posts the video id and question and returns the checked answer", async () => {
    const data = { answer: "An agent runs in a loop.", answeredBy: "rules" };
    const fetch = answer(200, { success: true, data, error: null });
    vi.stubGlobal("fetch", fetch);

    expect(await answerQuestion("demo-0", "What is an agent?")).toEqual(data);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/assistant/answer");
    expect(JSON.parse(init.body as string)).toEqual({ videoId: "demo-0", question: "What is an agent?" });
  });

  it("rejects an empty answer", async () => {
    vi.stubGlobal("fetch", answer(200, { success: true, data: { answer: "", answeredBy: "rules" }, error: null }));
    await expect(answerQuestion("demo-0", "Why?")).rejects.toThrow("didn't match the contract");
  });

  it("gets which assistant answers", async () => {
    const data = { answeredBy: "model", provider: "Groq", model: "gpt-oss-20b" };
    const fetch = answer(200, { success: true, data, error: null });
    vi.stubGlobal("fetch", fetch);

    expect(await assistantInfo()).toEqual(data);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/assistant/info");
    expect(init.method).toBe("GET");
  });

  it("rejects info naming a model with no provider", async () => {
    vi.stubGlobal("fetch", answer(200, { success: true, data: { answeredBy: "model", provider: null, model: "x" }, error: null }));
    await expect(assistantInfo()).rejects.toThrow("didn't match the contract");
  });
});
