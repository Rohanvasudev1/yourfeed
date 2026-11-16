import { youtubeSearchUrl } from "./session";
import type { Feed, Video } from "./types";

/** Which note to write: a video's (the same in every feed) or a feed's own. */
export type NoteTarget = Readonly<{ video: string }> | Readonly<{ feed: string }>;

/** A stable string for a note target, e.g. to say which note voice typing is writing into. */
export const noteKey = (target: NoteTarget): string => ("video" in target ? `video:${target.video}` : `feed:${target.feed}`);

/** Adds dictated words to a note: after a space if it has text, else as its first, capitalised words. */
export function appendDictation(note: string, heard: string): string {
  const words = heard.trim();
  if (!words) return note;
  return note ? `${note.trimEnd()} ${words}` : words.charAt(0).toUpperCase() + words.slice(1);
}

type MarkdownInput = Readonly<{
  feed: Feed;
  videos: readonly Video[];
  notes: Readonly<Record<string, string>>;
}>;

/** Feed notes as Markdown: the feed note, then each session video with its link and notes. */
export function notesMarkdown({ feed, videos, notes }: MarkdownInput): string {
  const intro = feed.note.trim() ? [feed.note.trim(), ""] : [];
  const entries = videos.flatMap((video) => [
    `## ${video.honestTitle}`,
    `${video.channel} · ${video.minutes} min · ${video.id === feed.current ? "Watching now" : "Finished"}`,
    youtubeSearchUrl(video),
    "",
    notes[video.id]?.trim() || "_No notes yet_",
    "",
  ]);
  return [`# ${feed.name} notes`, "", ...intro, ...entries].join("\n");
}
