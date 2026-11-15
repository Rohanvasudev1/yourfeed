import { describe, expect, it } from "vitest";
import { composeFeed } from "./compose";
import { makeFeed } from "./feed";
import type { ComposeInput, GlobalFilters, Video } from "./types";

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
  ageHours: 24,
  clickbait: false,
  live: false,
  newsCategory: null,
  ...o,
});

const filters: GlobalFilters = { hideClickbait: true, boostSmallCreators: false, includeShorts: false };

const compose = (o: Partial<ComposeInput>) =>
  composeFeed({ catalog: [], feed: makeFeed(), filters, watched: [], topMaxAgeHours: Infinity, ...o });

const ids = (r: ReturnType<typeof composeFeed>) => r.upNext.map((v) => v.id);

describe("topics feed", () => {
  it("shows only the feed's topics, from the last year", () => {
    const ai = video({ topic: "AI" });
    const old = video({ topic: "AI", ageHours: 9000 });
    const cooking = video({ topic: "Cooking" });
    const r = compose({ catalog: [ai, old, cooking], feed: makeFeed({ topics: ["AI"] }) });
    expect(ids(r)).toEqual([ai.id]);
  });

  it("hides videos outside the length range and counts them", () => {
    const short = video({ minutes: 3 });
    const fits = video({ minutes: 20 });
    const long = video({ minutes: 90 });
    const r = compose({ catalog: [short, fits, long], feed: makeFeed({ topics: ["AI"], length: [10, 60] }) });
    expect(ids(r)).toEqual([fits.id]);
    expect(r.hidden).toBe(2);
  });

  it("stops filling Up next at the session maximum, counting pinned and finished minutes", () => {
    const pinned = video({ minutes: 30 });
    const finished = video({ minutes: 20 });
    const a = video({ minutes: 25 });
    const b = video({ minutes: 25 });
    const r = compose({
      catalog: [pinned, finished, a, b],
      feed: makeFeed({ topics: ["AI"], session: [10, 80], pinned: [pinned.id], finished: [finished.id] }),
    });
    expect(r.upNext).toHaveLength(1);
    expect(r.hidden).toBe(1);
    expect(r.usedMinutes).toBe(75);
  });

  it("drops clickbait only when Hide clickbait is on", () => {
    const bait = video({ clickbait: true });
    const feed = makeFeed({ topics: ["AI"] });
    expect(ids(compose({ catalog: [bait], feed }))).toEqual([]);
    expect(ids(compose({ catalog: [bait], feed, filters: { ...filters, hideClickbait: false } }))).toEqual([bait.id]);
  });

  it("drops Shorts (under 2 minutes) unless Include Shorts is on", () => {
    const shortVid = video({ minutes: 1 });
    const feed = makeFeed({ topics: ["AI"] });
    expect(ids(compose({ catalog: [shortVid], feed }))).toEqual([]);
    expect(ids(compose({ catalog: [shortVid], feed, filters: { ...filters, includeShorts: true } }))).toEqual([shortVid.id]);
  });

  it("leaves out muted topics, removed, skipped, pinned, finished and current videos", () => {
    const vs = Array.from({ length: 6 }, () => video());
    const muted = video({ topic: "Tennis" });
    const r = compose({
      catalog: [...vs, muted],
      feed: makeFeed({
        topics: ["AI", "Tennis"],
        muted: ["Tennis"],
        removed: [vs[0].id],
        skipped: [vs[1].id],
        pinned: [vs[2].id],
        finished: [vs[3].id],
        current: vs[4].id,
      }),
    });
    expect(ids(r)).toEqual([vs[5].id]);
  });

  it("puts small creators (under 100K subscribers) first when Boost small creators is on", () => {
    const big = Array.from({ length: 5 }, () => video({ channelSubscribers: 2_000_000 }));
    const small = video({ channelSubscribers: 40_000 });
    const r = compose({
      catalog: [...big, small],
      feed: makeFeed({ topics: ["AI"] }),
      filters: { ...filters, boostSmallCreators: true },
    });
    expect(r.upNext[0].id).toBe(small.id);
  });

  it("is deterministic for a seed, and a new seed reshuffles", () => {
    const catalog = Array.from({ length: 12 }, () => video({ minutes: 5 }));
    const feed = makeFeed({ topics: ["AI"] });
    expect(ids(compose({ catalog, feed }))).toEqual(ids(compose({ catalog, feed })));
    expect(ids(compose({ catalog, feed: { ...feed, seed: 1 } }))).not.toEqual(ids(compose({ catalog, feed })));
  });
});

describe("other feed kinds", () => {
  it("Most viewed ranks by views within the time range and optional topics", () => {
    const low = video({ views: 10 });
    const high = video({ views: 1_000_000 });
    const tooOld = video({ views: 9_000_000, ageHours: 20_000 });
    const r = compose({ catalog: [low, high, tooOld], feed: makeFeed({ kind: "top" }), topMaxAgeHours: 8760 });
    expect(ids(r)).toEqual([high.id, low.id]);
  });

  it("Subscriptions shows only followed channels, newest first", () => {
    const older = video({ channel: "A", ageHours: 50 });
    const newer = video({ channel: "A", ageHours: 2 });
    const other = video({ channel: "B" });
    const r = compose({ catalog: [older, newer, other], feed: makeFeed({ kind: "subs", channels: ["A"] }) });
    expect(ids(r)).toEqual([newer.id, older.id]);
  });

  it("News puts live first, then newest, filtered by category", () => {
    const old = video({ topic: "News", newsCategory: "World", ageHours: 10 });
    const fresh = video({ topic: "News", newsCategory: "World", ageHours: 1 });
    const live = video({ topic: "News", newsCategory: "World", ageHours: 5, live: true });
    const tech = video({ topic: "News", newsCategory: "Tech", ageHours: 1 });
    const notNews = video({ topic: "AI" });
    const catalog = [old, fresh, live, tech, notNews];
    expect(ids(compose({ catalog, feed: makeFeed({ kind: "news", newsCategory: "World" }) }))).toEqual([live.id, fresh.id, old.id]);
    expect(ids(compose({ catalog, feed: makeFeed({ kind: "news" }) }))).toHaveLength(4);
  });

  it("Everything skips watched videos and favours topics and channels you watch", () => {
    const watchedAi = video({ topic: "AI", channel: "X" });
    const moreAi = video({ topic: "AI", channel: "X", views: 100 });
    const cooking = video({ topic: "Cooking", channel: "Y", views: 100 });
    const r = compose({ catalog: [watchedAi, cooking, moreAi], feed: makeFeed({ kind: "home" }), watched: [watchedAi.id] });
    expect(ids(r)).toEqual([moreAi.id, cooking.id]);
  });
});
