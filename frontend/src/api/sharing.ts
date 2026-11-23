import { z } from "zod";
import { BLEND_STATUSES, type InviteAnswer, type ServerBlend } from "../domain/blend";
import type { SendAnswer, SentShare } from "../domain/sending";
import { notesFit, sharedContentFields, type Share } from "../domain/share";
import type { Video } from "../domain/types";
import type { SharingPort } from "../ports";
import { USERNAME_PATTERN } from "../domain/username";
import { isVideo } from "./catalog";
import { ApiError, type ApiSession } from "./session";

/** 404: no one has that username. 409: you haven't chosen yours. 429: today's sends are used up. */
const REFUSED = new Set([404, 409, 429]);

const sentSchema = z
  .object({
    id: z.number().int().positive(),
    from: z.string().min(1),
    ...sharedContentFields,
    sentAt: z.iso.datetime({ offset: true }),
  })
  .refine(notesFit, "notes are too long")
  .refine((s) => Object.keys(s.notes).every((id) => s.videos.includes(id)), "notes name a video that isn't shared");

const sentToSchema = z.object({ to: z.string().min(1) });

const blendSchema = z.object({
  id: z.number().int().positive(),
  with: z.string().regex(USERNAME_PATTERN),
  role: z.enum(["inviter", "invitee"]),
  status: z.enum(BLEND_STATUSES),
  topics: z.array(z.string().min(1)),
}) satisfies z.ZodType<ServerBlend>;

/** 404: no one has that username. 409: you haven't chosen yours, or you already blend with them. 422: it's yours. 429: today's invites are used up. */
const INVITE_REFUSED = new Set([404, 409, 422, 429]);

const toBlend = (item: unknown): ServerBlend | null => {
  const parsed = blendSchema.safeParse(item);
  return parsed.success ? parsed.data : null;
};

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
    blends: async () => valid(await session.call("/api/blends"), toBlend, "blends"),
    inviteBlend: async (to, topics): Promise<InviteAnswer> => {
      try {
        return { ok: true, blend: blendSchema.parse(await session.write("/api/blends", "POST", { to, topics })) };
      } catch (err: unknown) {
        if (err instanceof ApiError && INVITE_REFUSED.has(err.status)) return { ok: false, problem: err.message };
        throw err;
      }
    },
    acceptBlend: async (id, topics) => blendSchema.parse(await session.write(`/api/blends/${id}/accept`, "POST", { topics })),
    cancelBlend: async (id) => {
      await session.write(`/api/blends/${id}/cancel`, "POST");
    },
  };
}
