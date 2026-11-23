import { hash } from "./hash";
import type { Feed, Video } from "./types";

/**
 * Someone the visitor blends with: their taste (topics) and how well it matches the visitor's.
 * Signed in, `id` is the server's blend (ADR 0013); demo blends are simulated and have none.
 */
export type BlendPartner = Readonly<{ name: string; topics: readonly string[]; score: number; id?: number }>;

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

/** What a real blend invite or approval may carry, as the server checks it (backend `app/blends/blend.py`). */
export const BLEND_RECIPE_LIMITS = { topics: 50, chars: 60 } as const;

/** The visitor's recipe topics as a real blend carries them: within the server's limits, first ones first. */
export const blendRecipe = (feeds: readonly Feed[]): string[] =>
  myTopics(feeds)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= BLEND_RECIPE_LIMITS.chars)
    .slice(0, BLEND_RECIPE_LIMITS.topics);

/**
 * A simulated person's taste, derived from their username (any case gives the same taste) as the
 * mockup's `tasteOf`: four or five of the catalog's topics, and a match score from the overlap with `mine`.
 */
export function tasteOf(name: string, mine: readonly string[], catalogTopics: readonly string[]): BlendPartner {
  const key = name.toLowerCase();
  const topics = [...catalogTopics].sort((a, b) => hash(a + key) - hash(b + key)).slice(0, TASTE_SIZE + (hash(key) % 2));
  return { name, topics, score: matchScore(name, mine, topics) };
}

/** How well `theirs` matches `mine`: mostly the share of topics in common, nudged per username so ties differ. */
export function matchScore(name: string, mine: readonly string[], theirs: readonly string[]): number {
  const shared = theirs.filter((t) => mine.includes(t)).length;
  const overlap = shared / Math.max(1, Math.min(mine.length, theirs.length));
  const jitter = hash(name.toLowerCase()) % SCORE_JITTER;
  return Math.min(MATCH_SCORE.max, Math.round(BASE_SCORE + OVERLAP_WEIGHT * overlap + jitter));
}

/**
 * One of a signed-in user's blends as the server keeps it (ADR 0013): who it's with, which side invited, and,
 * once accepted, their recipe topics. Never anything from their catalog.
 */
export type ServerBlend = Readonly<{
  id: number;
  with: string;
  role: "inviter" | "invitee";
  status: BlendStatus;
  topics: readonly string[];
}>;

/** The server took the invite, or said why not (no one has that username, already blending, today's invites used up). */
export type InviteAnswer = Readonly<{ ok: true; blend: ServerBlend }> | Readonly<{ ok: false; problem: string }>;

export const BLEND_TEXT = {
  failed: "Couldn't reach Blend. Try again.",
} as const;

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
