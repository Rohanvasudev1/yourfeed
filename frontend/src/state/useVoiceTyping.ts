import { useEffect, useRef, useState } from "react";
import { noteKey, type NoteTarget } from "../domain/notes";

/** The slice of the Web Speech API voice typing uses. TypeScript's DOM types don't include it. */
type SpeechResultEvent = Readonly<{
  resultIndex: number;
  results: ArrayLike<Readonly<{ isFinal: boolean; 0: Readonly<{ transcript: string }> }>>;
}>;
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: Readonly<{ error: string }>) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionClass = new () => Recognition;

const FALLBACK_LANGUAGE = "en-US";
const UNSUPPORTED = "Voice typing isn't available in this browser. Try Chrome, Edge or Safari.";
const START_FAILED = "Couldn't start voice typing. Try again.";

function errorMessage(error: string): string | null {
  if (error === "aborted") return null;
  if (error === "not-allowed" || error === "service-not-allowed") return "Microphone access is blocked. Allow it for this page to dictate notes.";
  if (error === "no-speech") return "Didn't catch anything. Tap the mic and try again.";
  return "Voice typing stopped. Tap the mic to try again.";
}

function recognitionClass(): RecognitionClass | undefined {
  const speech = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return speech.SpeechRecognition ?? speech.webkitSpeechRecognition;
}

function finalTranscript(event: SpeechResultEvent): string {
  return Array.from(event.results)
    .slice(event.resultIndex)
    .filter((result) => result.isFinal)
    .map((result) => result[0].transcript.trim())
    .filter(Boolean)
    .join(" ");
}

type Handlers = Readonly<{
  onHeard: (target: NoteTarget, heard: string) => void;
  onMessage: (message: string) => void;
}>;

/** Voice typing into one note at a time. Starting it on another note stops the first. */
export function useVoiceTyping({ onHeard, onMessage }: Handlers) {
  const [listening, setListening] = useState<NoteTarget | null>(null);
  const active = useRef<Recognition | null>(null);

  // `active` is cleared before stopping, so the recognizer's onend leaves state alone.
  const stopActive = () => {
    const recognition = active.current;
    active.current = null;
    recognition?.stop();
  };
  useEffect(() => stopActive, []);

  const start = (target: NoteTarget) => {
    const SpeechRecognition = recognitionClass();
    if (!SpeechRecognition) return onMessage(UNSUPPORTED);
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = navigator.language || FALLBACK_LANGUAGE;
    recognition.onresult = (event) => {
      const heard = finalTranscript(event);
      if (heard) onHeard(target, heard);
    };
    recognition.onerror = (event) => {
      console.warn("Voice typing error", event.error);
      const message = errorMessage(event.error);
      if (message) onMessage(message);
    };
    recognition.onend = () => {
      if (active.current !== recognition) return;
      active.current = null;
      setListening(null);
    };
    try {
      recognition.start();
    } catch (error) {
      console.warn("Voice typing failed to start", error);
      return onMessage(START_FAILED);
    }
    active.current = recognition;
    setListening(target);
  };

  const isListening = (target: NoteTarget) => listening !== null && noteKey(listening) === noteKey(target);

  const toggle = (target: NoteTarget) => {
    const wasThisNote = isListening(target);
    stopActive();
    setListening(null);
    if (!wasThisNote) start(target);
  };

  return { isListening, toggle };
}
