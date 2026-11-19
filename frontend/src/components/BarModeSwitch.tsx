import { IconPencil, IconPlus } from "@tabler/icons-react";
import type { BarMode } from "../domain/assistant";
import "./barModeSwitch.css";

const TOOLTIP_ID = "bar-mode-tip";

type Props = Readonly<{
  mode: BarMode;
  feedName: string;
  /** Built-in feeds can't be edited, so the switch stays on new. */
  locked: boolean;
  onChange: (mode: BarMode) => void;
}>;

function tooltip(mode: BarMode, feedName: string, locked: boolean) {
  if (locked) return { head: "Making a new feed", body: `${feedName} is built in and can't be edited, so Claude starts a new feed from what you ask.` };
  if (mode === "new") return { head: "Making a new feed", body: `Claude starts a new tab from what you ask. Click to edit ${feedName} instead.` };
  return { head: `Editing ${feedName}`, body: "Claude changes this feed's topics and settings. Click to start a new feed instead." };
}

/** The Claude bar's edit/new switch: whether a request changes this feed or starts a new one. */
export function BarModeSwitch({ mode, feedName, locked, onChange }: Props) {
  const isNew = mode === "new";
  const { head, body } = tooltip(mode, feedName, locked);
  return (
    <button
      type="button"
      role="switch"
      className={`cmode${isNew ? " new" : ""}`}
      aria-label="New feed mode"
      aria-checked={isNew}
      // aria-disabled rather than disabled, so the switch stays focusable and its tooltip can say why.
      aria-disabled={locked || undefined}
      aria-describedby={TOOLTIP_ID}
      onClick={() => {
        if (!locked) onChange(isNew ? "edit" : "new");
      }}
    >
      <span className="mtrack" aria-hidden="true">
        <IconPencil className="mend" size={11} />
        <IconPlus className="mend" size={11} />
        <span className="mknob">{isNew ? <IconPlus size={12} /> : <IconPencil size={12} />}</span>
      </span>
      <span id={TOOLTIP_ID} className="ctip" role="tooltip">
        <b>{head}</b> {body}
      </span>
    </button>
  );
}
