import { blendOrder, isBlendOn } from "./blend";
import { activeItems } from "./feedList";
import { isConnectedClaude } from "./fromClaude";
import { rank, type Reason } from "./rank";
import { seededRank } from "./seeded";
import { HOURS_PER_WEEK, HOURS_PER_YEAR } from "./time";
import type { ComposeInput, Composition, CompositionFilters, Feed, Video } from "./types";

/** A video in composition order with the reason its card shows. */
type Placed = Readonly<{ video: Video; reason: Reason }>;

const SMALL_CREATOR_LIMIT = 100_000;
const SHORTS_MAX_MINUTES = 2;

const shuffled = (videos: readonly Video[], seed: number): Video[] =>
  [...videos].sort((a, b) => seededRank(a.id, seed) - seededRank(b.id, seed));

const sessionIds = (feed: Feed): readonly string[] =>
  feed.current === null ? feed.finished : [...feed.finished, feed.current];

function isExcluded(video: Video, feed: Feed): boolean {
  return (
    feed.pinned.includes(video.id) ||
    sessionIds(feed).includes(video.id) ||
    feed.removed.includes(video.id) ||
    feed.skipped.includes(video.id) ||
    feed.muted.includes(video.topic)
  );
}

/** Most viewed with no (unmuted) topics shows every topic. */
function limitedToTopic(feed: Feed, topic: string): boolean {
  const topics = activeItems(feed);
  return topics.length === 0 || topics.includes(topic);
}

function matchesKind(video: Video, input: ComposeInput): boolean {
  const { feed } = input;
  switch (feed.kind) {
    case "home":
      return !input.watched.includes(video.id);
    case "subs":
      return feed.channels.includes(video.channel);
    case "top":
      return video.ageHours <= input.topMaxAgeHours && limitedToTopic(feed, video.topic);
    case "news":
      return video.topic === "News" && (feed.newsCategory === "All" || video.newsCategory === feed.newsCategory);
    case "blend":
      return isBlendOn(feed) && feed.topics.includes(video.topic) && video.ageHours < HOURS_PER_YEAR;
    case "claude":
      return isConnectedClaude(feed) && feed.topics.includes(video.topic) && video.ageHours < HOURS_PER_YEAR;
    case "topics":
      return feed.topics.includes(video.topic) && video.ageHours < HOURS_PER_YEAR;
    case "shared":
      // An open share's videos come from the share itself (composeShared), never the catalog.
      return false;
  }
}

const isSmall = (video: Video) => video.channelSubscribers < SMALL_CREATOR_LIMIT;

const placed = (videos: readonly Video[], reason: (v: Video) => Reason): Placed[] => videos.map((video) => ({ video, reason: reason(video) }));

const subscriptionReason = (v: Video): Reason =>
  v.ageHours <= HOURS_PER_WEEK ? { kind: "newFromSubscription", channel: v.channel } : { kind: "followedChannel", channel: v.channel };

const byVideos = (ranked: readonly Placed[], order: readonly Video[]): Placed[] => {
  const byId = new Map(ranked.map((r) => [r.video.id, r]));
  return order.flatMap((v) => byId.get(v.id) ?? []);
};

/** Ranked feeds use the Ranker; Most viewed, Subscriptions, News and Shared keep their own orders (ADR 0010). */
function order(pool: readonly Video[], input: ComposeInput): Placed[] {
  const { feed, filters } = input;
  const ranked = () => rank(pool, feed, input.behaviour, input.now, input.following);
  switch (feed.kind) {
    case "home":
      return ranked();
    case "top":
      return placed([...pool].sort((a, b) => b.views - a.views), () => ({ kind: "mostViewed" }));
    case "subs":
      return placed(feed.seed ? shuffled(pool, feed.seed) : [...pool].sort((a, b) => a.ageHours - b.ageHours), subscriptionReason);
    case "news":
      return placed([...pool].sort((a, b) => Number(b.live) - Number(a.live) || a.ageHours - b.ageHours), (v) => ({ kind: v.live ? "live" : "latestNews" }));
    case "blend": {
      const r = ranked();
      return byVideos(r, blendOrder(r.map((x) => x.video), input.myTopics, feed.partner?.topics ?? []));
    }
    case "claude":
    case "topics": {
      const r = ranked();
      if (!filters.boostSmallCreators) return r;
      return [...r].sort((a, b) => Number(isSmall(b.video)) - Number(isSmall(a.video)));
    }
    case "shared":
      return placed(pool, () => ({ kind: "shared" }));
  }
}

function failsFilters(video: Video, feed: Feed, filters: CompositionFilters): boolean {
  const [minLen, maxLen] = feed.length;
  if (video.minutes < minLen || video.minutes > maxLen) return true;
  if (feed.kind === "news") return false;
  return (filters.hideClickbait && video.clickbait) || (!filters.includeShorts && video.minutes < SHORTS_MAX_MINUTES);
}

/** Turns a catalog and a feed's settings into Up next. Pure: same input, same output. */
export function composeFeed(input: ComposeInput): Composition {
  const { catalog, feed, filters } = input;
  const byId = new Map(catalog.map((v) => [v.id, v]));
  const committed = [...feed.pinned, ...sessionIds(feed)];
  const startMinutes = committed.reduce((sum, id) => sum + (byId.get(id)?.minutes ?? 0), 0);
  const pool = catalog.filter((v) => !isExcluded(v, feed) && matchesKind(v, input));

  const result = order(pool, input).reduce(
    (acc, { video, reason }) =>
      failsFilters(video, feed, filters) || acc.usedMinutes + video.minutes > feed.session[1]
        ? { ...acc, hidden: acc.hidden + 1 }
        : { ...acc, upNext: [...acc.upNext, video], reasons: [...acc.reasons, [video.id, reason] as const], usedMinutes: acc.usedMinutes + video.minutes },
    { upNext: [] as readonly Video[], reasons: [] as readonly (readonly [string, Reason])[], hidden: 0, usedMinutes: startMinutes },
  );
  return { ...result, reasons: new Map(result.reasons) };
}
