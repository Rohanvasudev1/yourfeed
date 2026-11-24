import type { Feed, Video } from "./types";

/**
 * The channels you subscribe to on YouTube: those in your own catalog, which signed in is your subscriptions'
 * uploads (ADR 0011). Pass the catalog before topic searches are added, since those channels aren't yours.
 */
export const subscribedChannels = (ownCatalog: readonly Video[]): readonly string[] => [...new Set(ownCatalog.map((v) => v.channel))];

/** The channels you follow: Subscriptions' own channels, then the ones you subscribe to on YouTube, each once. */
export function followedChannels(feeds: readonly Feed[], subscribed: readonly string[]): readonly string[] {
  const own = feeds.find((f) => f.kind === "subs")?.channels ?? [];
  return [...new Set([...own, ...subscribed])];
}
