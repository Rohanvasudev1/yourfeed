import { describe, expect, it } from "vitest";
import { applyFeedActions } from "./assistant";
import type { Signal, SignalKind } from "./behaviour";
import { makeFeed } from "./feed";
import { dismissProposal, mirror, type Proposal } from "./mirror";
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
  minutes: 30,
  views: 1000,
  ageHours: 24,
  clickbait: false,
  live: false,
  newsCategory: null,
  ...o,
});

const NOW = 1_800_000_000_000;
const DAY_MS = 24 * MS_PER_HOUR;
const signals = (kind: SignalKind, videos: readonly Video[], daysAgo = 1): Signal[] =>
  videos.map((v) => ({ kind, video: v, at: NOW - daysAgo * DAY_MS }));
const many = (n: number, o: Partial<Video>) => Array.from({ length: n }, () => video(o));

const learn = makeFeed({ name: "Learn", topics: ["AI", "Cooking"], length: [10, 60] });
const applied = (feed: Feed, proposal: Proposal | null) => applyFeedActions(feed, proposal?.actions ?? []);

describe("mirror: Finished outside the length range", () => {
  it("proposes widening the range after 3 long videos Finished in 14 days", () => {
    const proposal = mirror(learn, signals("finished", [video({ minutes: 90 }), video({ minutes: 95 }), video({ minutes: 80 })]), NOW);
    expect(proposal?.text).toBe("You Finished 3 videos longer than 60 min, but this feed is 10–60 min.");
    expect(proposal?.accept).toBe("Widen to 10–95 min");
    expect(applied(learn, proposal).length).toEqual([10, 95]);
  });

  it("proposes lowering the minimum for short videos, and stays inside the length limits", () => {
    const short = mirror(learn, signals("finished", many(3, { minutes: 4 })), NOW);
    expect(short?.text).toBe("You Finished 3 videos shorter than 10 min, but this feed is 10–60 min.");
    expect(applied(learn, short).length).toEqual([4, 60]);

    const huge = mirror(learn, signals("finished", many(3, { minutes: 400 })), NOW);
    expect(applied(learn, huge).length).toEqual([10, 120]);
  });

  it("covers both ends when Finished videos fall on either side", () => {
    const proposal = mirror(learn, signals("finished", [video({ minutes: 5 }), video({ minutes: 70 }), video({ minutes: 75 })]), NOW);
    expect(proposal?.text).toBe("You Finished 3 videos outside 10–60 min on this feed.");
    expect(applied(learn, proposal).length).toEqual([5, 75]);
  });

  it("doesn't propose after only 2", () => {
    expect(mirror(learn, signals("finished", many(2, { minutes: 90 })), NOW)).toBeNull();
  });

  it("counts a video Finished twice once", () => {
    const [v] = many(1, { minutes: 90 });
    expect(mirror(learn, [...signals("finished", [v], 1), ...signals("finished", [v], 2), ...signals("finished", many(1, { minutes: 90 }))], NOW)).toBeNull();
  });

  it("ignores signals older than 14 days", () => {
    expect(mirror(learn, signals("finished", many(3, { minutes: 90 }), 14), NOW)).not.toBeNull();
    expect(mirror(learn, signals("finished", many(3, { minutes: 90 }), 15), NOW)).toBeNull();
  });

  it("ignores videos inside the range and other kinds of signal", () => {
    expect(mirror(learn, signals("finished", many(3, { minutes: 30 })), NOW)).toBeNull();
    expect(mirror(learn, signals("watched", many(3, { minutes: 90 })), NOW)).toBeNull();
  });

  it("proposes nothing it can't change: the range is already at its limit", () => {
    const wide = { ...learn, length: [10, 120] as const };
    expect(mirror(wide, signals("finished", many(3, { minutes: 400 })), NOW)).toBeNull();
  });
});

