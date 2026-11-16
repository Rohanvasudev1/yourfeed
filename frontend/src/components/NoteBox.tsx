import { IconMicrophone, IconPlayerStop } from "@tabler/icons-react";
import type { NoteBinding } from "../state/useNotes";
import "./notes.css";

type Props = Readonly<{
  /** The box's accessible name, e.g. "Notes on <title>". */
  label: string;
  placeholder: string;
  note: NoteBinding;
}>;

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * A note's text box with a mic for voice typing. It's a controlled textarea that is never
 * remounted while the note changes, so typing keeps focus and the cursor.
 */
export function NoteBox({ label, placeholder, note }: Props) {
  const Icon = note.listening ? IconPlayerStop : IconMicrophone;
  return (
    <div className="note-box">
      <textarea rows={2} aria-label={label} placeholder={placeholder} value={note.value} onChange={(e) => note.onChange(e.target.value)} />
      <button
        type="button"
        className={note.listening ? "icon-button recording" : "icon-button"}
        aria-pressed={note.listening}
        aria-label={`${note.listening ? "Stop dictating" : "Dictate"} ${lowerFirst(label)}`}
        title={note.listening ? "Stop voice typing" : "Type with your voice"}
        onClick={note.onToggleVoice}
      >
        <Icon size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
