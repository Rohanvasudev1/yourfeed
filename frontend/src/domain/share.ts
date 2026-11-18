import { z } from "zod";

/**
 * Share links carry the feed itself (ADR 0008): compact JSON in URL-safe base64 inside the URL
 * fragment, so nothing reaches a server and no storage is needed. Links are untrusted input.
 */

/** Size limits from ADR 0008. Notes count every note's characters together. */
export const SHARE_LIMITS = { title: 60, videos: 50, message: 280, notes: 2000 } as const;

const FORMAT_VERSION = 1;
const FRAGMENT_PREFIX = "#share=";
/** Longer than any share within the limits can encode to; anything longer is refused unread. */
const MAX_ENCODED_LENGTH = 40_000;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
/** Catalog ids are short ("demo-12"); anything this long isn't one. */
const MAX_VIDEO_ID_LENGTH = 100;

/** A shared feed: its name, its videos in order, and optionally a message and the sender's notes by video id. */
export type Share = Readonly<{
  title: string;
  videos: readonly string[];
  message?: string;
  notes?: Readonly<Record<string, string>>;
}>;

const notesLength = (notes: Readonly<Record<string, string>>) => Object.values(notes).reduce((sum, note) => sum + note.length, 0);

const shareSchema = z
  .strictObject({
    v: z.literal(FORMAT_VERSION),
    title: z.string().max(SHARE_LIMITS.title).refine((t) => t.trim().length > 0, "the title is empty"),
    videos: z.array(z.string().min(1).max(MAX_VIDEO_ID_LENGTH)).min(1).max(SHARE_LIMITS.videos),
    message: z.string().max(SHARE_LIMITS.message).optional(),
    notes: z.record(z.string(), z.string().min(1)).optional(),
  })
  .refine((s) => new Set(s.videos).size === s.videos.length, "a video is listed twice")
  .refine((s) => !s.notes || notesLength(s.notes) <= SHARE_LIMITS.notes, "notes are too long")
  .refine((s) => !s.notes || Object.keys(s.notes).every((id) => s.videos.includes(id)), "notes name a video that isn't shared");

/** What's wrong with a share the visitor is about to send, in their words, or null when it fits. */
function shareProblem(share: Share): string | null {
  if (share.videos.length === 0) return "Pick at least one video to share.";
  if (!share.title.trim()) return "Name the feed before sharing it.";
  if (share.videos.length > SHARE_LIMITS.videos) return `Share ${SHARE_LIMITS.videos} videos at most. Untick some first.`;
  if (share.title.length > SHARE_LIMITS.title) return `Feed names in a link are ${SHARE_LIMITS.title} characters at most.`;
  if ((share.message ?? "").length > SHARE_LIMITS.message) return `Messages are ${SHARE_LIMITS.message} characters at most.`;
  if (share.notes && notesLength(share.notes) > SHARE_LIMITS.notes)
    return `Your notes are over ${SHARE_LIMITS.notes.toLocaleString("en-US")} characters. Untick some videos or leave the notes out.`;
  return null;
}

const toBase64Url = (text: string): string =>
  btoa(Array.from(new TextEncoder().encode(text), (byte) => String.fromCharCode(byte)).join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const fromBase64Url = (encoded: string): string =>
  new TextDecoder("utf-8", { fatal: true }).decode(
    Uint8Array.from(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0)),
  );

export type EncodeResult = Readonly<{ ok: true; encoded: string }> | Readonly<{ ok: false; problem: string }>;

/** Encodes a share for a link, or says why it can't (over a limit, or nothing picked). */
export function encodeShare(share: Share): EncodeResult {
  const problem = shareProblem(share);
  if (problem) return { ok: false, problem };
  const { title, videos, message, notes } = share;
  return { ok: true, encoded: toBase64Url(JSON.stringify({ v: FORMAT_VERSION, title, videos, message, notes })) };
}

/** Reads an encoded share from an untrusted link, or null when it's malformed or over the limits. */
export function decodeShare(encoded: string): Share | null {
  if (encoded.length > MAX_ENCODED_LENGTH || !BASE64URL.test(encoded)) return null;
  let json: unknown;
  try {
    json = JSON.parse(fromBase64Url(encoded));
  } catch {
    return null;
  }
  const result = shareSchema.safeParse(json);
  if (!result.success) return null;
  const { title, videos, message, notes } = result.data;
  return { title, videos, ...(message === undefined ? {} : { message }), ...(notes === undefined ? {} : { notes }) };
}

/** What a share starts with: each video once, in the order of `groups` (the session, pinned videos, then Up next). */
export function shareStartingVideos<T extends Readonly<{ id: string }>>(...groups: readonly (readonly T[])[]): T[] {
  return [...new Map(groups.flat().map((video) => [video.id, video])).values()];
}

/** The link to a share: `base` (the app's address) with the share in its fragment. */
export const shareUrl = (base: string, encoded: string): string => `${base.split("#")[0]}${FRAGMENT_PREFIX}${encoded}`;

/** The encoded share in a URL fragment (`location.hash`), or null when the fragment isn't a share link. */
export function readShareFragment(hash: string): string | null {
  if (!hash.startsWith(FRAGMENT_PREFIX)) return null;
  return hash.slice(FRAGMENT_PREFIX.length) || null;
}
