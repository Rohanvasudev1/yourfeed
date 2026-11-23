import { MAX_REQUEST_CHARS } from "./assistant";
import type { Feed, Range } from "./types";

/** Most lines a feed's recipe log keeps; the oldest go first (ADR 0009). */
export const LOG_LIMIT = 20;
/** How many of the newest live lines a request carries as follow-ups. */
export const FOLLOW_UPS = 3;
/** Longest summary kept, and the most the backend accepts in a follow-up. */
export const MAX_SUMMARY_CHARS = 120;
/** Longest reply kept on a line; the bar shows the whole reply when it arrives. */
export const MAX_LOG_REPLY_CHARS = 200;

export const NO_CHANGE = "no change";

/** One request on a feed: what was asked, what it changed, the reply if any. Undo greys it out (`live: false`). */
export type LogLine = Readonly<{ id: string; request: string; summary: string; reply?: string; live: boolean }>;

/** A line before it lands: the reducer adds it live. */
export type NewLine = Omit<LogLine, "live">;

/** What a follow-up sends: an earlier request and what it changed. */
export type FollowUp = Readonly<{ request: string; summary: string }>;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** A line for `request`, its summary and reply cut to what the log keeps. */
export const newLine = (request: string, summary: string, reply?: string | null): NewLine => ({
  id: crypto.randomUUID(),
  request: clip(request.trim(), MAX_REQUEST_CHARS),
  summary: clip(summary, MAX_SUMMARY_CHARS),
  ...(reply?.trim() ? { reply: clip(reply.trim(), MAX_LOG_REPLY_CHARS) } : {}),
});

/** The log with `line` added live at the end, dropping the oldest past the limit. */
export const appendLine = (log: readonly LogLine[], line: NewLine): readonly LogLine[] => [...log, { ...line, live: true }].slice(-LOG_LIMIT);

/** The log with line `id` greyed out or restored; a line that's gone (cleared, or dropped past the limit) changes nothing. */
export const setLive = (log: readonly LogLine[], id: string, live: boolean): readonly LogLine[] =>
  log.some((l) => l.id === id && l.live !== live) ? log.map((l) => (l.id === id ? { ...l, live } : l)) : log;

/** The newest live lines, oldest first, as a request sends them. */
export const followUpsOf = (log: readonly LogLine[]): readonly FollowUp[] =>
  log
    .filter((l) => l.live)
    .slice(-FOLLOW_UPS)
    .map(({ request, summary }) => ({ request, summary }));

const formatRange = ([min, max]: Range) => `${min}–${max} min`;
const added = (after: readonly string[], before: readonly string[]) => after.filter((x) => !before.includes(x));
const sameRange = (a: Feed["length"], b: Feed["length"]) => a[0] === b[0] && a[1] === b[1];

/** What a request changed on a feed, in a few words ("added Cooking · videos 10–30 min"), or "no change". */
export function summarizeChange(before: Feed, after: Feed): string {
  const parts = [
    added(after.topics, before.topics).length > 0 && `added ${added(after.topics, before.topics).join(", ")}`,
    added(before.topics, after.topics).length > 0 && `removed ${added(before.topics, after.topics).join(", ")}`,
    added(after.muted, before.muted).length > 0 && `muted ${added(after.muted, before.muted).join(", ")}`,
    !sameRange(before.length, after.length) && `videos ${formatRange(after.length)}`,
    !sameRange(before.session, after.session) && `sessions ${formatRange(after.session)}`,
    added(after.pinned, before.pinned).length > 0 && "put a video first",
  ].filter((p): p is string => typeof p === "string");
  return parts.length > 0 ? parts.join(" · ") : NO_CHANGE;
}

/** The first line of a feed a request made. */
export const summarizeNew = (feed: Feed): string => `new feed with ${feed.topics.join(", ")}`;
