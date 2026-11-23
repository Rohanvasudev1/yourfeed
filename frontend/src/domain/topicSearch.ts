import type { Feed, Video } from "./types";

/** What the backend's topic searches found (ADR 0011): each video as the topic that found it. */
export type TopicVideos = Readonly<{
  videos: readonly Video[];
  /** Some topic waits for tomorrow: today's searches are used up. */
  paused: boolean;
}>;

/** A feed's topic with fewer videos than this in the catalog is searched for. */
export const THIN_TOPIC_VIDEOS = 5;
/** The backend takes at most this many topics a request, each at most TOPIC_MAX_CHARS long. */
export const TOPICS_PER_SEARCH = 5;
export const TOPIC_MAX_CHARS = 40;

export const TOPIC_SEARCH_TEXT = { paused: "New topic searches resume tomorrow." } as const;

/** The topics the feeds name that have few videos in the catalog, in feed order. Drafts aren't feeds yet. */
export function thinTopics(feeds: readonly Feed[], catalog: readonly Video[]): readonly string[] {
  const named = new Set(feeds.filter((f) => !f.draft).flatMap((f) => f.topics.map((t) => t.trim())));
  const counts = new Map<string, number>();
  for (const v of catalog) counts.set(v.topic, (counts.get(v.topic) ?? 0) + 1);
  return [...named].filter((t) => t.length > 0 && t.length <= TOPIC_MAX_CHARS && (counts.get(t) ?? 0) < THIN_TOPIC_VIDEOS);
}

/** Topics in requests the backend takes. */
export function searchBatches(topics: readonly string[]): readonly (readonly string[])[] {
  return Array.from({ length: Math.ceil(topics.length / TOPICS_PER_SEARCH) }, (_, i) => topics.slice(i * TOPICS_PER_SEARCH, (i + 1) * TOPICS_PER_SEARCH));
}

/** The catalog plus what topic searches found; a video already in the catalog stays as it is. */
export function withFoundVideos(catalog: readonly Video[], found: readonly Video[]): readonly Video[] {
  if (found.length === 0) return catalog;
  const ids = new Set(catalog.map((v) => v.id));
  return [...catalog, ...found.filter((v) => !ids.has(v.id))];
}
