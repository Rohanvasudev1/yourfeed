import { describe, expect, it } from "vitest";
import { composeFeed } from "./compose";
import { adjacentTopics } from "./outsideRecipe";
import { makeFeed } from "./feed";
import { reasonText } from "./rank";
import type { ComposeInput, CompositionFilters, Feed, Video } from "./types";

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

const filters: CompositionFilters = { hideClickbait: true, boostSmallCreators: false, includeShorts: false };

const compose = (o: Partial<ComposeInput>) =>
  composeFeed({ catalog: [], feed: makeFeed(), filters, watched: [], topMaxAgeHours: Infinity, myTopics: [], behaviour: [], now: 0, following: [], ...o });

const ai = (n: number, o: Partial<Video> = {}) => Array.from({ length: n }, () => video({ channel: "Agent Workshop", ...o }));
const mcp = video({ id: "mcp", topic: "MCP", channel: "Agent Workshop", minutes: 15 });
const cooking = video({ id: "cook", topic: "Cooking", channel: "Kitchen" });
const learn = makeFeed({ name: "Learn", topics: ["AI"], session: [10, 60] });

const outside = (r: ReturnType<typeof composeFeed>) =>
  r.upNext.filter((v) => r.reasons.get(v.id)?.kind === "outsideRecipe").map((v) => v.id);

describe("adjacentTopics", () => {
  it("is the topics the feed's channels also post, most shared channels first", () => {
    const catalog = [
      video({ channel: "A", topic: "AI" }),
      video({ channel: "B", topic: "AI" }),
      video({ channel: "A", topic: "MCP" }),
      video({ channel: "B", topic: "MCP" }),
      video({ channel: "B", topic: "Maths" }),
      video({ channel: "C", topic: "Cooking" }),
    ];
    expect(adjacentTopics(makeFeed({ topics: ["AI"] }), catalog)).toEqual(["MCP", "Maths"]);
  });

  it("leaves out the feed's own and muted topics", () => {
    const catalog = [video({ channel: "A", topic: "AI" }), video({ channel: "A", topic: "MCP" }), video({ channel: "A", topic: "Maths" })];
    expect(adjacentTopics(makeFeed({ topics: ["AI", "Maths"], muted: ["Maths"] }), catalog)).toEqual(["MCP"]);
    expect(adjacentTopics(makeFeed({ topics: ["AI"], muted: ["MCP"] }), catalog)).toEqual(["Maths"]);
  });
});

describe("Outside your recipe", () => {
  it("places one labelled video from an adjacent topic in Up next", () => {
    const r = compose({ catalog: [...ai(4), mcp, cooking], feed: learn });
    expect(outside(r)).toEqual(["mcp"]);
    expect(reasonText(r.reasons.get("mcp")!)).toBe("Outside your recipe: MCP, next to AI");
    expect(ids(r)).not.toContain("cook");
  });

  it("counts toward the session range", () => {
    const r = compose({ catalog: [...ai(6), mcp], feed: learn });
    // 60 minutes: the 15-minute outside video plus four 10-minute ones, with room left for no fifth.
    expect(ids(r)).toContain("mcp");
    expect(r.usedMinutes).toBe(55);
    expect(r.upNext).toHaveLength(5);
  });

  it("puts it third, not first", () => {
    const r = compose({ catalog: [...ai(4), mcp], feed: learn });
    expect(ids(r)[2]).toBe("mcp");
  });

  it("is off when the feed turns it off", () => {
    expect(outside(compose({ catalog: [...ai(4), mcp], feed: { ...learn, exploreSlot: false } }))).toEqual([]);
  });

  it("shows none when the feed has no adjacent topic", () => {
    const cookingFeed = makeFeed({ topics: ["Cooking"] });
    expect(outside(compose({ catalog: [...ai(4), mcp, cooking], feed: cookingFeed }))).toEqual([]);
  });

  it("is one per session: none once an outside video is Watching now or Finished", () => {
    const watching: Feed = { ...learn, current: "mcp" };
    const other = video({ id: "mcp-2", topic: "MCP", channel: "Agent Workshop" });
    expect(outside(compose({ catalog: [...ai(4), mcp, other], feed: watching }))).toEqual([]);
    expect(outside(compose({ catalog: [...ai(4), mcp, other], feed: { ...learn, finished: ["mcp"] } }))).toEqual([]);
  });

  it("leaves the slot empty for the set once you remove it, rather than offering another", () => {
    const other = video({ id: "mcp-2", topic: "MCP", channel: "Agent Workshop" });
    const catalog = [...ai(4), mcp, other];
    const first = outside(compose({ catalog, feed: learn }));
    expect(first).toHaveLength(1);
    expect(outside(compose({ catalog, feed: { ...learn, removed: first } }))).toEqual([]);
  });

  it("keeps to the feed's length range and filters", () => {
    const long = video({ id: "long", topic: "MCP", channel: "Agent Workshop", minutes: 90 });
    const bait = video({ id: "bait", topic: "MCP", channel: "Agent Workshop", clickbait: true });
    expect(outside(compose({ catalog: [...ai(2), long, bait], feed: { ...learn, length: [1, 60] } }))).toEqual([]);
  });

  it("prefers channels you follow", () => {
    const followed = video({ id: "followed", topic: "MCP", channel: "Byte Garden" });
    const catalog = [...ai(2), video({ channel: "Byte Garden" }), mcp, followed];
    for (const seed of [1, 2, 3, 4, 5]) {
      expect(outside(compose({ catalog, feed: { ...learn, seed }, following: ["Byte Garden"] }))).toEqual(["followed"]);
    }
  });

  it("is only on your own topic feeds and From Claude, never Everything or Most viewed", () => {
    const catalog = [...ai(4), mcp];
    expect(outside(compose({ catalog, feed: makeFeed({ kind: "home", topics: ["AI"] }) }))).toEqual([]);
    expect(outside(compose({ catalog, feed: makeFeed({ kind: "top", topics: ["AI"] }) }))).toEqual([]);
    expect(outside(compose({ catalog, feed: makeFeed({ kind: "claude", topics: ["AI"], connected: true }) }))).toEqual(["mcp"]);
    expect(outside(compose({ catalog, feed: makeFeed({ kind: "blend", topics: ["AI"] }) }))).toEqual([]);
  });
});

const ids = (r: ReturnType<typeof composeFeed>) => r.upNext.map((v) => v.id);
