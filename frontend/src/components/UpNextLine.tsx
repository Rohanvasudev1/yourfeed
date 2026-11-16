import { IconAlertTriangle } from "@tabler/icons-react";
import { minutesText, videoCount } from "../domain/format";
import type { Composition, Feed } from "../domain/types";

/** The few words after the minutes that say how this kind of feed orders Up next. */
function orderNote(feed: Feed, hidden: number): string | null {
  switch (feed.kind) {
    case "home":
      return null;
    case "subs":
      return feed.seed ? "fresh mix" : "newest first";
    case "top":
      return "most views first";
    case "news":
      return "newest first";
    case "claude":
    case "topics":
      return `${hidden} hidden by your rules`;
  }
}

/** "Up next · 6 videos · 1h 30m session", and a warning when the plan falls short of the session minimum. */
export function UpNextLine({ feed, composition }: Readonly<{ feed: Feed; composition: Composition }>) {
  const { upNext, hidden, usedMinutes } = composition;
  const note = orderNote(feed, hidden);
  const short = feed.session[0] - usedMinutes;
  return (
    <div className="up-next-line" role="note" aria-label="Session plan">
      <span>
        <b>Up next</b> · {videoCount(upNext.length)} · {minutesText(usedMinutes)} session{note && ` · ${note}`}
      </span>
      {short > 0 && (
        <span className="chip warning">
          <IconAlertTriangle size={14} aria-hidden="true" />
          {minutesText(short)} short of your minimum
        </span>
      )}
    </div>
  );
}
