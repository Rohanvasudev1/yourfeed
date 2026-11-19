import { makeFeed } from "../domain/feed";
import { savedFeedName, type Inbox, type InboxShare } from "../domain/inbox";
import { fitsInBar, uniqueName } from "../domain/tabs";
import type { Feed } from "../domain/types";

/** Changes to Shared with you. None is a feed setting, so none becomes an undo step. */
export type InboxAction =
  /** Adds a share unless one with its id is already there. */
  | Readonly<{ type: "receive_share"; share: InboxShare }>
  /** Opens a share in the Shared with you feed and marks it read. */
  | Readonly<{ type: "open_share"; id: string }>
  /** Back to the inbox. */
  | Readonly<{ type: "close_share" }>
  | Readonly<{ type: "remove_share"; id: string }>
  /** Makes a share one of your own feeds and opens it. */
  | Readonly<{ type: "save_share"; id: string }>;

type WithInbox = Readonly<{ feeds: readonly Feed[]; currentFeed: string; inbox: Inbox }>;

const INBOX_ACTION_TYPES: ReadonlySet<string> = new Set<InboxAction["type"]>([
  "receive_share",
  "open_share",
  "close_share",
  "remove_share",
  "save_share",
]);

export const isInboxAction = (action: { type: string }): action is InboxAction => INBOX_ACTION_TYPES.has(action.type);

/** A share's own session: what was watched in another share doesn't follow it. */
const freshSession = { finished: [], current: null, pinned: [], removed: [] } satisfies Partial<Feed>;

const withSharedSession = <S extends WithInbox>(state: S, changes: Partial<Feed>): S => ({
  ...state,
  feeds: state.feeds.map((f) => (f.kind === "shared" ? { ...f, ...changes } : f)),
});

function openShare<S extends WithInbox>(state: S, id: string): S {
  const { inbox } = state;
  if (!inbox.shares.some((s) => s.id === id)) return state;
  const shares = inbox.shares.map((s) => (s.id === id && s.unread ? { ...s, unread: false } : s));
  const opened = { ...state, inbox: { shares, open: id, sessionShare: id } };
  return inbox.sessionShare === id ? opened : withSharedSession(opened, freshSession);
}

function removeShare<S extends WithInbox>(state: S, id: string): S {
  const { inbox } = state;
  if (!inbox.shares.some((s) => s.id === id)) return state;
  const shares = inbox.shares.filter((s) => s.id !== id);
  const ownedSession = inbox.sessionShare === id;
  const removed = { ...state, inbox: { shares, open: inbox.open === id ? null : inbox.open, sessionShare: ownedSession ? null : inbox.sessionShare } };
  return ownedSession ? withSharedSession(removed, freshSession) : removed;
}

function saveShare<S extends WithInbox>(state: S, id: string): S {
  const share = state.inbox.shares.find((s) => s.id === id);
  if (!share) return state;
  const name = uniqueName(state.feeds, savedFeedName(share));
  const feed = makeFeed({ name, pinned: share.videos, color: state.feeds.length });
  // Shelved when the tab bar has no room, like a new feed.
  const saved = { ...feed, shelved: !fitsInBar([...state.feeds, feed], name) };
  return { ...state, feeds: [...state.feeds, saved], currentFeed: name };
}

export function reduceInbox<S extends WithInbox>(state: S, action: InboxAction): S {
  const { inbox } = state;
  switch (action.type) {
    case "receive_share":
      return inbox.shares.some((s) => s.id === action.share.id) ? state : { ...state, inbox: { ...inbox, shares: [action.share, ...inbox.shares] } };
    case "open_share":
      return openShare(state, action.id);
    case "close_share":
      return inbox.open === null ? state : { ...state, inbox: { ...inbox, open: null } };
    case "remove_share":
      return removeShare(state, action.id);
    case "save_share":
      return saveShare(state, action.id);
  }
}

/** Leaving the Shared with you feed closes its open share, so coming back shows the inbox. */
export const closeShareOnLeave = <S extends WithInbox>(before: S, after: S): S =>
  after.currentFeed !== before.currentFeed && after.inbox.open !== null ? { ...after, inbox: { ...after.inbox, open: null } } : after;
