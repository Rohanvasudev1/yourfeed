import { ago } from "./format";
import { hash } from "./hash";
import type { Share } from "./share";
import { MS_PER_HOUR } from "./time";
import type { Composition, Feed, Video } from "./types";

/** One feed someone sent: who sent it (null for a link, which carries no sender), what's in it, and whether it's been opened. */
export type InboxShare = Readonly<{
  /** Demo shares are `demo-share-N`; a link's id is a hash of its contents, so the same link is only added once. */
  id: string;
  from: string | null;
  title: string;
  videos: readonly string[];
  message: string;
  notes: Readonly<Record<string, string>>;
  /** When it arrived, in epoch milliseconds. */
  received: number;
  unread: boolean;
}>;

/**
 * Shared with you: the shares, newest first; the one open in the Shared with you feed;
 * and `sessionShare`, the one that feed's session belongs to, so reopening it picks up where you left off.
 */
export type Inbox = Readonly<{ shares: readonly InboxShare[]; open: string | null; sessionShare: string | null }>;

export const BROKEN_LINK = "This share link doesn't work.";

/** The inbox entry for a link opened now, or null when the link names a video the catalog doesn't have. */
export function shareFromLink(share: Share, catalogIds: ReadonlySet<string>, now: number): InboxShare | null {
  if (!share.videos.every((id) => catalogIds.has(id))) return null;
  const message = share.message ?? "";
  const notes = share.notes ?? {};
  const contents = JSON.stringify([share.title, share.videos, message, Object.entries(notes)]);
  return { id: `link-${hash(contents).toString(36)}`, from: null, title: share.title, videos: share.videos, message, notes, received: now, unread: true };
}

export const unreadCount = (inbox: Inbox): number => inbox.shares.filter((s) => s.unread).length;

export const openShareOf = (inbox: Inbox): InboxShare | null => inbox.shares.find((s) => s.id === inbox.open) ?? null;

/** "@maya.k", or "a link" for a share that came from a link. */
export const senderName = (share: InboxShare): string => (share.from === null ? "a link" : `@${share.from}`);

/** The name Save as my feed gives: "<title> from @<name>". */
export const savedFeedName = (share: InboxShare): string => `${share.title} from ${senderName(share)}`;

/** "Just now", "2 hours ago", "3 days ago". */
export function receivedAgo(share: InboxShare, now: number): string {
  const hours = Math.floor(Math.max(0, now - share.received) / MS_PER_HOUR);
  return hours === 0 ? "Just now" : ago(hours);
}

/** The shared videos the catalog has, in the sender's order. */
export const sharedVideos = (share: InboxShare, byId: ReadonlyMap<string, Video>): Video[] => share.videos.flatMap((id) => byId.get(id) ?? []);

/** An open share's Up next: its videos in the sender's order, less what's pinned, in the session or removed. Nothing is hidden. */
export function composeShared(share: InboxShare, feed: Feed, byId: ReadonlyMap<string, Video>): Composition {
  const committed = [...feed.pinned, ...feed.finished, ...(feed.current === null ? [] : [feed.current])];
  const left = new Set([...committed, ...feed.removed]);
  const upNext = sharedVideos(share, byId).filter((v) => !left.has(v.id));
  const minutes = (videos: readonly Video[]) => videos.reduce((sum, v) => sum + v.minutes, 0);
  return { upNext, reasons: new Map(upNext.map((v) => [v.id, { kind: "shared" } as const])), hidden: 0, usedMinutes: minutes(committed.flatMap((id) => byId.get(id) ?? [])) + minutes(upNext) };
}
