import { describe, expect, it } from "vitest";
import type { Video } from "./types";
import {
  RECENT_LIMIT,
  SUGGESTION_LIMIT,
  forgetSearch,
  highlightUntyped,
  normalizeQuery,
  rememberSearch,
  searchCatalog,
  suggestFor,
  suggestionCorpus,
} from "./search";

const video = (o: Partial<Video> & Pick<Video, "id" | "title">): Video => ({
  honestTitle: o.title,
  channel: "Quiet Channel",
  channelSubscribers: 1_000,
  topic: "Gardening",
  minutes: 10,
  views: 1_000,
  ageHours: 10,
  clickbait: false,
  live: false,
  newsCategory: null,
  ...o,
});

const CATALOG: readonly Video[] = [
  video({ id: "a", title: "Tomato tips", topic: "Gardening", channel: "Green Fingers", views: 500 }),
  video({ id: "b", title: "Tennis serve drills", topic: "Tennis", channel: "Court Replay", views: 2_000 }),
  video({ id: "c", title: "THIS trick SHOCKED me", honestTitle: "Pruning roses", topic: "Gardening", channel: "Green Fingers", views: 300, clickbait: true }),
  video({ id: "d", title: "Tea for beginners", topic: "Cooking", channel: "Long Table", views: 100 }),
];

const phrases = (typed: string, recent: readonly string[] = []) => suggestFor(suggestionCorpus(CATALOG), recent, typed).map((s) => s.phrase);

describe("normalizeQuery", () => {
  it("lowercases, trims and collapses spaces", () => {
    expect(normalizeQuery("  Premier   League  ")).toBe("premier league");
  });
});

describe("suggestFor", () => {
  it("shows only recent searches when nothing is typed", () => {
    expect(suggestFor(suggestionCorpus(CATALOG), ["mcp server", "tennis"], "")).toEqual([
      { phrase: "mcp server", recent: true },
      { phrase: "tennis", recent: true },
    ]);
  });

  it("puts matching recent searches first, then phrases that start with what was typed, ranked by weight", () => {
    // tennis is a topic, so its 2000 views count double. Each extra word costs a phrase a little, so
    // tennis serve drills (2000 views, three words) still beats tomato tips (500, two words).
    // Then "long table" (a channel whose second word starts with t) fills the eighth place.
    expect(phrases("t", ["tomato"])).toEqual([
      "tomato",
      "tennis",
      "tennis serve drills",
      "tomato tips",
      "tennis court replay",
      "this trick shocked me",
      "tea for beginners",
      "long table",
    ]);
  });

  it("weights a phrase by the summed views of every video it names", () => {
    // gardening is the topic of a (500) and c (300), doubled: 1600. green fingers is their channel: 800.
    expect(phrases("g")).toEqual(["gardening", "green fingers", "gardening green fingers"]);
  });

  it("then suggests phrases with a later word that starts with what was typed", () => {
    expect(phrases("fing")).toEqual(["green fingers", "gardening green fingers"]);
    expect(phrases("for b")).toEqual(["tea for beginners"]);
  });

  it("offers honest titles as well as titles", () => {
    expect(phrases("prun")).toEqual(["pruning roses"]);
    expect(phrases("this")).toEqual(["this trick shocked me"]);
  });

  it("doesn't repeat a recent search among the other suggestions", () => {
    expect(phrases("tenn", ["tennis"])).toEqual(["tennis", "tennis serve drills", "tennis court replay"]);
    expect(suggestFor(suggestionCorpus(CATALOG), ["tennis"], "tenn")[0]).toEqual({ phrase: "tennis", recent: true });
  });

  it("matches case and spacing loosely but keeps a trailing space, so a filled-in phrase suggests what follows", () => {
    expect(phrases("TENNIS  S")).toEqual(["tennis serve drills"]);
    expect(phrases("tennis ")).toEqual(["tennis serve drills", "tennis court replay"]);
  });

  it(`shows at most ${SUGGESTION_LIMIT}`, () => {
    const many = Array.from({ length: 12 }, (_, i) => video({ id: `m${i}`, title: `Moss ${i}` }));
    expect(suggestFor(suggestionCorpus(many), [], "moss")).toHaveLength(SUGGESTION_LIMIT);
    expect(suggestFor(suggestionCorpus(many), Array.from({ length: 12 }, (_, i) => `r${i}`), "")).toHaveLength(SUGGESTION_LIMIT);
  });
});

describe("highlightUntyped", () => {
  it("bolds the parts around what was typed", () => {
    expect(highlightUntyped("tennis serve drills", "serve")).toEqual([
      { text: "tennis ", bold: true },
      { text: "serve", bold: false },
      { text: " drills", bold: true },
    ]);
  });

  it("bolds nothing when nothing was typed, and everything when the typed text isn't in it", () => {
    expect(highlightUntyped("tennis", " ")).toEqual([{ text: "tennis", bold: false }]);
    expect(highlightUntyped("tennis", "golf")).toEqual([{ text: "tennis", bold: true }]);
  });

  it("leaves out empty parts", () => {
    expect(highlightUntyped("tennis", "Tennis")).toEqual([{ text: "tennis", bold: false }]);
  });
});

describe("searchCatalog", () => {
  const ids = (query: string, hideClickbait = false) => searchCatalog(CATALOG, query, { hideClickbait }).map((v) => v.id);

  it("matches title, honest title, channel or topic, ignoring case, in catalog order", () => {
    expect(ids("tennis")).toEqual(["b"]);
    expect(ids("PRUNING")).toEqual(["c"]);
    expect(ids("green fingers")).toEqual(["a", "c"]);
    expect(ids("cooking")).toEqual(["d"]);
    expect(ids("  tea   for ")).toEqual(["d"]);
  });

  it("matches the topic-and-channel phrases suggestions offer", () => {
    expect(ids("gardening green fingers")).toEqual(["a", "c"]);
  });

  it("leaves out clickbait while Hide clickbait is on", () => {
    expect(ids("gardening", true)).toEqual(["a"]);
  });

  it("finds nothing for an empty query", () => {
    expect(ids("   ")).toEqual([]);
  });
});

describe("recent searches", () => {
  it("puts the newest first, normalized, without repeats", () => {
    expect(rememberSearch(["tennis", "mcp"], "  MCP ")).toEqual(["mcp", "tennis"]);
  });

  it(`keeps at most ${RECENT_LIMIT}`, () => {
    const full = Array.from({ length: RECENT_LIMIT }, (_, i) => `q${i}`);
    expect(rememberSearch(full, "new")).toEqual(["new", ...full.slice(0, RECENT_LIMIT - 1)]);
  });

  it("forgets one", () => {
    expect(forgetSearch(["tennis", "mcp"], "tennis")).toEqual(["mcp"]);
  });
});
