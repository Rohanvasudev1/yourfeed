import { hash } from "./hash";
import type { Feed, Video } from "./types";

/** Someone the visitor blends with: their taste (topics) and how well it matches the visitor's. */
export type BlendPartner = Readonly<{ name: string; topics: readonly string[]; score: number }>;

export const BLEND_STATUSES = ["pending", "accepted"] as const;
export type BlendStatus = (typeof BLEND_STATUSES)[number];

/** A Blend feed's other person: invited (pending) or approved (accepted). */
export type Blend = BlendPartner & Readonly<{ status: BlendStatus }>;

/** Match scores stay in this range, as in the mockup. */
export const MATCH_SCORE = { min: 0, max: 96 } as const;
const BASE_SCORE = 38;
const OVERLAP_WEIGHT = 55;
const SCORE_JITTER = 7;
const TASTE_SIZE = 4;
/** How many of the visitor's own topics a blend takes after the shared ones. */
const MY_TOPICS_IN_BLEND = 4;

const unique = (items: readonly string[]): string[] => [...new Set(items)];

/** The topics of the visitor's own feeds, in tab order, once each. */
export const myTopics = (feeds: readonly Feed[]): string[] => unique(feeds.filter((f) => f.kind === "topics").flatMap((f) => f.topics));

/**
 * A simulated person's taste, derived from their username (any case gives the same taste) as the
 * mockup's `tasteOf`: four or five of the catalog's topics, and a match score from the overlap with `mine`.
 */
export function tasteOf(name: string, mine: readonly string[], catalogTopics: readonly string[]): BlendPartner {
  const key = name.toLowerCase();
  const h = hash(key);
  const topics = [...catalogTopics].sort((a, b) => hash(a + key) - hash(b + key)).slice(0, TASTE_SIZE + (h % 2));
  const shared = topics.filter((t) => mine.includes(t)).length;
  const overlap = shared / Math.max(1, Math.min(mine.length, topics.length));
  const score = Math.min(MATCH_SCORE.max, Math.round(BASE_SCORE + OVERLAP_WEIGHT * overlap + (h % SCORE_JITTER)));
  return { name, topics, score };
}

/** A blend's topics: the ones you share first, then up to four of mine, then theirs, once each. */
export const blendTopics = (mine: readonly string[], theirs: readonly string[]): string[] =>
  unique([...mine.filter((t) => theirs.includes(t)), ...mine.slice(0, MY_TOPICS_IN_BLEND), ...theirs]);

/** Orders already-shuffled blend videos: ones for you both first, then yours and theirs taking turns. */
export function blendOrder(videos: readonly Video[], mine: readonly string[], theirs: readonly string[]): Video[] {
  const both = (v: Video) => mine.includes(v.topic) && theirs.includes(v.topic);
  const yours = videos.filter((v) => !both(v) && mine.includes(v.topic));
  const others = videos.filter((v) => !both(v) && !mine.includes(v.topic));
  const turns = Array.from({ length: Math.max(yours.length, others.length) }, (_, i) => [yours[i], others[i]]).flat();
  return [...videos.filter(both), ...turns.filter((v): v is Video => v !== undefined)];
}

/** Whether a feed's blend has been approved, so it has a feed to show. */
export const isBlendOn = (feed: Feed): boolean => feed.partner?.status === "accepted";

/** The first letter of a username, for its avatar. */
export const initialOf = (name: string): string => name.charAt(0).toUpperCase();
