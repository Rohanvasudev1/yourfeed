import type { Blend } from "./blend";

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

export const FEED_KINDS = ["home", "subs", "top", "news", "claude", "blend", "topics"] as const;
export type FeedKind = (typeof FEED_KINDS)[number];

export type Range = readonly [min: number, max: number];

export const TOP_RANGES = ["day", "year", "all"] as const;
/** Most viewed's time range: last 24 hours, last year or all time. */
export type TopRange = (typeof TOP_RANGES)[number];

export type Feed = Readonly<{
  /** Unique across feeds (ignoring case); also the tab label. */
  name: string;
  kind: FeedKind;
  /** Moved off the tab bar into All tabs. */
  shelved: boolean;
  /** A new feed the user hasn't named or filled yet. */
  draft: boolean;
  /** Index into the feed colour palette. */
  color: number;
  topRange: TopRange;
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
  /** The visitor's note on the whole feed, shown in Feed notes. */
  note: string;
  /** Blend only: who the visitor invited or blends with, or null before an invite. */
  partner: Blend | null;
}>;

export const NEWS_CATEGORIES = ["All", "World", "Business", "Tech", "Science"] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

/** The global filters composition reads. */
export type CompositionFilters = Readonly<{
  hideClickbait: boolean;
  boostSmallCreators: boolean;
  includeShorts: boolean;
}>;

/** All six global filters: the ones composition reads plus the ones that only change how cards look. */
export type GlobalFilters = CompositionFilters &
  Readonly<{
    honestTitles: boolean;
    hideViewCounts: boolean;
    hideSubscriberCounts: boolean;
  }>;

export type ComposeInput = Readonly<{
  catalog: readonly Video[];
  feed: Feed;
  filters: CompositionFilters;
  /** Videos marked watched anywhere (the eye toggle). */
  watched: readonly string[];
  /** Max age in hours for Most viewed. */
  topMaxAgeHours: number;
  /** The topics of the visitor's own feeds; a blend puts them against its partner's. */
  myTopics: readonly string[];
}>;

export type Composition = Readonly<{
  upNext: readonly Video[];
  hidden: number;
  usedMinutes: number;
}>;
