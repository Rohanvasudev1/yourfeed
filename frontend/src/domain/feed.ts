import type { Feed } from "./types";

export const DEFAULT_FEED: Feed = {
  kind: "topics",
  topics: [],
  channels: [],
  length: [1, 120],
  session: [10, 240],
  muted: [],
  pinned: [],
  removed: [],
  skipped: [],
  finished: [],
  current: null,
  newsCategory: "All",
  seed: 0,
};

export const makeFeed = (overrides: Partial<Feed> = {}): Feed => ({ ...DEFAULT_FEED, ...overrides });
