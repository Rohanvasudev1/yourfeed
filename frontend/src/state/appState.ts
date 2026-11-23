import { insertAnswer } from "../domain/askNotes";
import { applyFeedActions, type BarMode, type FeedAction } from "../domain/assistant";
import { bringRecipes, type DemoRecipe } from "../domain/demoFeeds";
import { forgetSignals, recordSignals, withBehaviour, withSessionSignals, type Forget } from "../domain/behaviour";
import type { BlendPartner } from "../domain/blend";
import { listKeyOf } from "../domain/feedList";
import { withClaudeConnection } from "../domain/fromClaude";
import { dismissProposal } from "../domain/mirror";
import { createFromRequest } from "../domain/newFeed";
import { appendLine, type NewLine } from "../domain/recipeLog";
import type { FeedSet } from "../domain/refresh";
import { appendDictation, type NoteTarget } from "../domain/notes";
import type { Inbox } from "../domain/inbox";
import { forgetWatch, recordWatch, type SavedFolder } from "../domain/library";
import { finishCurrent, moveBackToUpNext, pinVideo, removeFromSession, startWatching } from "../domain/session";
import { isTabAction, reduceTabs, type TabAction } from "../domain/tabs";
import type { Feed, GlobalFilters, NewsCategory, Range, TopRange } from "../domain/types";
import { isBlendAction, reduceBlend, type BlendAction } from "./blend";
import { closeShareOnLeave, isInboxAction, reduceInbox, type InboxAction } from "./inbox";
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
  /** Shared with you. */
  inbox: Inbox;
  /** Whether a request or note question has gone to the assistant yet; until then the provider notice shows under the Claude bar. */
  providerNoticeSeen: boolean;
  /** Whether Bring your demo feeds has been offered; a new signed-in account is offered it once (ADR 0012). */
  demoFeedsOffered: boolean;
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
  /** Session changes carry when they happened (`at`, ms), so the feed's behaviour record can timestamp them. */
  | Readonly<{ type: "watch_video"; feed: string; video: string; at: number }>
  | Readonly<{ type: "finish_current"; feed: string; at: number }>
  | Readonly<{ type: "move_back_to_up_next"; feed: string; video: string }>
  | Readonly<{ type: "set_note"; target: NoteTarget; text: string }>
  /** Adds words heard by voice typing to the end of a note. */
  | Readonly<{ type: "add_dictation"; target: NoteTarget; heard: string }>
  /** Puts an answer under its question in a video's notes; nothing changes if the question is gone. */
  | Readonly<{ type: "insert_answer"; video: string; question: string; answer: string }>
  /** Adds a video to the session by hand, first in Up next. */
  | Readonly<{ type: "pin_video"; feed: string; video: string; at: number }>
  /** Unpins a video and keeps it out of the feed's Up next. */
  | Readonly<{ type: "remove_from_session"; feed: string; video: string; at: number }>
  /** The eye toggle: the visitor has seen this video elsewhere, so it joins watch history (and the feed's behaviour). */
  | Readonly<{ type: "mark_watched"; feed: string; video: string; at: number }>
  /** A session ended (the logo's new set, or leaving the page) with these Up next videos passed over: they're recorded skipped. */
  | Readonly<{ type: "end_session"; feed: string; videos: readonly string[]; at: number }>
  /** Undoing the logo's new set forgets the skips it recorded at `at`. */
  | Readonly<{ type: "forget_skips"; feed: string; at: number }>
  | LibraryAction
  | SearchAction
  | BlendAction
  | InboxAction
  /** Loads (or, for undo, restores) a feed set. */
  | Readonly<{ type: "set_feed_set"; set: FeedSet }>
  /**
   * Every feed action of one Claude bar request (or question card answer), applied together so they make one undo step,
   * and its line in the feed's recipe log, which that undo step greys out.
   */
  | Readonly<{ type: "apply_request"; feed: string; actions: readonly FeedAction[]; line: NewLine }>
  /** A new-mode request (or one asked on a draft): makes a feed from its actions, starts its log with `line`, and opens it. */
  | Readonly<{ type: "create_from_request"; from: string; actions: readonly FeedAction[]; line: NewLine }>
  /** Hides a recipe mirror proposal on a feed for 7 days from `at`. */
  | Readonly<{ type: "dismiss_proposal"; feed: string; proposal: string; at: number }>
  /** Empties a feed's recipe log; the feed and its undo steps stay as they are. */
  | Readonly<{ type: "clear_log"; feed: string }>
  | Readonly<{ type: "set_bar_mode"; mode: BarMode }>
  /** A request or note question went to the assistant, so the provider notice moves to the account menu only. */
  | Readonly<{ type: "see_provider_notice" }>
  /** Answers Bring your demo feeds: copies `recipes` (none on No thanks), and the offer is never made again. */
  | Readonly<{ type: "answer_demo_offer"; recipes: readonly DemoRecipe[] }>
  /** Connects From Claude (filling its topics from the summary) or disconnects it (clearing them). */
  | Readonly<{ type: "set_claude_connection"; feed: string; connected: boolean }>;

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

/** A session change on one feed, with whatever it did recorded in the feed's behaviour. */
const sessionChange = (state: AppState, name: string, at: number, change: (feed: Feed) => Feed): AppState =>
  mapFeed(state, name, (f) => withSessionSignals(f, change(f), at));

