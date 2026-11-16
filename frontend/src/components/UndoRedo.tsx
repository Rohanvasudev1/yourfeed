import { IconArrowBackUp, IconArrowForwardUp, type Icon } from "@tabler/icons-react";
import { useLayoutEffect, useRef, type RefObject } from "react";

type Props = Readonly<{ undoCount: number; redoCount: number; onUndo: () => void; onRedo: () => void }>;

type Which = "undo" | "redo";

const withCount = (label: string, count: number) => (count > 1 ? `${label} (${count} steps)` : label);

/**
 * Undo and redo for feed settings. Each shows only while it has steps, with a count badge from 2 up.
 * Using the last step of one hides it, so focus moves to the other, which always exists by then.
 */
export function UndoRedo({ undoCount, redoCount, onUndo, onRedo }: Props) {
  const undoRef = useRef<HTMLButtonElement>(null);
  const redoRef = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<Which | null>(null);

  useLayoutEffect(() => {
    if (focusNext.current === null) return;
    (focusNext.current === "undo" ? undoRef : redoRef).current?.focus();
    focusNext.current = null;
  });

  const use = (count: number, other: Which, run: () => void) => () => {
    if (count === 1) focusNext.current = other;
    run();
  };

  if (undoCount === 0 && redoCount === 0) return null;
  return (
    <div className="undo-redo">
      {undoCount > 0 && (
        <StepButton
          buttonRef={undoRef}
          label={withCount("Undo last change", undoCount)}
          title="Undo last change"
          count={undoCount}
          icon={IconArrowBackUp}
          onClick={use(undoCount, "redo", onUndo)}
        />
      )}
      {redoCount > 0 && (
        <StepButton
          buttonRef={redoRef}
          label={withCount("Redo the change you undid", redoCount)}
          title="Redo"
          count={redoCount}
          icon={IconArrowForwardUp}
          onClick={use(redoCount, "undo", onRedo)}
        />
      )}
    </div>
  );
}

type StepButtonProps = Readonly<{
  buttonRef: RefObject<HTMLButtonElement | null>;
  label: string;
  title: string;
  count: number;
  icon: Icon;
  onClick: () => void;
}>;

function StepButton({ buttonRef, label, title, count, icon: Icon, onClick }: StepButtonProps) {
  return (
    <button ref={buttonRef} type="button" className="step-button" aria-label={label} title={title} onClick={onClick}>
      <Icon size={16} aria-hidden="true" />
      {count > 1 && <span aria-hidden="true">{count}</span>}
    </button>
  );
}
