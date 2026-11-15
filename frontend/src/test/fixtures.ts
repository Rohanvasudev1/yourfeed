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
