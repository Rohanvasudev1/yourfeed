import type { Feed, GlobalFilters } from "../domain/types";
import type { Action, AppState } from "./appState";

/** Most steps kept each way. */
export const UNDO_LIMIT = 10;

const FEED_SETTING_KEYS = ["topics", "channels", "muted", "length", "session"] as const;
type FeedSettings = Pick<Feed, (typeof FEED_SETTING_KEYS)[number]>;

/** What undo covers: every feed's topics, channels, mutes and ranges, plus the global filters. Sessions, sets and tabs are left alone. */
type Settings = Readonly<{ feeds: ReadonlyMap<string, FeedSettings>; filters: GlobalFilters }>;

/** The settings to go back (or forward) to, and the feed to open so the change is on screen. */
type Step = Readonly<{ settings: Settings; feed: string }>;

/** App state plus its undo and redo steps, newest last. The steps live in memory only; a reload starts with none. */
export type History = Readonly<{ present: AppState; undo: readonly Step[]; redo: readonly Step[] }>;

export type HistoryAction = Action | Readonly<{ type: "undo" }> | Readonly<{ type: "redo" }>;

export const startHistory = (present: AppState): History => ({ present, undo: [], redo: [] });

const feedSettingsOf = (feed: Feed): FeedSettings =>
  Object.fromEntries(FEED_SETTING_KEYS.map((key) => [key, feed[key]])) as FeedSettings;

const settingsOf = (state: AppState): Settings => ({
  feeds: new Map(state.feeds.map((f) => [f.name, feedSettingsOf(f)])),
  filters: state.filters,
});

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The feed whose settings differ between `before` and `after`, the open feed when only the
 * filters differ, or null when nothing undo covers changed. Feeds added, removed or renamed
 * in between don't count.
 */
function changedFeed(before: Settings, after: Settings, current: string): string | null {
  for (const [name, settings] of after.feeds) {
    const old = before.feeds.get(name);
    if (old && !same(old, settings)) return name;
  }
  return same(before.filters, after.filters) ? null : current;
}

function applySettings(state: AppState, { settings, feed }: Step): AppState {
  const feeds = state.feeds.map((f) => {
    const saved = settings.feeds.get(f.name);
    return saved ? { ...f, ...saved } : f;
  });
  return {
    ...state,
    feeds,
    filters: settings.filters,
    currentFeed: feeds.some((f) => f.name === feed) ? feed : state.currentFeed,
  };
}

const push = (steps: readonly Step[], step: Step) => [...steps, step].slice(-UNDO_LIMIT);

/** Moves the newest step from `from` onto the state, recording the way back on `to`. */
function travel(present: AppState, from: readonly Step[], to: readonly Step[]) {
  const step = from.at(-1);
  if (!step) return null;
  return {
    present: applySettings(present, step),
    from: from.slice(0, -1),
    to: push(to, { settings: settingsOf(present), feed: step.feed }),
  };
}

/** Wraps the app reducer so every change to feed settings or filters becomes an undo step, and a new change clears redo. */
export function withHistory(reduce: (state: AppState, action: Action) => AppState) {
  return (history: History, action: HistoryAction): History => {
    switch (action.type) {
      case "undo": {
        const moved = travel(history.present, history.undo, history.redo);
        return moved ? { present: moved.present, undo: moved.from, redo: moved.to } : history;
      }
      case "redo": {
        const moved = travel(history.present, history.redo, history.undo);
        return moved ? { present: moved.present, undo: moved.to, redo: moved.from } : history;
      }
      case "reset":
        return startHistory(reduce(history.present, action));
      default: {
        const present = reduce(history.present, action);
        if (present === history.present) return history;
        const before = settingsOf(history.present);
        const feed = changedFeed(before, settingsOf(present), history.present.currentFeed);
        if (feed === null) return { ...history, present };
        return { present, undo: push(history.undo, { settings: before, feed }), redo: [] };
      }
    }
  };
}
