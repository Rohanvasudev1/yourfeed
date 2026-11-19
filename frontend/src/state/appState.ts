import { applyFeedActions, type BarMode, type FeedAction } from "../domain/assistant";
import type { BlendPartner } from "../domain/blend";
import { listKeyOf } from "../domain/feedList";
import { createFromRequest } from "../domain/newFeed";
import type { FeedSet } from "../domain/refresh";
import { appendDictation, type NoteTarget } from "../domain/notes";
import { forgetWatch, recordWatch, type SavedFolder } from "../domain/library";
import { finishCurrent, moveBackToUpNext, pinVideo, removeFromSession, startWatching } from "../domain/session";
import { isTabAction, reduceTabs, type TabAction } from "../domain/tabs";
import type { Feed, GlobalFilters, NewsCategory, Range, TopRange } from "../domain/types";
import { isBlendAction, reduceBlend, type BlendAction } from "./blend";
import { reduceLibrary, type LibraryAction } from "./library";
import { isSearchAction, reduceSearch, type SearchAction } from "./search";

export const VIEWS = ["grid", "list"] as const;
export type View = (typeof VIEWS)[number];


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
  /** Watch history, oldest first: videos played here or marked "Already watched" (the eye toggle). */
  watched: readonly string[];
  view: View;
  /** The visitor's searches, newest first, normalized. */
  recentSearches: readonly string[];
  /** The Claude bar's mode on your own feeds. Built-in feeds and drafts have a fixed mode. */
  barMode: BarMode;
  /** People the visitor has blended with, newest first; Share offers them as quick-send chips. */
  blends: readonly BlendPartner[];
}>;

export type Action =
  | TabAction
  | Readonly<{ type: "reset" }>
  | Readonly<{ type: "setView"; view: View }>
  | Readonly<{ type: "toggle_filter"; filter: keyof GlobalFilters }>
  | Readonly<{ type: "set_top_range"; feed: string; range: TopRange }>
  | Readonly<{ type: "set_news_category"; feed: string; category: NewsCategory }>
  /** Adds a topic (a channel on Subscriptions) to the feed's list, unmuting a topic that was muted. */
  | Readonly<{ type: "add_to_feed"; feed: string; item: string }>
  /** Removes a topic (a channel on Subscriptions) from the feed's list. */
  | Readonly<{ type: "remove_from_feed"; feed: string; item: string }>
  | Readonly<{ type: "mute_topic"; feed: string; topic: string }>
  | Readonly<{ type: "unmute_topic"; feed: string; topic: string }>
  /** Sets the shortest and longest video, already checked against the length limits. */
  | Readonly<{ type: "set_length_range"; feed: string; range: Range }>
  /** Sets the minimum and maximum session minutes, already checked against the session limits. */
  | Readonly<{ type: "set_session_range"; feed: string; range: Range }>
  | Readonly<{ type: "watch_video"; feed: string; video: string }>
  | Readonly<{ type: "finish_current"; feed: string }>
  | Readonly<{ type: "move_back_to_up_next"; feed: string; video: string }>
  | Readonly<{ type: "set_note"; target: NoteTarget; text: string }>
  /** Adds words heard by voice typing to the end of a note. */
  | Readonly<{ type: "add_dictation"; target: NoteTarget; heard: string }>
  /** Adds a video to the session by hand, first in Up next. */
  | Readonly<{ type: "pin_video"; feed: string; video: string }>
  /** Unpins a video and keeps it out of the feed's Up next. */
  | Readonly<{ type: "remove_from_session"; feed: string; video: string }>
  /** The eye toggle: the visitor has seen this video elsewhere, so it joins watch history. */
  | Readonly<{ type: "mark_watched"; video: string }>
  | LibraryAction
  | SearchAction
  | BlendAction
  /** Loads (or, for undo, restores) a feed set. */
  | Readonly<{ type: "set_feed_set"; set: FeedSet }>
  /** Every feed action of one Claude bar request, applied together so they make one undo step. */
  | Readonly<{ type: "apply_request"; feed: string; actions: readonly FeedAction[] }>
  /** A new-mode request (or one asked on a draft): makes a feed from its actions and opens it. */
  | Readonly<{ type: "create_from_request"; from: string; actions: readonly FeedAction[] }>
  | Readonly<{ type: "set_bar_mode"; mode: BarMode }>;

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
    if (isTabAction(action)) {
      const tabs = reduceTabs(state, action);
      return tabs.feeds === state.feeds && tabs.currentFeed === state.currentFeed ? state : { ...state, ...tabs };
    }
    if (isSearchAction(action)) return reduceSearch(state, action);
    if (isBlendAction(action)) return reduceBlend(state, action);
    switch (action.type) {
      case "reset":
        return seed;
      case "setView":
        return state.view === action.view ? state : { ...state, view: action.view };
      case "toggle_filter":
        return { ...state, filters: { ...state.filters, [action.filter]: !state.filters[action.filter] } };
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
      case "set_length_range":
        return updateFeed(state, action.feed, { length: action.range });
      case "set_session_range":
        return updateFeed(state, action.feed, { session: action.range });
      case "watch_video":
        return { ...mapFeed(state, action.feed, (f) => startWatching(f, action.video)), watched: recordWatch(state.watched, action.video) };
      case "finish_current":
        return mapFeed(state, action.feed, finishCurrent);
      case "move_back_to_up_next":
        // Moving back undoes a mis-click, so the play leaves watch history too (Everything hides watched videos).
        return { ...mapFeed(state, action.feed, (f) => moveBackToUpNext(f, action.video)), watched: forgetWatch(state.watched, action.video) };
      case "pin_video":
        return mapFeed(state, action.feed, (f) => pinVideo(f, action.video));
      case "remove_from_session":
        return mapFeed(state, action.feed, (f) => removeFromSession(f, action.video));
      case "mark_watched":
        return { ...state, watched: recordWatch(state.watched, action.video) };
      case "set_note":
        return writeNote(state, action.target, () => action.text);
      case "add_dictation":
        return writeNote(state, action.target, (note) => appendDictation(note, action.heard));
      case "set_feed_set":
        return updateFeed(state, action.set.feed, { seed: action.set.seed, skipped: action.set.skipped });
      case "apply_request":
        return mapFeed(state, action.feed, (f) => applyFeedActions(f, action.actions));
      case "create_from_request": {
        const tabs = createFromRequest(state, action.from, action.actions);
        return tabs.feeds === state.feeds ? state : { ...state, ...tabs };
      }
      case "set_bar_mode":
        return state.barMode === action.mode ? state : { ...state, barMode: action.mode };
      default:
        return reduceLibrary(state, action);
    }
  };
}

export const currentFeedOf = (state: AppState): Feed =>
  state.feeds.find((f) => f.name === state.currentFeed) ?? state.feeds[0];
