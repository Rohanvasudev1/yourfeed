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
  note: "",
  connected: false,
  partner: null,
  log: [],
  behaviour: [],
  dismissed: [],
  exploreSlot: true,
};

export const makeFeed = (overrides: Partial<Feed> = {}): Feed => ({ ...DEFAULT_FEED, ...overrides });

export const TOP_RANGE_HOURS: Readonly<Record<TopRange, number>> = {
  day: HOURS_PER_DAY,
  year: HOURS_PER_YEAR,
  all: Infinity,
};

/** Built-in feeds can be shelved but never deleted; only `topics` feeds are the visitor's own. */
export const isBuiltIn = (feed: Feed): boolean => feed.kind !== "topics";

/** Built-in feeds other than Home share the one Explore button in the tab bar. */
export const isInExplore = (feed: Feed): boolean => isBuiltIn(feed) && feed.kind !== "home";
