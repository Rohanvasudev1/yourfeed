import { applyFeedActions, type FeedAction } from "./assistant";
import { isBuiltIn, makeFeed } from "./feed";
import { DRAFT_LENGTH, DRAFT_NAME, DRAFT_SESSION, fitsInBar, MAX_NAME_LENGTH, type Tabs } from "./tabs";
import type { Feed } from "./types";

/** How many added topics a new feed's name lists. */
const NAMED_TOPICS = 2;
/** Added to a name that matches a built-in tab, since those names are reserved. */
const BUILT_IN_SUFFIX = " picks";

/** The empty feed a request fills: a draft's starting ranges, nothing else. */
const blankFeed = (color: number): Feed => makeFeed({ color, length: DRAFT_LENGTH, session: DRAFT_SESSION });

/** Whether the actions add a topic, which a new feed needs (as in the mockup). Ranges or pins alone don't start one. */
export const startsFeed = (actions: readonly FeedAction[]): boolean => actions.some((a) => a.type === "set_topics" && a.add.length > 0);

/** `base` plus `suffix`, cutting `base` so the whole stays within the name limit. */
const fitted = (base: string, suffix: string) => `${base.slice(0, MAX_NAME_LENGTH - suffix.length).trim()}${suffix}`;

/** The name the assistant gave, else the first topics it added, else "New feed". */
function baseName(actions: readonly FeedAction[]): string {
  const given = actions.flatMap((a) => (a.type === "create_feed" && a.name?.trim() ? [a.name.trim()] : []))[0];
  const added = actions.flatMap((a) => (a.type === "set_topics" ? a.add : []));
  const fromTopics = [...new Set(added)].slice(0, NAMED_TOPICS).join(" & ");
  return fitted(given ?? fromTopics, "") || DRAFT_NAME;
}

/** A name for the new feed by the usual rules: never a built-in tab's name, never one already taken (ignoring case). */
export function newFeedName(feeds: readonly Feed[], actions: readonly FeedAction[]): string {
  const name = baseName(actions);
  const builtIn = feeds.some((f) => isBuiltIn(f) && f.name.toLowerCase() === name.toLowerCase());
  return uniqueName(feeds, builtIn ? fitted(name, BUILT_IN_SUFFIX) : name);
}

/** `base`, or `base 2`, `base 3`… until no feed has that name (ignoring case), always within the name limit. */
function uniqueName(feeds: readonly Feed[], base: string): string {
  const taken = (n: string) => feeds.some((f) => f.name.toLowerCase() === n.toLowerCase());
  let name = base;
  for (let i = 2; taken(name); i++) name = fitted(base, ` ${i}`);
  return name;
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
