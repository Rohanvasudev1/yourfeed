import { useMemo, type Dispatch } from "react";
import { composeShared, openShareOf, unreadCount, type InboxShare } from "../domain/inbox";
import type { Composition, Feed, Video } from "../domain/types";
import type { Action, AppState } from "./appState";
import { useShareLinks } from "./useShareLinks";
import { FLASH_MS, useTimedValue } from "./useTimedValue";

type Options = Readonly<{
  state: AppState;
  feed: Feed;
  catalog: readonly Video[] | null;
  /** Signed in, finds a link's videos outside the catalog; null in demo mode. */
  lookup: ((ids: readonly string[]) => Promise<readonly Video[]>) | null;
  byId: ReadonlyMap<string, Video>;
  dispatch: Dispatch<Action>;
  /** Opens a feed the way its tab does. */
  openFeed: (name: string) => void;
}>;

export type SharedWithYou = Readonly<{
  /** The Shared with you feed is showing its inbox rather than an open share. */
  inInbox: boolean;
  open: InboxShare | null;
  /** The open share's Up next, or null when no share is open. */
  composition: Composition | null;
  unread: number;
  /** "This share link doesn't work." while it shows. */
  flash: string | null;
  openShare: (id: string) => void;
  back: () => void;
  save: (id: string) => void;
  remove: (id: string) => void;
}>;

/** The Shared with you feed: its inbox, the open share, and share links opened from the address bar. */
export function useSharedWithYou({ state, feed, catalog, lookup, byId, dispatch, openFeed }: Options): SharedWithYou {
  const [flash, showFlash] = useTimedValue<string>(FLASH_MS);
  const isShared = feed.kind === "shared";
  const open = isShared ? openShareOf(state.inbox) : null;
  const sharedFeed = state.feeds.find((f) => f.kind === "shared")?.name ?? null;

  useShareLinks({
    catalog,
    lookup,
    onBroken: showFlash,
    onReceive: (share) => {
      dispatch({ type: "receive_share", share });
      if (sharedFeed) openFeed(sharedFeed);
      dispatch({ type: "open_share", id: share.id });
    },
  });

  const composition = useMemo(() => open && composeShared(open, feed, byId), [open, feed, byId]);

  return {
    inInbox: isShared && open === null,
    open,
    composition,
    unread: unreadCount(state.inbox),
    flash,
    openShare: (id) => dispatch({ type: "open_share", id }),
    back: () => dispatch({ type: "close_share" }),
    save: (id) => dispatch({ type: "save_share", id }),
    remove: (id) => dispatch({ type: "remove_share", id }),
  };
}
