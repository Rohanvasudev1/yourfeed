import { IconArrowLeft, IconCheck, IconPlus } from "@tabler/icons-react";
import { displayTitle } from "../../domain/format";
import type { GlobalFilters, Video } from "../../domain/types";
import type { SaveActions } from "../../state/useLibrary";
import { Flash } from "../Flash";
import { SaveControl } from "../library/SaveControl";
import { PlayableThumbnail, PlayableTitle } from "../Playable";
import "../library/library.css";
import "./search.css";

type Props = Readonly<{
  query: string;
  results: readonly Video[];
  /** The open feed, where + pins a result. */
  feedName: string;
  filters: GlobalFilters;
  inSession: (video: Video) => boolean;
  onPin: (video: Video) => void;
  onPlay: (video: Video) => void;
  saveActions: SaveActions;
  onBack: () => void;
  /** Messages from playing a result, such as a blocked pop-up. */
  flash: string | null;
}>;

const resultCount = (n: number) => `${n} result${n === 1 ? "" : "s"}`;

/** "<n> results for <query>": every matching video, each playable and with + to pin it to the open feed. */
export function SearchPage({ query, results, feedName, filters, inSession, onPin, onPlay, saveActions, onBack, flash }: Props) {
  return (
    <section className="search-page" aria-label="Search results">
      <div className="search-page-header">
        <button type="button" className="icon-button" aria-label="Back to feed" title="Back" onClick={onBack}>
          <IconArrowLeft size={17} aria-hidden="true" />
        </button>
        <h2 className="search-page-title">
          <b>{resultCount(results.length)}</b> for "{query}"
        </h2>
        <span className="muted small search-page-target">Adding to: {feedName}</span>
      </div>
      <Flash message={flash} />
      {results.length === 0 ? (
        <p className="search-empty">No videos match that search. Try a channel name or topic.</p>
      ) : (
        <ul className="session-list" aria-label="Results">
          {results.map((video) => (
            <SearchResult
              key={video.id}
              video={video}
              filters={filters}
              inSession={inSession(video)}
              onPin={onPin}
              onPlay={onPlay}
              saveActions={saveActions}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

type ResultProps = Readonly<{
  video: Video;
  filters: GlobalFilters;
  inSession: boolean;
  onPin: (video: Video) => void;
  onPlay: (video: Video) => void;
  saveActions: SaveActions;
}>;

/** A result row; Save's folder picker opens below it. */
function SearchResult({ video, filters, inSession, onPin, onPlay, saveActions }: ResultProps) {
  const title = displayTitle(video, filters);
  const play = () => onPlay(video);
  return (
    <li className="library-row">
      <PlayableThumbnail video={video} title={title} honest={filters.honestTitles} onPlay={play} />
      <div className="session-body">
        <PlayableTitle title={title} onPlay={play} />
        <p className="card-meta">
          {video.channel} · {video.topic} · {video.minutes} min
        </p>
      </div>
      <div className="library-actions">
        <SaveControl video={video} title={title} saveActions={saveActions} />
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
            onClick={() => onPin(video)}
          >
            <IconPlus size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
}
