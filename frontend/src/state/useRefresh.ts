import type { Dispatch } from "react";
import { composeFeed } from "../domain/compose";
import { feedSetOf, nextFeedSet, type FeedSet } from "../domain/refresh";
import type { ComposeInput } from "../domain/types";
import type { Action } from "./appState";
import { useTimedValue } from "./useTimedValue";

const UNDO_MS = 5000;
/** How far a refresh can jump the shuffle seed. */
const SEED_SPREAD = 1000;

/** The set to go back to, and when the refresh recorded its skips, so undo can forget them. */
type Previous = Readonly<{ set: FeedSet; skippedAt: number }>;

/**
 * The logo's refresh: a new set for the open feed, plus `undo` for 5 seconds afterwards (null otherwise).
 * It ends the session, so what Up next showed is recorded skipped; undo forgets that too.
 * Does nothing until the catalog has loaded.
 */
export function useRefresh(input: ComposeInput | null, dispatch: Dispatch<Action>) {
  const [previous, offerUndo, dropUndo] = useTimedValue<Previous>(UNDO_MS);
  const load = (set: FeedSet) => dispatch({ type: "set_feed_set", set });

  const refresh = () => {
    if (!input) return;
    const seed = input.feed.seed + 1 + Math.floor(Math.random() * SEED_SPREAD);
    const at = Date.now();
    offerUndo({ set: feedSetOf(input.feed), skippedAt: at });
    dispatch({ type: "end_session", feed: input.feed.name, videos: composeFeed(input).upNext.map((v) => v.id), at });
    load(nextFeedSet(input, seed));
  };
  const undo =
    previous &&
    (() => {
      load(previous.set);
      dispatch({ type: "forget_skips", feed: previous.set.feed, at: previous.skippedAt });
      dropUndo();
    });

  return { refresh, undo };
}
