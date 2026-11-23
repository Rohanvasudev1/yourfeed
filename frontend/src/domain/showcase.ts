import type { BehaviourRecord } from "./behaviour";
import { MIRROR_SIGNALS } from "./mirror";
import { HOURS_PER_DAY, MS_PER_HOUR } from "./time";
import type { Feed, Video } from "./types";

/**
 * The showcase page (ADR 0014): one demo feed, played out in memory, that shows a request changing the recipe,
 * a recipe mirror proposal and cards that say why they're there.
 */

/** The demo feed the showcase opens: its outside-your-recipe slot is its third card on the demo catalog. */
export const SHOWCASE_FEED = "Learn";

const DAY_MS = HOURS_PER_DAY * MS_PER_HOUR;

/**
 * Removals that make the recipe mirror propose dropping one of `feed`'s topics: the last-listed topic with
 * enough catalog videos, so the proposal touches the feed's least central topic. Empty when no topic has enough.
 */
export function showcaseBehaviour(feed: Feed, catalog: readonly Video[], now: number): BehaviourRecord {
  const videosOf = (topic: string) => catalog.filter((v) => v.topic === topic);
  const topic = [...feed.topics].reverse().find((t) => videosOf(t).length >= MIRROR_SIGNALS);
  if (!topic) return [];
  return videosOf(topic)
    .slice(0, MIRROR_SIGNALS)
    .map((v) => ({ kind: "removed", video: v.id, at: now - DAY_MS }));
}

const minutes = ([min, max]: Feed["length"]) => `${min}–${max} min`;

/** The recipe in one line: topics, video length and session length. */
export const recipeSummary = (feed: Feed): string =>
  [feed.topics.join(", ") || "no topics", `${minutes(feed.length)} videos`, `${minutes(feed.session)} sessions`].join(" · ");
