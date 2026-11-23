import { activeItems } from "./feedList";
import { isConnectedClaude } from "./fromClaude";
import type { Reason } from "./rank";
import { seededRank } from "./seeded";
import type { Feed, Video } from "./types";

/** Up next's third card: the ranked feed's two best come first, so the slot is seen without leading the feed. */
export const OUTSIDE_POSITION = 2;

/**
 * Feeds that are a recipe of topics: your own and a connected From Claude. Everything already shows every topic,
 * Most viewed, Subscriptions and News keep their own orders, and a Blend's topics are already a mix of two people's.
 */
export const hasOutsideSlot = (feed: Feed): boolean =>
  !feed.draft && (feed.kind === "topics" || (feed.kind === "claude" && isConnectedClaude(feed)));

/**
 * Topics posted by the channels that post the feed's topics, but not in the feed (muted ones neither),
 * most shared channels first, then by name.
 */
export function adjacentTopics(feed: Feed, catalog: readonly Video[]): string[] {
  const own = activeItems(feed);
  const channels = new Set(catalog.filter((v) => own.includes(v.topic)).map((v) => v.channel));
  const outside = catalog.filter((v) => channels.has(v.channel) && !feed.topics.includes(v.topic) && !feed.muted.includes(v.topic));
  const topics = [...new Set(outside.map((v) => v.topic))];
  const sharedChannels = (topic: string) => new Set(outside.filter((v) => v.topic === topic).map((v) => v.channel)).size;
  return topics
    .map((topic) => ({ topic, shared: sharedChannels(topic) }))
    .sort((a, b) => b.shared - a.shared || a.topic.localeCompare(b.topic))
    .map(({ topic }) => topic);
}

/** The feed topic the outside video's channel also posts, for its reason. */
const nearTopic = (feed: Feed, catalog: readonly Video[], channel: string): string => {
  const own = activeItems(feed);
  return own.find((topic) => catalog.some((v) => v.channel === channel && v.topic === topic)) ?? own[0] ?? "";
};

type OutsideInput = Readonly<{
  feed: Feed;
  catalog: readonly Video[];
  /** Whether composition could show the video at all: inside the length range, the filters and the feed's age limit. */
  fits: (video: Video) => boolean;
  following: readonly string[];
  /** Minutes left in the session's maximum. */
  room: number;
}>;

export type Outside = Readonly<{ video: Video; reason: Reason }>;

const sessionIds = (feed: Feed): readonly string[] => [...feed.pinned, ...feed.finished, ...(feed.current === null ? [] : [feed.current])];

/**
 * The session's one video from outside the recipe (ADR 0010), or null: none when it's off, when the feed has
 * no adjacent topic, or when the session already has one. Followed channels first, then the feed's seed, so it
 * stays put for the set. Removing it leaves the slot empty until the logo's next set, rather than offering another.
 */
export function pickOutside({ feed, catalog, fits, following, room }: OutsideInput): Outside | null {
  if (!feed.exploreSlot || !hasOutsideSlot(feed)) return null;
  const adjacent = new Set(adjacentTopics(feed, catalog));
  const inSession = new Set(sessionIds(feed));
  if (catalog.some((v) => inSession.has(v.id) && adjacent.has(v.topic))) return null;
  const followed = (v: Video) => Number(following.includes(v.channel));
  const [first] = catalog
    .filter((v) => adjacent.has(v.topic) && !feed.skipped.includes(v.id) && fits(v) && v.minutes <= room)
    .sort((a, b) => followed(b) - followed(a) || seededRank(a.id, feed.seed) - seededRank(b.id, feed.seed));
  if (first === undefined || feed.removed.includes(first.id)) return null;
  return { video: first, reason: { kind: "outsideRecipe", topic: first.topic, near: nearTopic(feed, catalog, first.channel) } };
}
