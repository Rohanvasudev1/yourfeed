import { isBuiltIn, isInExplore, makeFeed } from "./feed";
import type { Feed } from "./types";

/** Spaces in the tab bar: Home, the one Explore button and your own feeds. */
export const MAX_BAR_SPACES = 8;
export const MAX_NAME_LENGTH = 24;
export const DRAFT_NAME = "New feed";
export const BAR_FULL = "The tab bar is full. Move a tab to All tabs first.";

/** The part of app state that tab management reads and changes. */
export type Tabs = Readonly<{ feeds: readonly Feed[]; currentFeed: string }>;

export type TabAction =
  /** Opens a feed. Leaving an unnamed draft drops it. */
  | Readonly<{ type: "open_feed"; feed: string }>
  /** Drops the open draft, if any, and goes Home. */
  | Readonly<{ type: "leave_draft" }>
  /** Opens a new draft feed (in All tabs when the bar is full). */
  | Readonly<{ type: "new_feed" }>
  | Readonly<{ type: "name_feed"; feed: string; name: string }>
  | Readonly<{ type: "set_shelved"; feed: string; shelved: boolean }>
  /** Shelves a tab (a draft is dropped) and, when it's open, moves to its neighbour. */
  | Readonly<{ type: "close_tab"; feed: string }>
  | Readonly<{ type: "delete_feed"; feed: string }>
  /** Moves one of your own feeds to where `to` (another of yours) is. */
  | Readonly<{ type: "move_feed"; feed: string; to: string }>;

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const byName = (feeds: readonly Feed[], name: string) => feeds.find((f) => f.name === name);
const homeOf = (feeds: readonly Feed[]) => (feeds.find((f) => f.kind === "home") ?? feeds[0]).name;

/** Tab-bar spaces the feeds take: each feed in the bar, except that Explore's feeds share one. */
export function barSpaces(feeds: readonly Feed[]): number {
  const inBar = feeds.filter((f) => !f.shelved);
  return inBar.filter((f) => !isInExplore(f)).length + (inBar.some(isInExplore) ? 1 : 0);
}

/** Whether showing `name` in the tab bar would still fit. */
export function fitsInBar(feeds: readonly Feed[], name: string): boolean {
  return barSpaces(feeds.map((f) => (f.name === name ? { ...f, shelved: false } : f))) <= MAX_BAR_SPACES;
}

/** Your own feeds in the tab bar, in tab order. */
export const ownTabs = (feeds: readonly Feed[]): readonly Feed[] => feeds.filter((f) => !f.shelved && !isBuiltIn(f));

/** Why `name` can't name the feed `renaming`, or null when it can. Names are compared ignoring case. */
export function feedNameProblem(feeds: readonly Feed[], name: string, renaming: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Type a name first.";
  if (trimmed.length > MAX_NAME_LENGTH) return `Keep it under ${MAX_NAME_LENGTH + 1} characters.`;
  if (feeds.some((f) => isBuiltIn(f) && sameName(f.name, trimmed))) return `"${trimmed}" is a built-in tab. Pick a different name.`;
  if (feeds.some((f) => f.name !== renaming && sameName(f.name, trimmed))) return "You already have a feed with that name.";
  return null;
}

function uniqueName(feeds: readonly Feed[], base: string): string {
  const taken = (n: string) => feeds.some((f) => sameName(f.name, n));
  let name = base;
  for (let i = 2; taken(name); i++) name = `${base} ${i}`;
  return name;
}

/** The tab to land on when `name` leaves the bar: its right neighbour, else its left, else Home. */
function neighbourOf(feeds: readonly Feed[], name: string): string {
  const leaving = byName(feeds, name);
  const order = [
    ...feeds.filter((f) => f.kind === "home" && !f.shelved),
    ...(leaving && isInExplore(leaving) ? [leaving] : []),
    ...feeds.filter((f) => !isBuiltIn(f) && (!f.shelved || f.name === name)),
  ];
  const i = order.findIndex((f) => f.name === name);
  return (order[i + 1] ?? order[i - 1] ?? { name: homeOf(feeds) }).name;
}

/** Removes `name` and, if it was open, opens its neighbour. */
function withoutFeed(tabs: Tabs, name: string): Tabs {
  const currentFeed = tabs.currentFeed === name ? neighbourOf(tabs.feeds, name) : tabs.currentFeed;
  return { feeds: tabs.feeds.filter((f) => f.name !== name), currentFeed };
}

function dropDraft(tabs: Tabs): Tabs {
  const open = byName(tabs.feeds, tabs.currentFeed);
  if (!open?.draft) return tabs;
  return { feeds: tabs.feeds.filter((f) => f !== open), currentFeed: homeOf(tabs.feeds) };
}

function moveFeed(feeds: readonly Feed[], name: string, to: string): readonly Feed[] {
  const from = feeds.findIndex((f) => f.name === name);
  const target = feeds.findIndex((f) => f.name === to);
  if (from < 0 || target < 0 || from === target || isBuiltIn(feeds[from]) || isBuiltIn(feeds[target])) return feeds;
  const rest = feeds.filter((_, i) => i !== from);
  return [...rest.slice(0, target), feeds[from], ...rest.slice(target)];
}

const setFeed = (feeds: readonly Feed[], name: string, changes: Partial<Feed>) => feeds.map((f) => (f.name === name ? { ...f, ...changes } : f));

/** Applies a tab action. Actions naming a feed that doesn't exist, or that the rules refuse, change nothing. */
export function reduceTabs(tabs: Tabs, action: TabAction): Tabs {
  const { feeds } = tabs;
  const target = "feed" in action ? byName(feeds, action.feed) : undefined;
  switch (action.type) {
    case "open_feed":
      if (!target || action.feed === tabs.currentFeed) return tabs;
      return { feeds: dropDraft(tabs).feeds, currentFeed: action.feed };
    case "leave_draft":
      return dropDraft(tabs);
    case "new_feed": {
      const left = dropDraft(tabs).feeds;
      const draft = makeFeed({ name: uniqueName(left, DRAFT_NAME), draft: true, color: left.length, length: [5, 60], session: [20, 90] });
      return { feeds: [...left, { ...draft, shelved: !fitsInBar([...left, draft], draft.name) }], currentFeed: draft.name };
    }
    case "name_feed": {
      if (!target || feedNameProblem(feeds, action.name, action.feed) !== null) return tabs;
      const name = action.name.trim();
      return {
        feeds: setFeed(feeds, action.feed, { name, draft: false }),
        currentFeed: tabs.currentFeed === action.feed ? name : tabs.currentFeed,
      };
    }
    case "set_shelved":
      if (!target || (!action.shelved && !fitsInBar(feeds, action.feed))) return tabs;
      return { ...tabs, feeds: setFeed(feeds, action.feed, { shelved: action.shelved }) };
    case "close_tab": {
      if (!target || target.kind === "home") return tabs;
      if (target.draft) return withoutFeed(tabs, action.feed);
      const currentFeed = tabs.currentFeed === action.feed ? neighbourOf(feeds, action.feed) : tabs.currentFeed;
      return { feeds: setFeed(feeds, action.feed, { shelved: true }), currentFeed };
    }
    case "delete_feed":
      return target && !isBuiltIn(target) ? withoutFeed(tabs, action.feed) : tabs;
    case "move_feed":
      return { ...tabs, feeds: moveFeed(feeds, action.feed, action.to) };
  }
}
