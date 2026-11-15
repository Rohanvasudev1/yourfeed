export type Video = Readonly<{
  id: string;
  title: string;
  honestTitle: string;
  channel: string;
  channelSubscribers: number;
  topic: string;
  minutes: number;
  views: number;
  ageHours: number;
  clickbait: boolean;
  live: boolean;
  newsCategory: string | null;
}>;

export type FeedKind = "home" | "subs" | "top" | "news" | "claude" | "topics";

export type Range = readonly [min: number, max: number];

export type Feed = Readonly<{
  kind: FeedKind;
  topics: readonly string[];
  channels: readonly string[];
  /** Video length bounds in minutes. */
  length: Range;
  /** Total minutes for one sitting; only the max limits Up next. */
  session: Range;
  muted: readonly string[];
  pinned: readonly string[];
  removed: readonly string[];
  skipped: readonly string[];
  finished: readonly string[];
  current: string | null;
  newsCategory: NewsCategory;
  seed: number;
}>;

export const NEWS_CATEGORIES = ["All", "World", "Business", "Tech", "Science"] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export type GlobalFilters = Readonly<{
  hideClickbait: boolean;
  boostSmallCreators: boolean;
  includeShorts: boolean;
}>;

export type ComposeInput = Readonly<{
  catalog: readonly Video[];
  feed: Feed;
  filters: GlobalFilters;
  /** Videos marked watched anywhere (the eye toggle). */
  watched: readonly string[];
  /** Max age in hours for Most viewed. */
  topMaxAgeHours: number;
}>;

export type Composition = Readonly<{
  upNext: readonly Video[];
  hidden: number;
  usedMinutes: number;
}>;
