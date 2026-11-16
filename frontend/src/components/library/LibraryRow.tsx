import { IconCheck, IconPlus } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { displayTitle } from "../../domain/format";
import type { GlobalFilters, Video } from "../../domain/types";
import { PlayableThumbnail, PlayableTitle } from "../Playable";

type Props = Readonly<{
  video: Video;
  filters: GlobalFilters;
  inSession: boolean;
  onPlay: (video: Video) => void;
  onAddToSession: (video: Video) => void;
  /** The row's own action, such as removing it from its folder. Gets the title the row shows. */
  action: (title: string) => ReactNode;
}>;

/** A saved or history video: playable, with + to add it to the current session. */
export function LibraryRow({ video, filters, inSession, onPlay, onAddToSession, action }: Props) {
  const title = displayTitle(video, filters);
  const play = () => onPlay(video);
  return (
    <li className="library-row">
      <PlayableThumbnail video={video} title={title} honest={filters.honestTitles} onPlay={play} />
      <div className="session-body">
        <PlayableTitle title={title} onPlay={play} />
        <p className="card-meta">
          {video.channel} · {video.minutes} min
        </p>
      </div>
      <div className="library-actions">
        {inSession ? (
          <span className="in-session small">
            <IconCheck size={14} aria-hidden="true" />
            In this session
          </span>
        ) : (
          <button
            type="button"
            className="icon-button"
            aria-label={`Add ${title} to this session`}
            title="Add to this session"
            onClick={() => onAddToSession(video)}
          >
            <IconPlus size={16} aria-hidden="true" />
          </button>
        )}
        {action(title)}
      </div>
    </li>
  );
}
