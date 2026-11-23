import type { StateStorage } from "../ports";
import { browserStorage, STORAGE_KEY } from "../state/browserStorage";
import type { Video } from "../domain/types";

const video = (o: Partial<Video> & Pick<Video, "id" | "title">): Video => ({
  honestTitle: o.title,
  channel: "Quiet Channel",
  channelSubscribers: 500_000,
  topic: "Gardening",
  minutes: 20,
  views: 10_000,
  ageHours: 48,
  clickbait: false,
  live: false,
  newsCategory: null,
  ...o,
});

/**
 * A small catalog whose Everything order can be worked out by hand against the demo seed,
 * which has demo-0 (AI, Agent Workshop) in its watched list. Score gaps (5 / 3 / 0) are wider
 * than the seeded jitter (< 1.7), so the order never depends on the shuffle.
 */
export const CATALOG: readonly Video[] = [
  video({ id: "demo-0", title: "Already watched agent build", topic: "AI", channel: "Agent Workshop" }),
  video({ id: "demo-50", title: "Gardening for beginners" }),
  video({ id: "demo-51", title: "Agents with memory", topic: "AI", channel: "Agent Workshop" }),
  video({ id: "demo-52", title: "Intro to transformers", topic: "AI", channel: "Model School" }),
  video({
    id: "demo-53",
    title: "YOU WON'T BELIEVE this AI trick",
    honestTitle: "A small AI tip",
    topic: "AI",
    channel: "Agent Workshop",
    clickbait: true,
  }),
];

/** Titles of the visible Everything feed, in order: same topic and channel, same topic, neither. */
export const EVERYTHING_ORDER = ["Agents with memory", "Intro to transformers", "Gardening for beginners"];
/** Everything on a new account: its watch history is empty, so the demo's watched video isn't hidden. */
export const ACCOUNT_ORDER = [...EVERYTHING_ORDER, "Already watched agent build"];

export function memoryStorage(initial: unknown = null): StateStorage & { saved: () => unknown } {
  let value: unknown = initial;
  return {
    load: () => value,
    save: (state) => {
      value = state;
    },
    saved: () => value,
  };
}

/** localStorage as some private windows have it: reading it at all throws. */
export const blockedStorage = (): StateStorage =>
  browserStorage(() => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  });

/** localStorage holding one raw string under the app's key. */
export function rawLocalStorage(raw: string): StateStorage {
  const items = new Map([[STORAGE_KEY, raw]]);
  const store = {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
  } as Storage;
  return browserStorage(() => store);
}

/**
 * Real demo videos (ids, titles, minutes) with designed thumbnails, plus one live clip and one
 * video with no design. None is in the seed's watched list or flagged clickbait, so Everything
 * shows them all (231 minutes, inside its 240-minute session).
 */
export const CARDS_CATALOG: readonly Video[] = [
  video({ id: "demo-1", title: "Graphs vs trees: when to use which", topic: "Programming", minutes: 18, channel: "Byte Garden" }),
  video({ id: "demo-2", title: "Building a tiny database from scratch", topic: "Programming", minutes: 41, channel: "Byte Garden", channelSubscribers: 88_000, views: 1_900_000, ageHours: 72 }),
  video({ id: "demo-3", title: "The ONE career mistake everyone makes", honestTitle: "Planning your next five years", topic: "Careers", minutes: 22 }),
  video({ id: "demo-11", title: "A founder on burnout, ambition and starting over", topic: "Podcasts", minutes: 95 }),
  video({ id: "demo-36", title: "Live: storm update and travel disruption", topic: "News", minutes: 45, live: true, newsCategory: "World" }),
  video({ id: "demo-60", title: "Pruning roses in winter", minutes: 10 }),
];

/** Twelve hour-long gardening videos: Everything's 240-minute session fits four at a time, so three sets use them all up. */
export const BIG_CATALOG: readonly Video[] = Array.from({ length: 12 }, (_, i) =>
  video({ id: `demo-${100 + i}`, title: `Garden walk ${i + 1}`, minutes: 60 }),
);
