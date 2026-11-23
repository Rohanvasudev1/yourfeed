import { describe, expect, it } from "vitest";
import { makeFeed } from "./feed";
import { recipeSummary, showcaseBehaviour } from "./showcase";
import { CATALOG } from "../test/fixtures";

const NOW = 1_800_000_000_000;

describe("showcaseBehaviour", () => {
  it("removes three videos of the last-listed topic that has three", () => {
    const feed = makeFeed({ topics: ["AI", "Gardening"] });
    const gardening = CATALOG.filter((v) => v.topic === "Gardening").length;
    const record = showcaseBehaviour(feed, CATALOG, NOW);
    expect(gardening).toBeLessThan(3);
    expect(record.map((e) => e.kind)).toEqual(["removed", "removed", "removed"]);
    expect(new Set(record.map((e) => CATALOG.find((v) => v.id === e.video)?.topic))).toEqual(new Set(["AI"]));
  });

  it("is empty when no topic has three videos", () => {
    expect(showcaseBehaviour(makeFeed({ topics: ["Gardening"] }), CATALOG, NOW)).toEqual([]);
  });
});

describe("recipeSummary", () => {
  it("says the topics and both ranges, or that there are no topics", () => {
    expect(recipeSummary(makeFeed({ topics: ["AI"], length: [10, 60], session: [30, 90] }))).toBe("AI · 10–60 min videos · 30–90 min sessions");
    expect(recipeSummary(makeFeed({ topics: [], length: [1, 5], session: [10, 20] }))).toBe("no topics · 1–5 min videos · 10–20 min sessions");
  });
});
