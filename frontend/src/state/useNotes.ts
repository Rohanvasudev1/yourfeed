import type { Dispatch } from "react";
import { noteKey, notesMarkdown, type NoteTarget } from "../domain/notes";
import type { Feed, Video } from "../domain/types";
import type { AssistantPort } from "../ports";
import type { Action } from "./appState";
import { copyText, type CopyMessages } from "./copyText";
import { useAskNotes, type AskBinding } from "./useAskNotes";
import { useVoiceTyping } from "./useVoiceTyping";

const COPY_MESSAGES: CopyMessages = {
  copied: "Notes copied.",
  noClipboard: "Copying isn't available here. Select the notes and copy them yourself.",
  failed: "Couldn't copy the notes. Try again.",
};
const DICTATION = { name: "Voice typing", purpose: "dictate notes" } as const;

/** One note's text and what a notes box can do with it. */
export type NoteBinding = Readonly<{
  value: string;
  onChange: (text: string) => void;
  listening: boolean;
  onToggleVoice: () => void;
  /** Ask in notes, on video notes only. */
  ask?: AskBinding;
}>;

type Input = Readonly<{
  feed: Feed;
  /** The feed's session videos, Finished first, then Watching now. */
  videos: readonly Video[];
  notes: Readonly<Record<string, string>>;
  assistant: AssistantPort;
  dispatch: Dispatch<Action>;
  /** Shows a short message in the app's one flash, replacing whatever it showed. */
  showFlash: (message: string) => void;
}>;

/** Notes on the open feed's videos and on the feed itself: typing, voice typing, asking and copying. */
export function useNotes({ feed, videos, notes, assistant, dispatch, showFlash }: Input) {
  const askFor = useAskNotes({ assistant, notes, dispatch });
  const voice = useVoiceTyping<NoteTarget>({
    keyOf: noteKey,
    continuous: true,
    words: DICTATION,
    onHeard: (target, heard) => dispatch({ type: "add_dictation", target, heard, at: Date.now() }),
    onMessage: showFlash,
  });

  const bind = (target: NoteTarget, value: string): NoteBinding => ({
    value,
    onChange: (text) => dispatch({ type: "set_note", target, text, at: Date.now() }),
    listening: voice.isListening(target),
    onToggleVoice: () => voice.toggle(target),
  });

  const copy = () => copyText(notesMarkdown({ feed, videos, notes }), COPY_MESSAGES, showFlash);

  return {
    forVideo: (id: string): NoteBinding => ({ ...bind({ video: id }, notes[id] ?? ""), ask: askFor(id) }),
    forFeed: bind({ feed: feed.name }, feed.note),
    copy,
  };
}

export type Notes = ReturnType<typeof useNotes>;
