import { listKeyOf } from "../domain/feedList";
import type { FeedSet } from "../domain/refresh";
import { appendDictation, type NoteTarget } from "../domain/notes";
import { finishCurrent, moveBackToUpNext, startWatching } from "../domain/session";
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
  | Readonly<{ type: "unmute_topic"; feed: string; topic: string }>
  | Readonly<{ type: "watch_video"; feed: string; video: string }>
  | Readonly<{ type: "finish_current"; feed: string }>
  | Readonly<{ type: "move_back_to_up_next"; feed: string; video: string }>
  | Readonly<{ type: "set_note"; target: NoteTarget; text: string }>
  /** Adds words heard by voice typing to the end of a note. */
  | Readonly<{ type: "add_dictation"; target: NoteTarget; heard: string }>
  /** Loads (or, for undo, restores) a feed set. */
  | Readonly<{ type: "set_feed_set"; set: FeedSet }>;

const mapFeed = (state: AppState, name: string, change: (feed: Feed) => Feed): AppState => ({
  ...state,
  feeds: state.feeds.map((f) => (f.name === name ? change(f) : f)),
});

const updateFeed = (state: AppState, name: string, changes: Partial<Feed>): AppState =>
  mapFeed(state, name, (f) => ({ ...f, ...changes }));

const writeNote = (state: AppState, target: NoteTarget, write: (note: string) => string): AppState =>
  "video" in target
    ? { ...state, notes: { ...state.notes, [target.video]: write(state.notes[target.video] ?? "") } }
    : mapFeed(state, target.feed, (f) => ({ ...f, note: write(f.note) }));

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
        return mapFeed(state, action.feed, (f) =>
          listKeyOf(f) === "channels"
            ? { ...f, channels: withItem(f.channels, action.item) }
            : { ...f, topics: withItem(f.topics, action.item), muted: without(f.muted, action.item) },
        );
      case "remove_from_feed":
        return mapFeed(state, action.feed, (f) =>
          listKeyOf(f) === "channels" ? { ...f, channels: without(f.channels, action.item) } : { ...f, topics: without(f.topics, action.item) },
        );
      case "mute_topic":
        return mapFeed(state, action.feed, (f) => ({ ...f, muted: withItem(f.muted, action.topic) }));
      case "unmute_topic":
        return mapFeed(state, action.feed, (f) => ({ ...f, muted: without(f.muted, action.topic) }));
      case "watch_video":
        return mapFeed(state, action.feed, (f) => startWatching(f, action.video));
      case "finish_current":
        return mapFeed(state, action.feed, finishCurrent);
      case "move_back_to_up_next":
        return mapFeed(state, action.feed, (f) => moveBackToUpNext(f, action.video));
      case "set_note":
        return writeNote(state, action.target, () => action.text);
      case "add_dictation":
        return writeNote(state, action.target, (note) => appendDictation(note, action.heard));
      case "set_feed_set":
        return updateFeed(state, action.set.feed, { seed: action.set.seed, skipped: action.set.skipped });
    }
  };
}

export const currentFeedOf = (state: AppState): Feed =>
  state.feeds.find((f) => f.name === state.currentFeed) ?? state.feeds[0];
