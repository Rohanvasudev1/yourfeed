import { z } from "zod";
import type { SendAnswer, SentShare } from "../domain/sending";
import { SHARE_LIMITS, type Share } from "../domain/share";
import type { Video } from "../domain/types";
import type { SharingPort } from "../ports";
import { isVideo } from "./catalog";
import { ApiError, type ApiSession } from "./session";

/** 404: no one has that username. 409: you haven't chosen yours. 429: today's sends are used up. */
const REFUSED = new Set([404, 409, 429]);

const sentSchema = z
  .object({
    id: z.number().int().positive(),
    from: z.string().min(1),
    title: z.string().min(1).max(SHARE_LIMITS.title),
    videos: z.array(z.string().min(1)).min(1).max(SHARE_LIMITS.videos),
    message: z.string().max(SHARE_LIMITS.message),
    notes: z.record(z.string(), z.string()),
    sentAt: z.iso.datetime({ offset: true }),
  })
  .refine((s) => Object.values(s.notes).reduce((sum, n) => sum + n.length, 0) <= SHARE_LIMITS.notes, "notes are too long");

const sentToSchema = z.object({ to: z.string().min(1) });

/** Keeps the items that fit, saying how many didn't. */
function valid<T>(items: unknown, keep: (item: unknown) => T | null, what: string): T[] {
  if (!Array.isArray(items)) throw new Error("The server's answer wasn't a list.");
  const kept = items.flatMap((item) => keep(item) ?? []);
  if (kept.length !== items.length) console.warn(`Dropped ${items.length - kept.length} malformed ${what}`);
  return kept;
}

const toSent = (item: unknown): SentShare | null => {
  const parsed = sentSchema.safeParse(item);
  return parsed.success ? { ...parsed.data, sentAt: Date.parse(parsed.data.sentAt) } : null;
};

/** The backend's sharing API (ADR 0013): video lookups, sending to a username and the user's inbox. */
export function apiSharing(session: ApiSession): SharingPort {
  return {
    lookupVideos: async (ids) => {
      const data = await session.call(`/api/videos?ids=${ids.map(encodeURIComponent).join(",")}`);
      return valid<Video>(data, (v) => (isVideo(v) ? v : null), "videos");
    },
    send: async (to: string, share: Share): Promise<SendAnswer> => {
      try {
        return { ok: true, ...sentToSchema.parse(await session.write("/api/shares", "POST", { to, share })) };
      } catch (err: unknown) {
        if (err instanceof ApiError && REFUSED.has(err.status)) return { ok: false, problem: err.message };
        throw err;
      }
    },
    inbox: async (after) => valid(await session.call(`/api/inbox?after=${after}`), toSent, "shares"),
  };
}
