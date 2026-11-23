import type { Feed, FeedKind, GlobalFilters } from "./types";

/** Subscriptions lists channels; every other feed lists topics. */
export type ListKey = "topics" | "channels";

export const listKeyOf = (feed: Feed): ListKey => (feed.kind === "subs" ? "channels" : "topics");

/** Every feed kind except News and Shared with you has a topic (or channel) list the settings line can edit. */
export type ListedKind = Exclude<FeedKind, "news" | "shared">;
export type ListedFeed = Feed & Readonly<{ kind: ListedKind }>;
export const hasItemList = (feed: Feed): feed is ListedFeed => feed.kind !== "news" && feed.kind !== "shared";

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
      case "blend":
      case "shared":
      case "topics":
        return plural(n, "topic");
    }
  })();
  const hidden = feed.kind === "news" ? 0 : feed.muted.length;
  return hidden ? `${what}, ${hidden} hidden` : what;
}

/** Filters that need the demo catalog's AI tags; the real catalog has none, so there they're off (ADR 0011). */
export const DEMO_ONLY_FILTERS: readonly (keyof GlobalFilters)[] = ["hideClickbait", "honestTitles"];

/** Whether `filter` does anything on this catalog. */
export const filterApplies = (filter: keyof GlobalFilters, realCatalog: boolean): boolean => !realCatalog || !DEMO_ONLY_FILTERS.includes(filter);

/** How many filters are on, counting only those that apply to this catalog. */
export function filtersPhrase(filters: GlobalFilters, realCatalog: boolean): string {
  const on = (Object.keys(filters) as (keyof GlobalFilters)[]).filter((f) => filters[f] && filterApplies(f, realCatalog)).length;
  return on ? `${plural(on, "filter")} on` : "no filters";
}

/** Capitalises a typed topic the way topics are written; channel names are kept as typed. */
export const normaliseItem = (key: ListKey, typed: string): string => {
  const trimmed = typed.trim();
  return key === "channels" ? trimmed : trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

export const includesIgnoringCase = (items: readonly string[], item: string): boolean =>
  items.some((x) => x.toLowerCase() === item.toLowerCase());
