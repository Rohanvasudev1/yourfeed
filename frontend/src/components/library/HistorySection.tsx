import { IconHistory, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { videoCount } from "../../domain/format";
import { LibraryRow } from "./LibraryRow";
import { LibrarySection, type LibraryProps } from "./LibrarySection";

/** Watch history, newest first. */
export function HistorySection(props: LibraryProps) {
  const { history } = props.library;
  return (
    <LibrarySection name="Watch history" icon={IconHistory} summary={videoCount(history.length)}>
      <div className="library-toolbar">
        <span className="muted small">Most recent first. Everything uses this to recommend videos.</span>
        {history.length > 0 && <ClearHistory onClear={props.library.clearHistory} />}
      </div>
      {history.length === 0 ? (
        <p className="muted small library-empty">Nothing here yet. Videos you watch will show up here.</p>
      ) : (
        <ul className="session-list" aria-label="Watched videos">
          {history.map((video) => (
            <LibraryRow key={video.id} {...props} video={video} removeFrom="watch history" onRemove={props.library.forgetWatch} />
          ))}
        </ul>
      )}
    </LibrarySection>
  );
}

/** The clear-all button, which asks first. */
function ClearHistory({ onClear }: Readonly<{ onClear: () => void }>) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" className="icon-button" aria-label="Clear watch history" title="Clear history" onClick={() => setConfirming(true)}>
        <IconTrash size={16} aria-hidden="true" />
      </button>
    );
  }
  return (
    <span className="confirm small">
      Clear all history?
      <button type="button" className="text-button danger" onClick={onClear}>
        Clear
      </button>
      <button type="button" className="text-button" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </span>
  );
}
