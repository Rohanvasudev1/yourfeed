import { describe, expect, it } from "vitest";
import { decodeShare, encodeShare, readShareFragment, SHARE_LIMITS, shareUrl, type Share } from "./share";

const SHARE: Share = {
  title: "Everything",
  videos: ["demo-1", "demo-2"],
  message: "Watch these tonight 🍿",
  notes: { "demo-1": "Loops and tools — ünïcode" },
};

const encoded = (share: Share): string => {
  const result = encodeShare(share);
  if (!result.ok) throw new Error(result.problem);
  return result.encoded;
};

/** Base64url of any text, for building hand-made bad links. */
const raw = (json: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

describe("the share codec", () => {
  it("round-trips a share, notes and all", () => {
    expect(decodeShare(encoded(SHARE))).toEqual(SHARE);
  });

  it("round-trips a share with only a title and videos", () => {
    const bare = { title: "Learn", videos: ["demo-3"] };
    expect(decodeShare(encoded(bare))).toEqual(bare);
  });

  it("encodes into characters that are safe in a URL fragment", () => {
    expect(encoded(SHARE)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("builds and reads back a #share= link", () => {
    const url = shareUrl("https://yourfeed.example/", encoded(SHARE));
    expect(url).toMatch(/^https:\/\/yourfeed\.example\/#share=[A-Za-z0-9_-]+$/);
    const fragment = readShareFragment(new URL(url).hash);
    expect(fragment && decodeShare(fragment)).toEqual(SHARE);
  });

  it("ignores fragments that aren't share links", () => {
    expect(readShareFragment("")).toBeNull();
    expect(readShareFragment("#notes")).toBeNull();
    expect(readShareFragment("#share=")).toBeNull();
  });
});

describe("encoding a share over the limits", () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `demo-${i}`);

  it.each([
    ["no videos", { title: "Feed", videos: [] }, "Pick at least one video to share."],
    ["too many videos", { title: "Feed", videos: ids(SHARE_LIMITS.videos + 1) }, "Share 50 videos at most. Untick some first."],
    ["a long title", { title: "x".repeat(SHARE_LIMITS.title + 1), videos: ids(1) }, "Feed names in a link are 60 characters at most."],
    ["a long message", { title: "Feed", videos: ids(1), message: "x".repeat(SHARE_LIMITS.message + 1) }, "Messages are 280 characters at most."],
    [
      "too many notes",
      { title: "Feed", videos: ids(2), notes: { "demo-0": "x".repeat(1500), "demo-1": "y".repeat(501) } },
      "Your notes are over 2,000 characters. Untick some videos or leave the notes out.",
    ],
  ])("refuses %s", (_, share, problem) => {
    expect(encodeShare(share)).toEqual({ ok: false, problem });
  });

  it("accepts a share right at the limits", () => {
    const share = {
      title: "x".repeat(SHARE_LIMITS.title),
      videos: ids(SHARE_LIMITS.videos),
      message: "m".repeat(SHARE_LIMITS.message),
      notes: { "demo-0": "n".repeat(SHARE_LIMITS.notes) },
    };
    expect(decodeShare(encoded(share))).toEqual(share);
  });
});

describe("decoding an untrusted link", () => {
  it.each([
    ["characters outside base64url", "not base64!"],
    ["base64 that isn't UTF-8", "_-_-"],
    ["text that isn't JSON", raw("hello")],
    ["JSON of the wrong shape", raw(JSON.stringify({ hello: "world" }))],
    ["an unknown version", raw(JSON.stringify({ v: 2, title: "Feed", videos: ["demo-1"] }))],
    ["unknown fields", raw(JSON.stringify({ v: 1, title: "Feed", videos: ["demo-1"], extra: true }))],
    ["no videos", raw(JSON.stringify({ v: 1, title: "Feed", videos: [] }))],
    ["a video twice", raw(JSON.stringify({ v: 1, title: "Feed", videos: ["demo-1", "demo-1"] }))],
    ["notes on a video it doesn't share", raw(JSON.stringify({ v: 1, title: "Feed", videos: ["demo-1"], notes: { "demo-2": "hi" } }))],
    ["an empty title", raw(JSON.stringify({ v: 1, title: " ", videos: ["demo-1"] }))],
    ["too many videos", raw(JSON.stringify({ v: 1, title: "Feed", videos: Array.from({ length: 51 }, (_, i) => `v${i}`) }))],
    ["oversized notes", raw(JSON.stringify({ v: 1, title: "Feed", videos: ["demo-1"], notes: { "demo-1": "x".repeat(2001) } }))],
    ["a link far longer than any real share", "A".repeat(100_000)],
  ])("rejects %s", (_, fragment) => {
    expect(decodeShare(fragment)).toBeNull();
  });
});
