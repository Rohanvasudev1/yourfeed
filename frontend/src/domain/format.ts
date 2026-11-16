import { hash } from "./hash";
import { HOURS_PER_DAY, HOURS_PER_MONTH, HOURS_PER_YEAR } from "./time";
import type { Video } from "./types";

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** "88K", "1.9M": the short counts YouTube shows. */
export function compactCount(n: number): string {
  if (n >= 1_000_000) return `${roundForDisplay(n / 1_000_000)}M`;
  if (n >= 1_000) return `${roundForDisplay(n / 1_000)}K`;
  return String(n);
}

/** One decimal under 10 ("1.9"), whole numbers above ("88"). */
const roundForDisplay = (n: number) => (n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10));

/** "3 hours ago", "2 days ago", as in the mockup. */
export function ago(hours: number): string {
  if (hours < HOURS_PER_DAY) return `${plural(hours, "hour")} ago`;
  if (hours < HOURS_PER_MONTH) return `${plural(Math.floor(hours / HOURS_PER_DAY), "day")} ago`;
  if (hours < HOURS_PER_YEAR) return `${plural(Math.floor(hours / HOURS_PER_MONTH), "month")} ago`;
  return `${plural(Math.floor(hours / HOURS_PER_YEAR), "year")} ago`;
}

/** The mockup keyed videos by number, so demo-N hashes as N to keep its durations ("demo-0" → 34:35). */
const DEMO_ID = /^demo-(\d+)$/;
const durationKey = (id: string) => DEMO_ID.exec(id)?.[1] ?? id;

/** A realistic duration badge ("34:35", "1:14:32"): the minutes plus stable seconds per video. */
export function durationText(video: Video): string {
  const total = video.minutes * 60 + (hash(`d${durationKey(video.id)}`) % 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** The title a card shows: the honest one while Honest titles is on. */
export const displayTitle = (video: Video, filters: Readonly<{ honestTitles: boolean }>): string =>
  filters.honestTitles ? video.honestTitle : video.title;

/** Session lengths as the mockup writes them: "45m", "2h", "1h 30m". */
export function minutesText(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** "1 video", "3 videos". */
export const videoCount = (n: number): string => `${n} video${n === 1 ? "" : "s"}`;
