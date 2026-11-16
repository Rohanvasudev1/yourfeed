import { composeFeed } from "./compose";
import type { ComposeInput, Feed } from "./types";

export type FeedSet = Readonly<{ seed: number; skipped: readonly string[] }>;

export const feedSetOf = (feed: Feed): FeedSet => ({ seed: feed.seed, skipped: feed.skipped });

/**
 * The logo's new set: skip everything Up next shows now and reshuffle with `seed`. When that
 * leaves nothing, start over with an empty skip list and the same fresh shuffle.
 */
export function nextFeedSet(input: ComposeInput, seed: number): FeedSet {
  const shown = composeFeed(input).upNext.map((v) => v.id);
  const skipped = [...new Set([...input.feed.skipped, ...shown])];
  const next = composeFeed({ ...input, feed: { ...input.feed, seed, skipped } });
  return next.upNext.length > 0 ? { seed, skipped } : { seed, skipped: [] };
}
