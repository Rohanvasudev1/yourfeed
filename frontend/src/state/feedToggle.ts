import { addFeedTab } from "../domain/newFeed";
import type { Feed } from "../domain/types";
import type { AppState } from "./appState";

/**
 * The one tab change undo makes (ADR 0007): a request that made a feed is undone by removing
 * that feed, and redone by adding it back as it was when it was removed.
 */
export type FeedToggle = Readonly<{ remove: string }> | Readonly<{ add: Feed }>;

type Toggled = Readonly<{
  state: AppState;
  /** The toggle that reverses this one. */
  back: FeedToggle;
  /** The feed to open: the one added, or null to open the step's own feed. */
  open: string | null;
}>;

const homeOf = (feeds: readonly Feed[]) => (feeds.find((f) => f.kind === "home") ?? feeds[0]).name;

/** Applies a toggle, or returns null when there's nothing to do (the feed is already gone). */
export function toggleFeed(state: AppState, toggle: FeedToggle): Toggled | null {
  if ("add" in toggle) {
    const feeds = addFeedTab(state.feeds, toggle.add);
    const added = feeds[feeds.length - 1];
    return { state: { ...state, feeds, currentFeed: added.name }, back: { remove: added.name }, open: added.name };
  }
  const removed = state.feeds.find((f) => f.name === toggle.remove);
  if (!removed || state.feeds.length === 1) return null;
  const feeds = state.feeds.filter((f) => f !== removed);
  const currentFeed = state.currentFeed === removed.name ? homeOf(feeds) : state.currentFeed;
  return { state: { ...state, feeds, currentFeed }, back: { add: removed }, open: null };
}
