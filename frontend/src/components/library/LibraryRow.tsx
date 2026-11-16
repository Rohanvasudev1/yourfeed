import { IconCheck, IconPlus, IconX } from "@tabler/icons-react";
import { displayTitle } from "../../domain/format";
import type { Video } from "../../domain/types";
import { PlayableThumbnail, PlayableTitle } from "../Playable";
import type { LibraryProps } from "./LibrarySection";

type Props = LibraryProps &
  Readonly<{
    video: Video;
    /** Where the row's X takes the video out of, as in "Remove <title> from <removeFrom>". */
    removeFrom: string;
    onRemove: (video: Video) => void;
  }>;

/** A saved or history video: playable, with + to add it to the current session and X to remove it. */
export function LibraryRow({ video, library, filters, onPlay, removeFrom, onRemove }: Props) {
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
        {library.inSession(video) ? (
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
            onClick={() => library.pin(video)}
          >
            <IconPlus size={16} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="icon-button"
          aria-label={`Remove ${title} from ${removeFrom}`}
          title={`Remove from ${removeFrom}`}
          onClick={() => onRemove(video)}
        >
          <IconX size={16} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
