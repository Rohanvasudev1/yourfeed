import { makeFeed } from "./feed";
import { addFeedTab } from "./newFeed";
import type { Feed, Range, Video } from "./types";

/** What Bring your demo feeds copies of a demo feed (ADR 0012): its name, ranges and topics, nothing else. */
export type DemoRecipe = Readonly<{ name: string; topics: readonly string[]; length: Range; session: Range }>;

/** The visitor's own demo feeds as recipes, keeping only the topics `catalog` has. Built-in feeds and drafts aren't recipes to bring. */
export function demoRecipes(demoFeeds: readonly Feed[], catalog: readonly Video[]): readonly DemoRecipe[] {
  const known = new Set(catalog.map((v) => v.topic));
  return demoFeeds
    .filter((f) => f.kind === "topics" && !f.draft)
    .map((f) => ({ name: f.name, topics: f.topics.filter((t) => known.has(t)), length: f.length, session: f.session }));
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Copies `recipes` into `feeds`. A feed of your own with the same name (ignoring case) takes the recipe; any other
 * recipe becomes a new feed, shelved in All tabs when the tab bar is full.
 */
export function bringRecipes(feeds: readonly Feed[], recipes: readonly DemoRecipe[]): readonly Feed[] {
  return recipes.reduce<readonly Feed[]>((all, { name, topics, length, session }) => {
    const mine = all.find((f) => f.kind === "topics" && !f.draft && sameName(f.name, name));
    if (mine) return all.map((f) => (f === mine ? { ...f, topics, length, session } : f));
    return addFeedTab(all, makeFeed({ name, topics, length, session, color: all.length }));
  }, feeds);
}
