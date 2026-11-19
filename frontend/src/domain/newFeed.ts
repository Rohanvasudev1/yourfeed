import { applyFeedActions, type FeedAction } from "./assistant";
import { isBuiltIn, makeFeed } from "./feed";
import { DRAFT_LENGTH, DRAFT_NAME, DRAFT_SESSION, fitsInBar, MAX_NAME_LENGTH, uniqueName, type Tabs } from "./tabs";
import type { Feed } from "./types";

/** How many added topics a new feed's name lists. */
const NAMED_TOPICS = 2;
/** Added to a name that matches a built-in tab, since those names are reserved. */
const BUILT_IN_SUFFIX = " picks";

/** The empty feed a request fills: a draft's starting ranges, nothing else. */
const blankFeed = (color: number): Feed => makeFeed({ color, length: DRAFT_LENGTH, session: DRAFT_SESSION });

/** Whether the actions put anything into a new feed. Replies, questions and `create_feed` alone don't. */
export const startsFeed = (actions: readonly FeedAction[]): boolean => {
  const blank = blankFeed(0);
  return JSON.stringify(applyFeedActions(blank, actions)) !== JSON.stringify(blank);
};

/** The name the assistant gave, else the first topics it added, else "New feed". */
function baseName(actions: readonly FeedAction[]): string {
  const given = actions.flatMap((a) => (a.type === "create_feed" && a.name?.trim() ? [a.name.trim()] : []))[0];
  const added = actions.flatMap((a) => (a.type === "set_topics" ? a.add : []));
  const fromTopics = [...new Set(added)].slice(0, NAMED_TOPICS).join(" & ");
  return (given ?? fromTopics).slice(0, MAX_NAME_LENGTH).trim() || DRAFT_NAME;
}

/** A name for the new feed by the usual rules: never a built-in tab's name, never one already taken (ignoring case). */
export function newFeedName(feeds: readonly Feed[], actions: readonly FeedAction[]): string {
  const base = baseName(actions);
  const builtIn = feeds.some((f) => isBuiltIn(f) && f.name.toLowerCase() === base.toLowerCase());
  return uniqueName(feeds, builtIn ? `${base}${BUILT_IN_SUFFIX}` : base);
}

/** Adds `feed` as a tab, shelved in All tabs when the bar is full, under a name no other feed has. */
export function addFeedTab(feeds: readonly Feed[], feed: Feed): readonly Feed[] {
  const named = { ...feed, name: uniqueName(feeds, feed.name) };
  return [...feeds, { ...named, shelved: !fitsInBar([...feeds, named], named.name) }];
}

/**
 * Makes a feed from a request asked on `from`, and opens it. A draft that asked is replaced, since
 * it was the new feed all along. Actions that add nothing make nothing.
 */
export function createFromRequest(tabs: Tabs, from: string, actions: readonly FeedAction[]): Tabs {
  const asking = tabs.feeds.find((f) => f.name === from);
  if (!asking || !startsFeed(actions)) return tabs;
  const others = asking.draft ? tabs.feeds.filter((f) => f !== asking) : tabs.feeds;
  const feed = { ...applyFeedActions(blankFeed(others.length), actions), name: newFeedName(others, actions) };
  return { feeds: addFeedTab(others, feed), currentFeed: feed.name };
}
