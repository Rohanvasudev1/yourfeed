import type { Dispatch } from "react";
import { feedSetOf, nextFeedSet, type FeedSet } from "../domain/refresh";
import type { ComposeInput } from "../domain/types";
import type { Action } from "./appState";
import { useTimedValue } from "./useTimedValue";

const UNDO_MS = 5000;
/** How far a refresh can jump the shuffle seed. */
const SEED_SPREAD = 1000;

/**
 * The logo's refresh: a new set for the open feed, plus `undo` for 5 seconds afterwards (null otherwise).
 * Does nothing until the catalog has loaded.
 */
export function useRefresh(input: ComposeInput | null, dispatch: Dispatch<Action>) {
  const [previous, offerUndo, dropUndo] = useTimedValue<FeedSet>(UNDO_MS);
  const load = (set: FeedSet) => dispatch({ type: "set_feed_set", set });

  const refresh = () => {
    if (!input) return;
    const seed = input.feed.seed + 1 + Math.floor(Math.random() * SEED_SPREAD);
    offerUndo(feedSetOf(input.feed));
    load(nextFeedSet(input, seed));
  };
  const undo =
    previous &&
    (() => {
      load(previous);
      dropUndo();
    });

  return { refresh, undo };
}
