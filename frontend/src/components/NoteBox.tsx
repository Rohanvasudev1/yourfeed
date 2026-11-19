import { IconMicrophone, IconPlayerStop } from "@tabler/icons-react";
import { useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import { questionBeforeCaret } from "../domain/askNotes";
import type { AskBinding } from "../state/useAskNotes";
import type { NoteBinding } from "../state/useNotes";
import { AskButton, AskHint } from "./AskControls";
import { NoteMirror } from "./NoteMirror";
import { useKeptSelection } from "./useKeptSelection";
import "./notes.css";

type Props = Readonly<{
  /** The box's accessible name, e.g. "Notes on <title>". */
  label: string;
  placeholder: string;
  note: NoteBinding;
}>;

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** Enter (not Shift+Enter, nor one that ends an IME composition) at the end of a question line asks it; the newline is typed as usual. */
function askOnEnter(ask: AskBinding) {
  return (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    const question = questionBeforeCaret(e.currentTarget.value, e.currentTarget.selectionStart);
    if (question) ask.askQuestion(question);
  };
}

/** Grows the text box with its text, so the mirror under it never has to scroll. */
function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string, on: boolean) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, value, on]);
}

/**
 * A note's text box with a mic for voice typing and, on video notes, Ask in notes. It's a
 * controlled textarea that is never remounted while the note changes, so typing keeps focus
 * and the cursor; answers inserted from outside keep them too.
 */
export function NoteBox({ label, placeholder, note }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const track = useKeptSelection(ref, note.value);
  const { ask } = note;
  useAutoGrow(ref, note.value, ask !== undefined);
  const Icon = note.listening ? IconPlayerStop : IconMicrophone;

  const textarea = (
    <textarea
      ref={ref}
      rows={2}
      aria-label={label}
      aria-busy={ask ? ask.waiting.length > 0 : undefined}
      // As in the mockup, video notes say how to ask right in the empty box.
      placeholder={ask ? `${placeholder}. End a line with ? to ask.` : placeholder}
      value={note.value}
      onChange={(e) => {
        track();
        note.onChange(e.target.value);
      }}
      onSelect={track}
      onKeyDown={ask && askOnEnter(ask)}
    />
  );

  return (
    <div className="note-box-wrap">
      <div className="note-box">
        {ask ? (
          <div className="note-sheet" onClick={() => ref.current?.focus()}>
            <div className="ink-wrap">
              <NoteMirror value={note.value} waiting={ask.waiting} inking={ask.inking} />
              {textarea}
            </div>
          </div>
        ) : (
          textarea
        )}
        <div className="note-tools">
          {ask && <AskButton ask={ask} subject={lowerFirst(label)} />}
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
      </div>
      {ask && <AskHint message={ask.message} />}
    </div>
  );
}
