import { z } from "zod";
import { FEED_KINDS, NEWS_CATEGORIES, TOP_RANGES } from "../domain/types";
import { VIEWS, type AppState } from "./appState";

/** Bump when AppState changes shape. Saved state from any other version is ignored. */
export const SCHEMA_VERSION = 1;

const ids = z.array(z.string());
const range = z.tuple([z.number(), z.number()]).refine(([min, max]) => min <= max, "min must not exceed max");

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
});

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
