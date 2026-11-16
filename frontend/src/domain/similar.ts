import type { Video } from "./types";

/** How many videos a Videos like this row shows. */
export const SIMILAR_LIMIT = 10;

const TOPIC_WEIGHT = 3;
const CHANNEL_WEIGHT = 2;
const FEED_TOPIC_WEIGHT = 1;

/**
 * The videos most like `video`: same topic first, then same channel, then one of the feed's own
 * topics, ties broken by views. Never `video` itself.
 */
export function similarVideos(catalog: readonly Video[], video: Video, feedTopics: readonly string[], limit = SIMILAR_LIMIT): readonly Video[] {
  const score = (x: Video) =>
    (x.topic === video.topic ? TOPIC_WEIGHT : 0) +
    (x.channel === video.channel ? CHANNEL_WEIGHT : 0) +
    (feedTopics.includes(x.topic) ? FEED_TOPIC_WEIGHT : 0);
  return catalog
    .filter((x) => x.id !== video.id)
    .map((x) => ({ x, score: score(x) }))
    .sort((a, b) => b.score - a.score || b.x.views - a.x.views)
    .slice(0, limit)
    .map(({ x }) => x);
}