/** Forgetting watch history forgets the watched signals it put in every feed's behaviour. */
const forgetEverywhere = (state: AppState, forget: Forget): AppState => ({
  ...state,
  feeds: state.feeds.map((f) => withBehaviour(f, (record) => forgetSignals(record, forget))),
});

const without = (items: readonly string[], item: string) => items.filter((x) => x !== item);
const withItem = (items: readonly string[], item: string) => (items.includes(item) ? items : [...items, item]);

/** Builds the app reducer; `reset` returns to `seed`. Actions naming a feed that doesn't exist change nothing. */
export function makeReducer(seed: AppState) {
  return (state: AppState, action: Action): AppState => {
    if (isTabAction(action)) {
      const tabs = reduceTabs(state, action);
      return tabs.feeds === state.feeds && tabs.currentFeed === state.currentFeed ? state : closeShareOnLeave(state, { ...state, ...tabs });
    }
    if (isSearchAction(action)) return reduceSearch(state, action);
    if (isBlendAction(action)) return reduceBlend(state, action);
    if (isInboxAction(action)) return closeShareOnLeave(state, reduceInbox(state, action));
    switch (action.type) {
      case "reset":
        // Starting over doesn't make the one-time offer again.
        return { ...seed, demoFeedsOffered: state.demoFeedsOffered };
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
        return { ...sessionChange(state, action.feed, action.at, (f) => startWatching(f, action.video)), watched: recordWatch(state.watched, action.video) };
      case "finish_current":
        return sessionChange(state, action.feed, action.at, finishCurrent);
      case "move_back_to_up_next":
        // Moving back undoes a mis-click, so the play leaves watch history and the feed's behaviour too (Everything hides watched videos).
        return {
          ...mapFeed(state, action.feed, (f) => ({
            ...moveBackToUpNext(f, action.video),
            behaviour: forgetSignals(f.behaviour, { kinds: ["watched", "finished"], video: action.video }),
          })),
          watched: forgetWatch(state.watched, action.video),
        };
      case "pin_video":
        return sessionChange(state, action.feed, action.at, (f) => pinVideo(f, action.video));
      case "remove_from_session":
        return sessionChange(state, action.feed, action.at, (f) => removeFromSession(f, action.video));
      case "mark_watched":
        return {
          ...mapFeed(state, action.feed, (f) => withBehaviour(f, (record) => recordSignals(record, "watched", [action.video], action.at))),
          watched: recordWatch(state.watched, action.video),
        };
      case "end_session":
        return mapFeed(state, action.feed, (f) => withBehaviour(f, (record) => recordSignals(record, "skipped", action.videos, action.at)));
      case "forget_skips":
        return mapFeed(state, action.feed, (f) => withBehaviour(f, (record) => forgetSignals(record, { kinds: ["skipped"], at: action.at })));
      case "set_note":
        return writeNote(state, action.target, () => action.text);
      case "add_dictation":
        return writeNote(state, action.target, (note) => appendDictation(note, action.heard));
      case "insert_answer": {
        const note = insertAnswer(state.notes[action.video] ?? "", action.question, action.answer);
        return note === null ? state : { ...state, notes: { ...state.notes, [action.video]: note } };
      }
      case "set_feed_set":
        return updateFeed(state, action.set.feed, { seed: action.set.seed, skipped: action.set.skipped });
      case "apply_request":
        return mapFeed(state, action.feed, (f) => ({ ...applyFeedActions(f, action.actions), log: appendLine(f.log, action.line) }));
      case "dismiss_proposal":
        return mapFeed(state, action.feed, (f) => ({ ...f, dismissed: dismissProposal(f.dismissed, action.proposal, action.at) }));
      case "clear_log":
        return mapFeed(state, action.feed, (f) => (f.log.length === 0 ? f : { ...f, log: [] }));
      case "set_claude_connection":
        return mapFeed(state, action.feed, (f) => (f.kind === "claude" ? withClaudeConnection(f, action.connected) : f));
      case "create_from_request": {
        const tabs = createFromRequest(state, action.from, action.actions);
        if (tabs.feeds === state.feeds) return state;
        return mapFeed({ ...state, ...tabs }, tabs.currentFeed, (f) => ({ ...f, log: appendLine(f.log, action.line) }));
      }
      case "set_bar_mode":
        return state.barMode === action.mode ? state : { ...state, barMode: action.mode };
      case "see_provider_notice":
        return state.providerNoticeSeen ? state : { ...state, providerNoticeSeen: true };
      case "answer_demo_offer":
        return state.demoFeedsOffered ? state : { ...state, feeds: bringRecipes(state.feeds, action.recipes), demoFeedsOffered: true };
      case "forget_watch":
        return reduceLibrary(forgetEverywhere(state, { kinds: ["watched"], video: action.video }), action);
      case "clear_history":
        return reduceLibrary(forgetEverywhere(state, { kinds: ["watched"], all: true }), action);
      default:
        return reduceLibrary(state, action);
    }
  };
}

export const currentFeedOf = (state: AppState): Feed =>
  state.feeds.find((f) => f.name === state.currentFeed) ?? state.feeds[0];
