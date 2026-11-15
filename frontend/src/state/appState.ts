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
  | Readonly<{ type: "open_feed"; feed: string }>
  | Readonly<{ type: "set_top_range"; feed: string; range: TopRange }>
  | Readonly<{ type: "set_news_category"; feed: string; category: NewsCategory }>;

const updateFeed = (state: AppState, name: string, changes: Partial<Feed>): AppState => ({
  ...state,
  feeds: state.feeds.map((f) => (f.name === name ? { ...f, ...changes } : f)),
});

/** Builds the app reducer; `reset` returns to `seed`. Actions naming a feed that doesn't exist change nothing. */
export function makeReducer(seed: AppState) {
  return (state: AppState, action: Action): AppState => {
    switch (action.type) {
      case "reset":
        return seed;
      case "open_feed":
        return state.feeds.some((f) => f.name === action.feed) ? { ...state, currentFeed: action.feed } : state;
      case "set_top_range":
        return updateFeed(state, action.feed, { topRange: action.range });
      case "set_news_category":
        return updateFeed(state, action.feed, { newsCategory: action.category });
    }
  };
}

export const currentFeedOf = (state: AppState): Feed =>
  state.feeds.find((f) => f.name === state.currentFeed) ?? state.feeds[0];
