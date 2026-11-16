import { IconHistory, IconTrash, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { videoCount } from "../../domain/format";
import type { GlobalFilters, Video } from "../../domain/types";
import type { Library } from "../../state/useLibrary";
import { LibraryRow } from "./LibraryRow";
import { LibrarySection } from "./LibrarySection";

type Props = Readonly<{ library: Library; filters: GlobalFilters; onPlay: (video: Video) => void }>;

/** Watch history, newest first. Clearing all of it asks first. */
export function HistorySection({ library, filters, onPlay }: Props) {
  const { history } = library;
  const [confirming, setConfirming] = useState(false);
  const clear = () => {
    library.clearHistory();
    setConfirming(false);
  };

  return (
    <LibrarySection name="Watch history" icon={IconHistory} summary={videoCount(history.length)}>
      <div className="library-toolbar">
        <span className="muted small">Most recent first. Everything uses this to recommend videos.</span>
        {confirming ? (
          <span className="confirm small">
            Clear all history?
            <button type="button" className="text-button danger" onClick={clear}>
              Clear
            </button>
            <button type="button" className="text-button" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </span>
        ) : (
          history.length > 0 && (
            <button
              type="button"
              className="icon-button"
              aria-label="Clear watch history"
              title="Clear history"
              onClick={() => setConfirming(true)}
            >
              <IconTrash size={16} aria-hidden="true" />
            </button>
          )
        )}
      </div>
      {history.length === 0 ? (
        <p className="muted small library-empty">Nothing here yet. Videos you watch will show up here.</p>
      ) : (
        <ul className="session-list" aria-label="Watched videos">
          {history.map((video) => (
            <LibraryRow
              key={video.id}
              video={video}
              filters={filters}
              inSession={library.inSession(video)}
              onPlay={onPlay}
              onAddToSession={library.pin}
              action={(title) => (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove ${title} from watch history`}
                  title="Remove from history"
                  onClick={() => library.forget(video)}
                >
                  <IconX size={16} aria-hidden="true" />
                </button>
              )}
            />
          ))}
        </ul>
      )}
    </LibrarySection>
  );
}