describe("mirror: a topic repeatedly removed", () => {
  it("proposes taking a feed's topic out after 3 of its videos are removed", () => {
    const proposal = mirror(learn, signals("removed", many(3, { topic: "Cooking" })), NOW);
    expect(proposal?.text).toBe("You removed 3 Cooking videos from this feed.");
    expect(proposal?.accept).toBe("Remove Cooking");
    expect(applied(learn, proposal).topics).toEqual(["AI"]);
  });

  it("proposes muting a topic the feed doesn't list", () => {
    const everything = makeFeed({ name: "Everything", kind: "home" });
    const proposal = mirror(everything, signals("removed", many(3, { topic: "Tennis" })), NOW);
    expect(proposal?.accept).toBe("Mute Tennis");
    expect(applied(everything, proposal).muted).toEqual(["Tennis"]);
  });

  it("needs 3 of one topic in 14 days", () => {
    expect(mirror(learn, signals("removed", many(2, { topic: "Cooking" })), NOW)).toBeNull();
    expect(mirror(learn, [...signals("removed", many(2, { topic: "Cooking" })), ...signals("removed", many(1, { topic: "AI" }))], NOW)).toBeNull();
    expect(mirror(learn, signals("removed", many(3, { topic: "Cooking" }), 15), NOW)).toBeNull();
  });

  it("leaves a topic that's already muted alone", () => {
    const muted = { ...makeFeed({ name: "Everything", kind: "home" }), muted: ["Tennis"] };
    expect(mirror(muted, signals("removed", many(3, { topic: "Tennis" })), NOW)).toBeNull();
  });

  it("picks the most-removed topic", () => {
    const proposal = mirror(learn, [...signals("removed", many(3, { topic: "AI" })), ...signals("removed", many(4, { topic: "Cooking" }))], NOW);
    expect(proposal?.accept).toBe("Remove Cooking");
  });
});

describe("mirror: pins from a muted topic", () => {
  const muted = { ...learn, muted: ["Tennis"] };

  it("proposes adding the topic back after 3 pins from it", () => {
    const proposal = mirror(muted, signals("pinned", many(3, { topic: "Tennis" })), NOW);
    expect(proposal?.text).toBe("You pinned 3 Tennis videos, but Tennis is muted here.");
    expect(proposal?.accept).toBe("Add Tennis back");
    const after = applied(muted, proposal);
    expect(after.muted).toEqual([]);
    expect(after.topics).toContain("Tennis");
  });

  it("needs 3 pins in 14 days, from a muted topic", () => {
    expect(mirror(muted, signals("pinned", many(2, { topic: "Tennis" })), NOW)).toBeNull();
    expect(mirror(muted, signals("pinned", many(3, { topic: "Tennis" }), 15), NOW)).toBeNull();
    expect(mirror(muted, signals("pinned", many(3, { topic: "Golf" })), NOW)).toBeNull();
  });
});

describe("mirror: which feeds and which proposal", () => {
  const long = signals("finished", many(3, { minutes: 90 }));

  it("proposes nothing on a draft or on Shared with you", () => {
    expect(mirror({ ...learn, draft: true }, long, NOW)).toBeNull();
    expect(mirror({ ...learn, kind: "shared" }, long, NOW)).toBeNull();
  });

  it("gives one proposal when several rules match: length first", () => {
    const both = [...long, ...signals("removed", many(3, { topic: "Cooking" }))];
    expect(mirror(learn, both, NOW)?.accept).toBe("Widen to 10–90 min");
  });

  it("gives the same proposal an id that survives more of the same signals", () => {
    const first = mirror(learn, long, NOW);
    const more = mirror(learn, [...long, ...signals("finished", many(1, { minutes: 100 }))], NOW);
    expect(more?.id).toBe(first?.id);
  });
});

describe("dismissing a proposal", () => {
  const long = signals("finished", many(3, { minutes: 90 }));
  const proposal = mirror(learn, long, NOW)!;
  const dismissedAt = (daysAgo: number) => ({ ...learn, dismissed: dismissProposal(learn.dismissed, proposal.id, NOW - daysAgo * DAY_MS) });

  it("hides it for 7 days", () => {
    expect(mirror(dismissedAt(0), long, NOW)).toBeNull();
    expect(mirror(dismissedAt(6.9), long, NOW)).toBeNull();
    expect(mirror(dismissedAt(7), long, NOW)?.id).toBe(proposal.id);
  });

  it("lets another rule's proposal through meanwhile", () => {
    const both = [...long, ...signals("removed", many(3, { topic: "Cooking" }))];
    expect(mirror(dismissedAt(0), both, NOW)?.accept).toBe("Remove Cooking");
  });

  it("keeps only dismissals still in force, one per proposal", () => {
    const old = dismissProposal([], "removed:AI", NOW - 8 * DAY_MS);
    const again = dismissProposal(dismissProposal(old, proposal.id, NOW - DAY_MS), proposal.id, NOW);
    expect(again).toEqual([{ proposal: proposal.id, at: NOW }]);
  });
});
