import type { Feed, FeedKind, GlobalFilters } from "./types";

/** Subscriptions lists channels; every other feed lists topics. */
export type ListKey = "topics" | "channels";

export const listKeyOf = (feed: Feed): ListKey => (feed.kind === "subs" ? "channels" : "topics");

/** Every feed kind except News has a topic (or channel) list the settings line can edit. */
export type ListedKind = Exclude<FeedKind, "news">;
export type ListedFeed = Feed & Readonly<{ kind: ListedKind }>;
export const hasItemList = (feed: Feed): feed is ListedFeed => feed.kind !== "news";

/**
 * The feed's topics or channels that aren't muted. Muting a topic keeps it in `topics`, so
 * unmuting brings it back. `muted` holds topics only, so it never filters channels.
 */
export const activeItems = (feed: Feed): readonly string[] =>
  listKeyOf(feed) === "channels" ? feed.channels : feed.topics.filter((topic) => !feed.muted.includes(topic));

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** What the settings line says the feed shows, worded for its kind. */
export function topicsPhrase(feed: Feed): string {
  const n = activeItems(feed).length;
  const what = (() => {
    switch (feed.kind) {
      case "subs":
        return plural(n, "channel");
      case "home":
        return n ? plural(n, "boosted topic") : "no boosted topics";
      case "top":
        return n ? plural(n, "topic") : "all topics";
      case "news":
        return feed.newsCategory === "All" ? "all news" : `${feed.newsCategory} news`;
      case "claude":
      case "topics":
        return plural(n, "topic");
    }
  })();
  const hidden = feed.kind === "news" ? 0 : feed.muted.length;
  return hidden ? `${what}, ${hidden} hidden` : what;
}

export function filtersPhrase(filters: GlobalFilters): string {
  const on = Object.values(filters).filter(Boolean).length;
  return on ? `${plural(on, "filter")} on` : "no filters";
}

/** Capitalises a typed topic the way topics are written; channel names are kept as typed. */
export const normaliseItem = (key: ListKey, typed: string): string => {
  const trimmed = typed.trim();
  return key === "channels" ? trimmed : trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

export const includesIgnoringCase = (items: readonly string[], item: string): boolean =>
  items.some((x) => x.toLowerCase() === item.toLowerCase());
