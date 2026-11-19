import { IconAlertTriangle } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { minutesText, videoCount } from "../domain/format";
import type { Composition, Feed } from "../domain/types";

/** The few words after the minutes: how this kind of feed orders Up next, or how much its rules hide. */
function planNote(feed: Feed, hidden: number): string | null {
  switch (feed.kind) {
    case "home":
      return null;
    case "subs":
      return feed.seed ? "fresh mix" : "newest first";
    case "top":
      return "most views first";
    case "news":
      return "newest first";
    case "shared":
      return "in the sender's order";
    case "claude":
    case "topics":
      return `${hidden} hidden by your rules`;
  }
}

type Props = Readonly<{
  feed: Feed;
  composition: Composition;
  pinnedCount: number;
  /** Buttons at the end of the line, such as Share. */
  actions?: ReactNode;
}>;

/**
 * "Up next · 6 videos · 1h 30m session", counting pinned videos as the mockup does,
 * a warning when the plan falls short of the session minimum, and any actions (Share).
 */
export function UpNextLine({ feed, composition, pinnedCount, actions }: Props) {
  const { upNext, hidden, usedMinutes } = composition;
  const note = planNote(feed, hidden);
  const short = feed.session[0] - usedMinutes;
  return (
    <div className="up-next-line" role="note" aria-label="Session plan">
      <span>
        <b>Up next</b> · {videoCount(pinnedCount + upNext.length)} · {minutesText(usedMinutes)} session{note && ` · ${note}`}
      </span>
      <span className="up-next-actions">
        {short > 0 && (
          <span className="chip warning">
            <IconAlertTriangle size={14} aria-hidden="true" />
            {minutesText(short)} short of your minimum
          </span>
        )}
        {actions}
      </span>
    </div>
  );
}
