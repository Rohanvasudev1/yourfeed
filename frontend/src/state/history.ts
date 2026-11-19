import type { Feed, GlobalFilters } from "../domain/types";
import type { Action, AppState } from "./appState";

/** Most steps kept each way. */
export const UNDO_LIMIT = 10;

const FEED_SETTING_KEYS = ["topics", "channels", "muted", "length", "session", "partner"] as const;
type FeedSettings = Pick<Feed, (typeof FEED_SETTING_KEYS)[number]>;

/**
 * What undo covers: every feed's topics, channels, mutes and ranges, a Blend's partner (its topics come from it), plus the
 * global filters. Sessions, sets, tabs and the list of blends are left alone.
 */
type Settings = Readonly<{ feeds: ReadonlyMap<string, FeedSettings>; filters: GlobalFilters }>;

const RANGE_KEYS = ["length", "session"] as const;
type RangeKey = (typeof RANGE_KEYS)[number];

/**
 * The settings to go back (or forward) to, and the feed to open so the change is on screen.
 * `range` names the one range the change moved, when that was all it changed.
 */
type Step = Readonly<{ settings: Settings; feed: string; range?: RangeKey }>;

/** Where a change landed: its feed, and the range it moved when that was all it changed. */
type Change = Readonly<{ feed: string; range?: RangeKey }>;

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

/** Value equality for plain settings data (string lists, ranges, filter flags). */
const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const onlyRangeChanged = (old: FeedSettings, settings: FeedSettings): RangeKey | undefined => {
  const changed = FEED_SETTING_KEYS.filter((key) => !sameValue(old[key], settings[key]));
  const [key] = changed;
  return changed.length === 1 ? RANGE_KEYS.find((range) => range === key) : undefined;
};

/**
 * The feed whose settings differ between `before` and `after`, the open feed when only the
 * filters differ, or null when nothing undo covers changed. Feeds added, removed or renamed
 * in between don't count.
 */
function changeBetween(before: Settings, after: Settings, current: string): Change | null {
  for (const [name, settings] of after.feeds) {
    const old = before.feeds.get(name);
    if (old && !sameValue(old, settings)) return { feed: name, range: onlyRangeChanged(old, settings) };
  }
  return sameValue(before.filters, after.filters) ? null : { feed: current };
}

/**
 * A slider sends a change for every value it passes, so moving the same range on the same feed
 * again, with nothing in between, extends the newest step instead of adding one.
 */
const extendsNewestStep = (history: History, change: Change) => {
  const newest = history.undo.at(-1);
  return history.redo.length === 0 && change.range !== undefined && newest?.feed === change.feed && newest.range === change.range;
};

/** A Claude bar request is always a step of its own: it never extends a slider's step, and a slider never extends it. */
const asOwnStep = (action: Action, change: Change | null): Change | null =>
  change && action.type === "apply_request" ? { feed: change.feed } : change;

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

/** Adds a step, dropping the oldest past the limit. */
const pushCapped = (steps: readonly Step[], step: Step) => [...steps, step].slice(-UNDO_LIMIT);

/** Moves the newest step from `from` onto the state, recording the way back on `to`. */
function travel(present: AppState, from: readonly Step[], to: readonly Step[]) {
  const step = from.at(-1);
  if (!step) return null;
  return {
    present: applySettings(present, step),
    from: from.slice(0, -1),
    to: pushCapped(to, { settings: settingsOf(present), feed: step.feed }),
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
        const change = asOwnStep(action, changeBetween(before, settingsOf(present), history.present.currentFeed));
        if (change === null || extendsNewestStep(history, change)) return { ...history, present };
        return { present, undo: pushCapped(history.undo, { settings: before, ...change }), redo: [] };
      }
    }
  };
}
