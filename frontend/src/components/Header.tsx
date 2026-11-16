import { IconAdjustmentsHorizontal, IconArrowBackUp } from "@tabler/icons-react";

type Props = Readonly<{
  onRefresh: () => void;
  /** Present for a few seconds after a refresh. */
  onUndoRefresh: (() => void) | null;
}>;

/** The logo loads a new set for the open feed; the round undo button sits in a fixed slot so nothing shifts. */
export function Header({ onRefresh, onUndoRefresh }: Props) {
  return (
    <header className="app-header">
      <button
        type="button"
        className="logo"
        aria-label="Yourfeed: load a new set of videos for this feed"
        title="Load a new set of videos for this feed"
        onClick={onRefresh}
      >
        <IconAdjustmentsHorizontal size={20} aria-hidden="true" />
        <span>Yourfeed</span>
      </button>
      <div className="undo-slot">
        {onUndoRefresh && (
          <button
            type="button"
            className="undo-refresh"
            aria-label="Bring back the previous set"
            title="Bring back the previous set"
            onClick={onUndoRefresh}
          >
            <IconArrowBackUp size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    </header>
  );
}
