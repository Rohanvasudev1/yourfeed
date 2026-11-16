import { listKeyOf } from "../domain/feedList";
import type { Feed, GlobalFilters, NewsCategory, TopRange } from "../domain/types";

export const VIEWS = ["grid", "list"] as const;
export type View = (typeof VIEWS)[number];

export type SavedFolder = Readonly<{ name: string; videoIds: readonly string[] }>;

/** The whole app's state. Only `reduce` changes it, and only by returning a new object. */
export type AppState = Readonly<{
  /** Every feed, in tab order. Names are unique. */
  feeds: readonly Feed[];
  /** Name of the open feed. */
  currentFeed: string;
  filters: GlobalFilters;
  /** Free-text notes by video id. */
  notes: Readonly<Record<string, string>>;
  folders: readonly SavedFolder[];
  /** Videos marked "Already watched" (the eye toggle). */
  watched: readonly string[];
  view: View;
}>;

export type Action =
  | Readonly<{ type: "reset" }>
  | Readonly<{ type: "setView"; view: View }>
  | Readonly<{ type: "open_feed"; feed: string }>
  | Readonly<{ type: "set_top_range"; feed: string; range: TopRange }>
  | Readonly<{ type: "set_news_category"; feed: string; category: NewsCategory }>
  /** Adds a topic (a channel on Subscriptions) to the feed's list, unmuting a topic that was muted. */
  | Readonly<{ type: "add_to_feed"; feed: string; item: string }>
  /** Removes a topic (a channel on Subscriptions) from the feed's list. */
  | Readonly<{ type: "remove_from_feed"; feed: string; item: string }>
  | Readonly<{ type: "mute_topic"; feed: string; topic: string }>
  | Readonly<{ type: "unmute_topic"; feed: string; topic: string }>;

const updateFeed = (state: AppState, name: string, changes: Partial<Feed> | ((feed: Feed) => Partial<Feed>)): AppState => ({
  ...state,
  feeds: state.feeds.map((f) => (f.name === name ? { ...f, ...(typeof changes === "function" ? changes(f) : changes) } : f)),
});

const without = (items: readonly string[], item: string) => items.filter((x) => x !== item);
const withItem = (items: readonly string[], item: string) => (items.includes(item) ? items : [...items, item]);

/** Builds the app reducer; `reset` returns to `seed`. Actions naming a feed that doesn't exist change nothing. */
export function makeReducer(seed: AppState) {
  return (state: AppState, action: Action): AppState => {
    switch (action.type) {
      case "reset":
        return seed;
      case "setView":
        return state.view === action.view ? state : { ...state, view: action.view };
      case "open_feed":
        return state.feeds.some((f) => f.name === action.feed) ? { ...state, currentFeed: action.feed } : state;
      case "set_top_range":
        return updateFeed(state, action.feed, { topRange: action.range });
      case "set_news_category":
        return updateFeed(state, action.feed, { newsCategory: action.category });
      case "add_to_feed":
        return updateFeed(state, action.feed, (f) =>
          listKeyOf(f) === "channels"
            ? { channels: withItem(f.channels, action.item) }
            : { topics: withItem(f.topics, action.item), muted: without(f.muted, action.item) },
        );
      case "remove_from_feed":
        return updateFeed(state, action.feed, (f) =>
          listKeyOf(f) === "channels" ? { channels: without(f.channels, action.item) } : { topics: without(f.topics, action.item) },
        );
      case "mute_topic":
        return updateFeed(state, action.feed, (f) => ({ muted: withItem(f.muted, action.topic) }));
      case "unmute_topic":
        return updateFeed(state, action.feed, (f) => ({ muted: without(f.muted, action.topic) }));
    }
  };
}

export const currentFeedOf = (state: AppState): Feed =>
  state.feeds.find((f) => f.name === state.currentFeed) ?? state.feeds[0];
