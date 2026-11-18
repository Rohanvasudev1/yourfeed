import type { Dispatch } from "react";
import { noteKey, notesMarkdown, type NoteTarget } from "../domain/notes";
import type { Feed, Video } from "../domain/types";
import type { Action } from "./appState";
import { useVoiceTyping } from "./useVoiceTyping";

const COPIED = "Notes copied.";
const NO_CLIPBOARD = "Copying isn't available here. Select the notes and copy them yourself.";
const COPY_FAILED = "Couldn't copy the notes. Try again.";
const DICTATION = { name: "Voice typing", purpose: "dictate notes" } as const;

/** One note's text and what a notes box can do with it. */
export type NoteBinding = Readonly<{
  value: string;
  onChange: (text: string) => void;
  listening: boolean;
  onToggleVoice: () => void;
}>;

type Input = Readonly<{
  feed: Feed;
  /** The feed's session videos, Finished first, then Watching now. */
  videos: readonly Video[];
  notes: Readonly<Record<string, string>>;
  dispatch: Dispatch<Action>;
  /** Shows a short message in the app's one flash, replacing whatever it showed. */
  showFlash: (message: string) => void;
}>;

/** Notes on the open feed's videos and on the feed itself: typing, voice typing and copying. */
export function useNotes({ feed, videos, notes, dispatch, showFlash }: Input) {
  const voice = useVoiceTyping<NoteTarget>({
    keyOf: noteKey,
    continuous: true,
    words: DICTATION,
    onHeard: (target, heard) => dispatch({ type: "add_dictation", target, heard }),
    onMessage: showFlash,
  });

  const bind = (target: NoteTarget, value: string): NoteBinding => ({
    value,
    onChange: (text) => dispatch({ type: "set_note", target, text }),
    listening: voice.isListening(target),
    onToggleVoice: () => voice.toggle(target),
  });

  const copy = () => {
    if (!navigator.clipboard) return showFlash(NO_CLIPBOARD);
    navigator.clipboard.writeText(notesMarkdown({ feed, videos, notes })).then(
      () => showFlash(COPIED),
      (error: unknown) => {
        console.warn("Copying notes failed", error);
        showFlash(COPY_FAILED);
      },
    );
  };

  return {
    forVideo: (id: string) => bind({ video: id }, notes[id] ?? ""),
    forFeed: bind({ feed: feed.name }, feed.note),
    copy,
  };
}

export type Notes = ReturnType<typeof useNotes>;
