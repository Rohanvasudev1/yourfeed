import { HOURS_PER_DAY, MS_PER_HOUR } from "./time";
import type { Feed, Video } from "./types";

/**
 * What the visitor did with a video on a feed. Yourfeed's own data, never YouTube's (ADR 0010). `noted` is a video
 * whose note the visitor started writing on this feed.
 */
export const SIGNAL_KINDS = ["watched", "finished", "pinned", "removed", "skipped", "noted"] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

/** One saved signal: a kind, a video id and when it happened (ms since the epoch). */
export type BehaviourEntry = Readonly<{ kind: SignalKind; video: string; at: number }>;

/** A feed's behaviour, oldest first, as it's saved. */
export type BehaviourRecord = readonly BehaviourEntry[];

/** A signal with its video looked up in the catalog: what `rank` (and the recipe mirror) read. */
export type Signal = Readonly<{ kind: SignalKind; video: Video; at: number }>;

/** Behaviour older than this many days is dropped and never ranks anything. */
export const BEHAVIOUR_DAYS = 30;
export const BEHAVIOUR_WINDOW_MS = BEHAVIOUR_DAYS * HOURS_PER_DAY * MS_PER_HOUR;
/** Most signals kept per feed; the oldest go first. */
export const BEHAVIOUR_LIMIT = 300;
/** How long a repeat of a signal on the same video is ignored: a skip counts once a day, a note once while it's kept. */
const REPEAT_IGNORED_MS: Partial<Record<SignalKind, number>> = { skipped: HOURS_PER_DAY * MS_PER_HOUR, noted: Infinity };

export const isRecent = (at: number, now: number): boolean => now - at <= BEHAVIOUR_WINDOW_MS;

/** Whether a new `kind` signal for `video` repeats a kept one recently enough to be ignored. */
function repeats(record: BehaviourRecord, kind: SignalKind, video: string, at: number): boolean {
  const window = REPEAT_IGNORED_MS[kind];
  return window !== undefined && record.some((s) => s.kind === kind && s.video === video && at - s.at < window);
}

/** Adds one signal of `kind` per video at `at`, trimmed to the last 30 days and the limit. */
export function recordSignals(record: BehaviourRecord, kind: SignalKind, videos: readonly string[], at: number): BehaviourRecord {
  const added = videos.filter((video) => !repeats(record, kind, video, at)).map((video) => ({ kind, video, at }));
  if (added.length === 0) return record;
  return [...record, ...added].filter((s) => isRecent(s.at, at)).slice(-BEHAVIOUR_LIMIT);
}

/** Which signals `forgetSignals` drops: some kinds for one video, some kinds recorded at one moment, or every signal of some kinds. */
export type Forget = Readonly<{ kinds: readonly SignalKind[] } & ({ video: string } | { at: number } | { all: true })>;

const matches = (s: BehaviourEntry, forget: Forget) =>
  forget.kinds.includes(s.kind) && ("video" in forget ? s.video === forget.video : "at" in forget ? s.at === forget.at : true);

export function forgetSignals(record: BehaviourRecord, forget: Forget): BehaviourRecord {
  const kept = record.filter((s) => !matches(s, forget));
  return kept.length === record.length ? record : kept;
}

/** The record's signals with their videos; signals for videos the catalog doesn't have are left out. */
export const resolveBehaviour = (record: BehaviourRecord, byId: ReadonlyMap<string, Video>): Signal[] =>
  record.flatMap(({ kind, video, at }) => {
    const found = byId.get(video);
    return found ? [{ kind, video: found, at }] : [];
  });

const added = (before: readonly string[], after: readonly string[]) => after.filter((id) => !before.includes(id));

/**
 * Records what a session change did on a feed: a video started (watched), and videos newly
 * Finished, pinned or removed. A change that did none of these leaves the record alone.
 */
export function withSessionSignals(before: Feed, after: Feed, at: number): Feed {
  const started = after.current !== null && after.current !== before.current ? [after.current] : [];
  const changes: readonly (readonly [SignalKind, readonly string[]])[] = [
    ["finished", added(before.finished, after.finished)],
    ["watched", started],
    ["pinned", added(before.pinned, after.pinned)],
    ["removed", added(before.removed, after.removed)],
  ];
  return withBehaviour(after, (record) => changes.reduce((r, [kind, videos]) => recordSignals(r, kind, videos, at), record));
}

/** The feed with its behaviour record changed by `change`; the same feed when nothing changed. */
export function withBehaviour(feed: Feed, change: (record: BehaviourRecord) => BehaviourRecord): Feed {
  const behaviour = change(feed.behaviour);
  return behaviour === feed.behaviour ? feed : { ...feed, behaviour };
}

/** The behaviour the Ranker reads for a feed: its own, or every feed's for Everything, which is everything you do. */
export const behaviourFor = (feed: Feed, feeds: readonly Feed[], byId: ReadonlyMap<string, Video>): Signal[] =>
  resolveBehaviour(feed.kind === "home" ? feeds.flatMap((f) => f.behaviour) : feed.behaviour, byId);
