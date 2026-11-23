import { useState, type Dispatch } from "react";
import { BAR_FULL, feedNameProblem, fitsInBar, ownNeighbours } from "../domain/tabs";
import type { Feed } from "../domain/types";
import type { Action, AppState } from "./appState";
import { useTimedValue } from "./useTimedValue";

const FLASH_MS = 5000;

export type Page = "feed" | "all" | "search";

/** What the visitor can do with tabs. Calls that can be refused return the message to show, or null. */
export type TabControls = Readonly<{
  page: Page;
  flash: string | null;
  open: (name: string) => void;
  newFeed: () => void;
  name: (name: string) => string | null;
  close: (name: string) => void;
  /** Moves a feed to All tabs, or back to the bar when there's room. */
  toggleShelved: (feed: Feed) => string | null;
  /** Keeps a temporarily shown feed in the bar, flashing a message when it can't. */
  pin: (name: string) => void;
  remove: (name: string) => void;
  move: (name: string, to: string) => void;
  openAllTabs: () => void;
  closeAllTabs: () => void;
  /** Shows search results; opening any feed or All tabs leaves them. */
  openSearch: () => void;
  closeSearch: () => void;
  /** Turns a feed's Outside your recipe slot on or off. */
  setExploreSlot: (feed: Feed, on: boolean) => void;
  /** Your own tabs either side of `name` in the bar, for moving it left or right. */
  neighbours: (name: string) => Readonly<{ left: string | null; right: string | null }>;
}>;

/** Tab management: the All tabs page, new and named feeds, closing, shelving, deleting and reordering. */
export function useTabs(state: AppState, current: Feed, dispatch: Dispatch<Action>): TabControls {
  const [page, setPage] = useState<Page>("feed");
  const [flash, showFlash] = useTimedValue<string>(FLASH_MS);

  const showInBar = (name: string) => {
    if (!fitsInBar(state.feeds, name)) return BAR_FULL;
    dispatch({ type: "set_shelved", feed: name, shelved: false });
    return null;
  };

  return {
    page,
    flash,
    open: (name) => {
      setPage("feed");
      dispatch({ type: "open_feed", feed: name });
    },
    newFeed: () => {
      setPage("feed");
      dispatch({ type: "new_feed" });
    },
    name: (name) => {
      const problem = feedNameProblem(state.feeds, name, current.name);
      if (problem === null) dispatch({ type: "name_feed", feed: current.name, name });
      return problem;
    },
    close: (name) => dispatch({ type: "close_tab", feed: name }),
    toggleShelved: (feed) => {
      if (feed.shelved) return showInBar(feed.name);
      dispatch({ type: "set_shelved", feed: feed.name, shelved: true });
      return null;
    },
    pin: (name) => {
      const problem = showInBar(name);
      if (problem) showFlash(problem);
    },
    remove: (name) => dispatch({ type: "delete_feed", feed: name }),
    move: (name, to) => dispatch({ type: "move_feed", feed: name, to }),
    openAllTabs: () => {
      dispatch({ type: "leave_draft" });
      setPage("all");
    },
    closeAllTabs: () => setPage("feed"),
    openSearch: () => setPage("search"),
    closeSearch: () => setPage("feed"),
    neighbours: (name) => ownNeighbours(state.feeds, name),
    setExploreSlot: (feed, on) => dispatch({ type: "set_explore_slot", feed: feed.name, on }),
  };
}
