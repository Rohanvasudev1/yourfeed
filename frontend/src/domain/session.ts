import type { Feed, Video } from "./types";

/**
 * Yourfeed doesn't embed players: a video opens as a YouTube search for its title and channel.
 * It searches the real title, never the honest one, since only the real one is on YouTube.
 */
export const youtubeSearchUrl = (video: Video): string =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${video.title} ${video.channel}`)}`;

const without = (ids: readonly string[], id: string) => ids.filter((x) => x !== id);

/** Makes `id` Watching now. Whatever was Watching now before is Finished. */
export function startWatching(feed: Feed, id: string): Feed {
  if (feed.current === id) return feed;
  const finished = feed.current === null ? feed.finished : [...without(feed.finished, feed.current), feed.current];
  return { ...feed, current: id, finished: without(finished, id), pinned: without(feed.pinned, id) };
}

/** Moves Watching now to Finished. */
export const finishCurrent = (feed: Feed): Feed =>
  feed.current === null ? feed : { ...feed, finished: [...feed.finished, feed.current], current: null };

/** Takes a Finished video out of the session so composition can offer it in Up next again. */
export const moveBackToUpNext = (feed: Feed, id: string): Feed => ({ ...feed, finished: without(feed.finished, id) });

const inSessionIds = (feed: Feed): readonly string[] => [...feed.pinned, ...feed.finished, ...(feed.current === null ? [] : [feed.current])];

/** Pinned, Finished or Watching now. */
export const isInSession = (feed: Feed, id: string): boolean => inSessionIds(feed).includes(id);

/** Adds `id` to the session first in Up next, and undoes an earlier removal. A video already in the session changes nothing. */
export const pinVideo = (feed: Feed, id: string): Feed =>
  isInSession(feed, id) ? feed : { ...feed, pinned: [id, ...feed.pinned], removed: without(feed.removed, id) };

/** Takes a video out of the session and keeps it out of Up next, pinned or not. Pinning it again brings it back. */
export const removeFromSession = (feed: Feed, id: string): Feed => ({
  ...feed,
  pinned: without(feed.pinned, id),
  removed: [...without(feed.removed, id), id],
});
