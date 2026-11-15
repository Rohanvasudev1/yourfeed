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

/** A realistic duration badge ("34:35", "1:14:32"): the minutes plus stable seconds per video. */
export function durationText(video: Video): string {
  const total = video.minutes * 60 + (hash(`d${video.id}`) % 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
