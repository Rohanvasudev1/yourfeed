import { describe, expect, it } from "vitest";
import { blendOrder, blendTopics, myTopics, tasteOf } from "./blend";
import { makeFeed } from "./feed";
import type { Video } from "./types";

/** The demo catalog's topics and the demo seed's own-feed topics, as the mockup has them. */
const DEMO_TOPICS = [
  "AI", "Programming", "Careers", "Economics", "Premier League", "Tennis", "Cricket", "Wrestling",
  "Podcasts", "Live music", "Vlogs", "MCP", "Product design", "Cooking", "Travel", "News",
];
const MINE = [
  "AI", "Programming", "Economics", "Careers", "Premier League", "Tennis", "Cricket", "Wrestling",
  "Podcasts", "Live music", "Vlogs", "Cooking",
];

describe("tasteOf", () => {
  it("gives the mockup's taste and match score for its demo blends", () => {
    expect(tasteOf("maya.k", MINE, DEMO_TOPICS)).toEqual({ name: "maya.k", topics: ["Cooking", "Cricket", "AI", "Travel"], score: 83 });
    expect(tasteOf("devon_r", MINE, DEMO_TOPICS)).toEqual({ name: "devon_r", topics: ["MCP", "Tennis", "AI", "Economics"], score: 84 });
  });

  it("is the same every time for a username, whatever its case or the catalog's topic order", () => {
    const once = tasteOf("maya.k", MINE, DEMO_TOPICS);
    expect(tasteOf("maya.k", MINE, [...DEMO_TOPICS].reverse())).toEqual(once);
    expect(tasteOf("Maya.K", MINE, DEMO_TOPICS)).toEqual({ ...once, name: "Maya.K" });
  });

  it("scores more overlap higher and never above 96%", () => {
    const shared = tasteOf("sam", MINE, DEMO_TOPICS);
    const strangers = tasteOf("sam", ["Gardening"], DEMO_TOPICS);
    expect(shared.score).toBeGreaterThan(strangers.score);
    expect(shared.score).toBeLessThanOrEqual(96);
    for (const name of ["abc", "zoe_1", "x.y.z", "longer_name_here"]) {
      const { score } = tasteOf(name, DEMO_TOPICS, DEMO_TOPICS);
      expect(score).toBeGreaterThanOrEqual(38);
      expect(score).toBeLessThanOrEqual(96);
    }
  });

  it("picks four or five of the catalog's topics, fewer when the catalog has fewer", () => {
    expect(tasteOf("maya.k", MINE, DEMO_TOPICS).topics.length).toBeGreaterThanOrEqual(4);
    expect([...tasteOf("maya.k", MINE, ["AI", "Gardening"]).topics].sort()).toEqual(["AI", "Gardening"]);
    expect(tasteOf("maya.k", MINE, []).topics).toEqual([]);
  });
});

describe("blendTopics", () => {
  it("lists shared topics first, then up to four of mine, then theirs, once each", () => {
    expect(blendTopics(MINE, ["Cooking", "Cricket", "AI", "Travel"])).toEqual([
      "AI", "Cricket", "Cooking", "Programming", "Economics", "Careers", "Travel",
    ]);
    expect(blendTopics([], ["MCP"])).toEqual(["MCP"]);
  });
});

describe("myTopics", () => {
  it("collects the topics of the visitor's own feeds, not the built-in ones", () => {
    const feeds = [
      makeFeed({ kind: "home", topics: ["Boosted"] }),
      makeFeed({ topics: ["AI", "Programming"] }),
      makeFeed({ topics: ["AI", "Cooking"] }),
    ];
    expect(myTopics(feeds)).toEqual(["AI", "Programming", "Cooking"]);
  });
});

describe("blendOrder", () => {
  const v = (id: string, topic: string) => ({ id, topic }) as Video;

  it("puts videos for you both first, then alternates yours and theirs", () => {
    const videos = [v("t1", "Travel"), v("m1", "Tennis"), v("b1", "AI"), v("t2", "MCP"), v("m2", "Vlogs"), v("m3", "Tennis"), v("b2", "AI")];
    const order = blendOrder(videos, ["AI", "Tennis", "Vlogs"], ["AI", "Travel", "MCP"]).map((x) => x.id);
    expect(order).toEqual(["b1", "b2", "m1", "t1", "m2", "t2", "m3"]);
  });
});
