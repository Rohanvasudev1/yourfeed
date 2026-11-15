import type { GlobalFilters, Feed } from "../domain/types";

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

export type Action = Readonly<{ type: "reset" }>;

/** Builds the app reducer; `reset` returns to `seed`. */
export function makeReducer(seed: AppState) {
  return (_state: AppState, action: Action): AppState => {
    switch (action.type) {
      case "reset":
        return seed;
    }
  };
}

export const currentFeedOf = (state: AppState): Feed =>
  state.feeds.find((f) => f.name === state.currentFeed) ?? state.feeds[0];
