import { IconCheck, IconPlus } from "@tabler/icons-react";
import { displayTitle } from "../../domain/format";
import type { GlobalFilters, Video } from "../../domain/types";
import type { CardActions } from "../../state/useCardActions";
import { PlayableThumbnail } from "../Playable";
import { likeRowId } from "./ids";
import "./card.css";

type Props = Readonly<{ video: Video; title: string; filters: GlobalFilters; actions: CardActions; onPlay: (video: Video) => void }>;

/** Videos like this: similar videos in one scrolling row, each with + to add it to the session. */
export function LikeRow({ video, title, filters, actions, onPlay }: Props) {
  return (
    <ul className="like-row" id={likeRowId(video)} aria-label={`Videos like ${title}`}>
      {actions.similarTo(video).map((similar) => {
        const similarTitle = displayTitle(similar, filters);
        const play = () => onPlay(similar);
        return (
          <li key={similar.id} className="like-item">
            <PlayableThumbnail
              video={similar}
              title={similarTitle}
              honest={filters.honestTitles}
              watched={actions.isWatched(similar)}
              onPlay={play}
            />
            <div className="like-item-head">
              {/* Not a heading: these aren't Up next cards. */}
              <button type="button" className="play-title like-item-title clamp" onClick={play}>
                {similarTitle}
              </button>
              {actions.inSession(similar) ? (
                <span className="in-session small" title="In this session">
                  <IconCheck size={14} aria-hidden="true" />
                  <span className="visually-hidden">In this session</span>
                </span>
              ) : (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Add ${similarTitle} to this session`}
                  title="Add to this session"
                  onClick={() => actions.pin(similar)}
                >
                  <IconPlus size={14} aria-hidden="true" />
                </button>
              )}
            </div>
            <p className="card-meta">{similar.channel}</p>
          </li>
        );
      })}
    </ul>
  );
}
