import { z } from "zod";
import { BAR_MODES } from "../domain/assistant";
import { BLEND_STATUSES, MATCH_SCORE } from "../domain/blend";
import { RECENT_LIMIT } from "../domain/search";
import { SHARE_LIMITS } from "../domain/share";
import { FEED_KINDS, NEWS_CATEGORIES, TOP_RANGES } from "../domain/types";
import { USERNAME_PATTERN } from "../domain/username";
import { VIEWS, type AppState } from "./appState";

/** Bump when AppState changes shape. Saved state from any other version is ignored. */
export const SCHEMA_VERSION = 4;

const ids = z.array(z.string());
const range = z.tuple([z.number(), z.number()]).refine(([min, max]) => min <= max, "min must not exceed max");

const partnerSchema = z.object({
  name: z.string().regex(USERNAME_PATTERN),
  topics: ids,
  score: z.number().int().min(MATCH_SCORE.min).max(MATCH_SCORE.max),
});

const feedSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(FEED_KINDS),
  shelved: z.boolean(),
  draft: z.boolean(),
  color: z.number().int().min(0),
  topRange: z.enum(TOP_RANGES),
  topics: ids,
  channels: ids,
  length: range,
  session: range,
  muted: ids,
  pinned: ids,
  removed: ids,
  skipped: ids,
  finished: ids,
  current: z.string().nullable(),
  newsCategory: z.enum(NEWS_CATEGORIES),
  seed: z.number().int(),
  // Saved before feed notes existed: start with an empty note rather than discarding the save.
  note: z.string().default(""),
  connected: z.boolean(),
  partner: partnerSchema.extend({ status: z.enum(BLEND_STATUSES) }).nullable(),
});

const shareSchema = z
  .object({
    id: z.string().min(1),
    from: z.string().min(1).nullable(),
    title: z.string().min(1).max(SHARE_LIMITS.title),
    videos: z.array(z.string().min(1)).min(1).max(SHARE_LIMITS.videos),
    message: z.string().max(SHARE_LIMITS.message),
    notes: z.record(z.string(), z.string()),
    received: z.number(),
    unread: z.boolean(),
  })
  .refine((s) => Object.values(s.notes).reduce((sum, n) => sum + n.length, 0) <= SHARE_LIMITS.notes, "notes are too long");

const inboxSchema = z
  .object({ shares: z.array(shareSchema), open: z.string().nullable(), sessionShare: z.string().nullable() })
  .refine((i) => new Set(i.shares.map((s) => s.id)).size === i.shares.length, "share ids must be unique")
  .refine((i) => i.open === null || i.shares.some((s) => s.id === i.open), "the open share must exist");

const stateSchema = z
  .object({
    feeds: z.array(feedSchema).min(1),
    currentFeed: z.string(),
    filters: z.object({
      hideClickbait: z.boolean(),
      honestTitles: z.boolean(),
      hideViewCounts: z.boolean(),
      hideSubscriberCounts: z.boolean(),
      boostSmallCreators: z.boolean(),
      includeShorts: z.boolean(),
    }),
    notes: z.record(z.string(), z.string()),
    folders: z.array(z.object({ name: z.string().min(1), videoIds: ids })),
    watched: ids,
    view: z.enum(VIEWS),
    // Saved before search existed: start with no recent searches rather than discarding the save.
    recentSearches: z.array(z.string().min(1)).max(RECENT_LIMIT).default([]),
    // Saved before bar modes existed, or with one this version doesn't know: start in edit mode.
    barMode: z.enum(BAR_MODES).catch("edit"),
    blends: z.array(partnerSchema),
    inbox: inboxSchema,
  })
  .refine((s) => new Set(s.feeds.map((f) => f.name.toLowerCase())).size === s.feeds.length, "feed names must be unique")
  .refine((s) => s.feeds.some((f) => f.name === s.currentFeed), "the open feed must exist") satisfies z.ZodType<AppState>;

const savedSchema = z.object({ version: z.literal(SCHEMA_VERSION), state: stateSchema });

export type SavedState = Readonly<{ version: typeof SCHEMA_VERSION; state: AppState }>;

export const toSaved = (state: AppState): SavedState => ({ version: SCHEMA_VERSION, state });

/** Turns untrusted saved data into app state, or falls back (with a warning) when it doesn't fit. */
export function restoreState(saved: unknown, fallback: AppState): AppState {
  if (saved === null || saved === undefined) return fallback;
  const result = savedSchema.safeParse(saved);
  if (result.success) return result.data.state;
  console.warn(
    "Ignoring saved state that doesn't match this version of Yourfeed (wrong version or shape); starting from the demo.",
    z.prettifyError(result.error),
  );
  return fallback;
}
