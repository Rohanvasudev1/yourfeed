import { TOPIC_BACKGROUND } from "./topicBackground";
import type { Video } from "./types";

// The real version reads snippet.description from the YouTube API. Demo videos get a generated
// one in the same shape: summary, topic context, chapters, channel sign-off (as in the mockup).

const CHAPTER_NAMES = ["Intro", "Background", "The main part", "Key moments", "Wrap-up"] as const;
const LONG_VIDEO_MINUTES = 40;
const MEDIUM_VIDEO_MINUTES = 15;

const chapterCount = (minutes: number) =>
  minutes >= LONG_VIDEO_MINUTES ? 5 : minutes >= MEDIUM_VIDEO_MINUTES ? 4 : 3;

const timestamp = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Evenly spaced chapters ("0:00 Intro" … "32:48 Wrap-up"); the last is always Wrap-up. */
function chapters(video: Video): string[] {
  const count = chapterCount(video.minutes);
  const names = [...CHAPTER_NAMES.slice(0, count - 1), CHAPTER_NAMES[CHAPTER_NAMES.length - 1]];
  const step = Math.floor((video.minutes * 60) / count);
  return names.map((name, i) => `${timestamp(i * step)} ${name}`);
}

/** The full description, paragraphs separated by blank lines. */
export function describeVideo(video: Video): string {
  return [
    `${video.honestTitle}.`,
    TOPIC_BACKGROUND[video.topic] ?? "",
    `Chapters\n${chapters(video).join("\n")}`,
    `New videos from ${video.channel} every week. Subscribe for more ${video.topic}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The description on one line, for the collapsed preview. */
export const flatDescription = (description: string) => description.replace(/\s*\n+\s*/g, " ");
