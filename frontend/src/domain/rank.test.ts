import { describe, expect, it } from "vitest";
import { BEHAVIOUR_DAYS, type Signal, type SignalKind } from "./behaviour";
import { makeFeed } from "./feed";
import { rank, reasonText } from "./rank";
import { MS_PER_HOUR } from "./time";
import type { Feed, Video } from "./types";

let next = 0;
const video = (o: Partial<Video> = {}): Video => ({
  id: `v${next++}`,
  title: "t",
  honestTitle: "t",
  channel: "Chan",
  channelSubscribers: 500_000,
  topic: "AI",
  minutes: 10,
  views: 1000,
  ageHours: 24 * 30,
  clickbait: false,
  live: false,
  newsCategory: null,
  ...o,
});

const NOW = 1_800_000_000_000;
const DAY_MS = 24 * MS_PER_HOUR;
const signal = (kind: SignalKind, v: Video, daysAgo = 1): Signal => ({ kind, video: v, at: NOW - daysAgo * DAY_MS });

const everything = makeFeed({ name: "Everything", kind: "home" });
const ids = (ranked: ReturnType<typeof rank>) => ranked.map((r) => r.video.id);
const reasons = (ranked: ReturnType<typeof rank>) => ranked.map((r) => reasonText(r.reason));

describe("rank", () => {
  it("never uses views: varying only views gives the same order and reasons", () => {
    const catalog = Array.from({ length: 30 }, (_, i) =>
      video({ topic: ["AI", "Cooking", "Tennis"][i % 3], channel: `C${i % 5}`, ageHours: (i * 37) % 900 }),
    );
    const behaviour = [signal("finished", catalog[0]), signal("removed", catalog[4]), signal("pinned", catalog[7])];
    const feed = makeFeed({ topics: ["AI", "Cooking"], seed: 7 });
    const rerated = catalog.map((v, i) => ({ ...v, views: ((i * 7919) % 97) * 1_000_000 + 1 }));

    for (const f of [everything, feed]) {
      const a = rank(catalog, f, behaviour, NOW);
      const b = rank(rerated, f, behaviour, NOW);
      expect(ids(b)).toEqual(ids(a));
      expect(reasons(b)).toEqual(reasons(a));
    }
  });

  it("gives the same output for the same inputs", () => {
    const catalog = Array.from({ length: 20 }, (_, i) => video({ topic: i % 2 ? "AI" : "Cooking", ageHours: i * 11 }));
    const behaviour = [signal("watched", catalog[3]), signal("skipped", catalog[5])];
    const feed = makeFeed({ topics: ["AI", "Cooking"], seed: 3 });
    expect(rank(catalog, feed, behaviour, NOW)).toEqual(rank([...catalog], feed, [...behaviour], NOW));
  });

  it("puts topics you Finished first and says so", () => {
    const done = [video({ topic: "Cooking" }), video({ topic: "Cooking" }), video({ topic: "Cooking" })];
    const cooking = video({ topic: "Cooking", channel: "Other" });
    const ai = video({ topic: "AI", channel: "Other" });
    const ranked = rank([ai, cooking], everything, done.map((v) => signal("finished", v)), NOW);
    expect(ids(ranked)).toEqual([cooking.id, ai.id]);
    expect(reasonText(ranked[0].reason)).toBe("Because you Finished 3 Cooking videos");
  });

  it("favours channels you pinned from, and says so", () => {
    const pinned = video({ topic: "Tennis", channel: "Court Replay" });
    const same = video({ topic: "Cricket", channel: "Court Replay" });
    const other = video({ topic: "Cricket", channel: "Elsewhere" });
    const ranked = rank([other, same], everything, [signal("pinned", pinned)], NOW);
    expect(ids(ranked)).toEqual([same.id, other.id]);
    expect(ranked[0].reason).toEqual({ kind: "pinnedChannel", channel: "Court Replay", count: 1 });
    expect(reasonText(ranked[0].reason)).toBe("You added a video from Court Replay");
  });

  it("puts topics and channels you removed, and videos you skipped, last", () => {
    const removed = video({ topic: "Wrestling", channel: "Ring" });
    const sameTopic = video({ topic: "Wrestling", channel: "Other" });
    const skipped = video({ topic: "AI", channel: "Other" });
    const plain = video({ topic: "AI", channel: "Other" });
    const ranked = rank([sameTopic, skipped, plain], everything, [signal("removed", removed), signal("skipped", skipped)], NOW);
    expect(ids(ranked)).toEqual([plain.id, skipped.id, sameTopic.id]);
  });

  it("forgets behaviour older than 30 days", () => {
    const old = video({ topic: "Cooking" });
    const cooking = video({ topic: "Cooking", ageHours: 2000 });
    const ai = video({ topic: "AI", ageHours: 10 });
    const behaviour = [old, old, old].map((v) => signal("finished", v, BEHAVIOUR_DAYS + 1));
    expect(ids(rank([cooking, ai], everything, behaviour, NOW))).toEqual([ai.id, cooking.id]);
  });

  it("explains recency, the recipe's topics and channels you follow", () => {
    const fresh = video({ topic: "Tennis", ageHours: 5 });
    const followed = video({ topic: "Tennis", channel: "Court Replay", ageHours: 30 });
    const plain = video({ topic: "AI" });
    const topics = makeFeed({ topics: ["AI"] });
    expect(reasonText(rank([fresh], everything, [], NOW)[0].reason)).toBe("New this week");
    expect(reasonText(rank([plain], topics, [], NOW)[0].reason)).toBe("Matches AI in this feed");
    expect(reasonText(rank([followed], everything, [], NOW, ["Court Replay"])[0].reason)).toBe("New from Court Replay, which you follow");
  });

  it("ignores muted topics' matches but keeps the order stable when nothing differs", () => {
    const feed: Feed = makeFeed({ topics: ["AI"], muted: ["AI"] });
    const a = video();
    expect(reasonText(rank([a], feed, [], NOW)[0].reason)).toBe("From your catalog");
  });
});
