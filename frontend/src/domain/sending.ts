import { SHARE_LIMITS } from "./share";

/** A feed another signed-in user sent to this one by username (ADR 0013), as the server keeps it. */
export type SentShare = Readonly<{
  /** The server's id: the inbox only asks for shares after the newest one it has. */
  id: number;
  from: string;
  title: string;
  videos: readonly string[];
  message: string;
  notes: Readonly<Record<string, string>>;
  /** When it was sent, in epoch milliseconds. */
  sentAt: number;
}>;

/** The server took the share for `to` (as it stores the username), or said why not. */
export type SendAnswer = Readonly<{ ok: true; to: string }> | Readonly<{ ok: false; problem: string }>;

export const SEND_TEXT = {
  failed: "Couldn't send. Try again.",
} as const;

/** At most this many ids go in one lookup, like YouTube's videos.list. */
export const LOOKUP_BATCH = SHARE_LIMITS.videos;

type Referencing = Readonly<{
  inbox: Readonly<{ shares: readonly Readonly<{ videos: readonly string[] }>[] }>;
  feeds: readonly Readonly<{ pinned: readonly string[]; finished: readonly string[]; current: string | null }>[];
}>;

/**
 * Videos the state names that `known` doesn't have, in first-mention order: what others shared, and what those shares
 * put in your feeds' sessions (Save as my feed pins them). Signed in, these are looked up, since they may be outside your catalog.
 */
export function unknownVideoIds(state: Referencing, known: Readonly<{ has: (id: string) => boolean }>): string[] {
  const named = [
    ...state.inbox.shares.flatMap((s) => s.videos),
    ...state.feeds.flatMap((f) => [...f.pinned, ...f.finished, ...(f.current === null ? [] : [f.current])]),
  ];
  return [...new Set(named)].filter((id) => !known.has(id));
}

/** `ids` in groups of at most LOOKUP_BATCH. */
export const lookupBatches = (ids: readonly string[]): string[][] =>
  Array.from({ length: Math.ceil(ids.length / LOOKUP_BATCH) }, (_, i) => ids.slice(i * LOOKUP_BATCH, (i + 1) * LOOKUP_BATCH));
