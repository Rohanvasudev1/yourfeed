import { useEffect, useRef, useState } from "react";

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

/** How messages name the feature: "Voice typing" to "dictate notes", "Voice search" to "search by voice". */
export type VoiceWords = Readonly<{ name: string; purpose: string }>;

const unsupported = ({ name }: VoiceWords) => `${name} isn't available in this browser. Try Chrome, Edge or Safari.`;
const startFailed = ({ name }: VoiceWords) => `Couldn't start ${name.toLowerCase()}. Try again.`;

function errorMessage(error: string, words: VoiceWords): string | null {
  if (error === "aborted") return null;
  if (error === "not-allowed" || error === "service-not-allowed") return `Microphone access is blocked. Allow it for this page to ${words.purpose}.`;
  if (error === "no-speech") return "Didn't catch anything. Tap the mic and try again.";
  return `${words.name} stopped. Tap the mic to try again.`;
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

type Options<T> = Readonly<{
  /** Tells targets apart: starting on one target stops another. */
  keyOf: (target: T) => string;
  /** Keep listening until stopped (dictation), or stop after one phrase (a search). */
  continuous: boolean;
  words: VoiceWords;
  onHeard: (target: T, heard: string) => void;
  onMessage: (message: string) => void;
}>;

/** Voice input into one target at a time, such as a note or the search box. Starting it on another target stops the first. */
export function useVoiceTyping<T>({ keyOf, continuous, words, onHeard, onMessage }: Options<T>) {
  const [listening, setListening] = useState<T | null>(null);
  const active = useRef<Recognition | null>(null);

  // `active` is cleared before stopping, so the recognizer's onend leaves state alone.
  const stopActive = () => {
    const recognition = active.current;
    active.current = null;
    recognition?.stop();
  };
  useEffect(() => stopActive, []);

  const start = (target: T) => {
    const SpeechRecognition = recognitionClass();
    if (!SpeechRecognition) return onMessage(unsupported(words));
    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = false;
    recognition.lang = navigator.language || FALLBACK_LANGUAGE;
    recognition.onresult = (event) => {
      const heard = finalTranscript(event);
      if (heard) onHeard(target, heard);
    };
    recognition.onerror = (event) => {
      console.warn(`${words.name} error`, event.error);
      const message = errorMessage(event.error, words);
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
      console.warn(`${words.name} failed to start`, error);
      return onMessage(startFailed(words));
    }
    active.current = recognition;
    setListening(target);
  };

  const isListening = (target: T) => listening !== null && keyOf(listening) === keyOf(target);

  const toggle = (target: T) => {
    const wasThisNote = isListening(target);
    stopActive();
    setListening(null);
    if (!wasThisNote) start(target);
  };

  return { isListening, toggle };
}
