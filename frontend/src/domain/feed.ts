import { HOURS_PER_DAY, HOURS_PER_YEAR } from "./time";
import type { Feed, TopRange } from "./types";

export const DEFAULT_FEED: Feed = {
  name: "",
  kind: "topics",
  shelved: false,
  draft: false,
  color: 0,
  topRange: "year",
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

export const TOP_RANGE_HOURS: Readonly<Record<TopRange, number>> = {
  day: HOURS_PER_DAY,
  year: HOURS_PER_YEAR,
  all: Infinity,
};
