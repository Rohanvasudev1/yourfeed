import { activeItems } from "./feedList";
import { hash } from "./hash";
import { HOURS_PER_YEAR } from "./time";
import type { ComposeInput, Composition, CompositionFilters, Feed, Video } from "./types";

export { hash };
const SMALL_CREATOR_LIMIT = 100_000;
const SHORTS_MAX_MINUTES = 2;

/** murmur3 finalizer: spreads small input changes (like seed 0 → 1) across all bits. */
const mix = (n: number): number => {
  let h = n >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};

/** A stable pseudo-random rank for a video under a seed. */
export const seededRank = (id: string, seed: number): number => mix(hash(id) ^ mix(seed + 1));

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
    case "claude":
      return feed.connected && feed.topics.includes(video.topic) && video.ageHours < HOURS_PER_YEAR;
    case "topics":
      return feed.topics.includes(video.topic) && video.ageHours < HOURS_PER_YEAR;
  }
}

function homeScore(video: Video, input: ComposeInput, byId: ReadonlyMap<string, Video>): number {
  const history = input.watched.flatMap((id) => byId.get(id) ?? []);
  const sameTopic = history.filter((h) => h.topic === video.topic).length;
  const sameChannel = history.filter((h) => h.channel === video.channel).length;
  const boosted = activeItems(input.feed).includes(video.topic) ? 4 : 0;
  const jitter = (seededRank(video.id, input.feed.seed) % 100) / 60;
  return 3 * sameTopic + 2 * sameChannel + boosted + Math.log10(Math.max(video.views, 1)) / 2 + jitter;
}

const isSmall = (video: Video) => video.channelSubscribers < SMALL_CREATOR_LIMIT;

function order(pool: readonly Video[], input: ComposeInput): Video[] {
  const { feed, filters } = input;
  switch (feed.kind) {
    case "home": {
      const byId = new Map(input.catalog.map((v) => [v.id, v]));
      const scores = new Map(pool.map((v) => [v.id, homeScore(v, input, byId)]));
      return [...pool].sort((a, b) => scores.get(b.id)! - scores.get(a.id)!);
    }
    case "top":
      return [...pool].sort((a, b) => b.views - a.views);
    case "subs":
      return feed.seed ? shuffled(pool, feed.seed) : [...pool].sort((a, b) => a.ageHours - b.ageHours);
    case "news":
      return [...pool].sort((a, b) => Number(b.live) - Number(a.live) || a.ageHours - b.ageHours);
    case "claude":
    case "topics": {
      const mixed = shuffled(pool, feed.seed);
      if (!filters.boostSmallCreators) return mixed;
      return mixed.sort((a, b) => Number(isSmall(b)) - Number(isSmall(a)));
    }
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

  return order(pool, input).reduce<Composition>(
    (acc, video) =>
      failsFilters(video, feed, filters) || acc.usedMinutes + video.minutes > feed.session[1]
        ? { ...acc, hidden: acc.hidden + 1 }
        : { ...acc, upNext: [...acc.upNext, video], usedMinutes: acc.usedMinutes + video.minutes },
    { upNext: [], hidden: 0, usedMinutes: startMinutes },
  );
}
