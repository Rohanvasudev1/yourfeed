import { act } from "@testing-library/react";

type ResultEvent = { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] };

/** A stand-in for the browser's SpeechRecognition: tests make it hear words or fail. */
export class FakeRecognition {
  static last: FakeRecognition | undefined;
  continuous = false;
  interimResults = true;
  lang = "";
  onresult: ((event: ResultEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {}
  stop() {
    this.onend?.();
  }
  hear(transcript: string) {
    act(() => this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript } }] }));
  }
  /** The recognizer stopping by itself, as it does after one phrase when not continuous. */
  end() {
    act(() => this.onend?.());
  }
  fail(error: string) {
    act(() => {
      this.onerror?.({ error });
      this.onend?.();
    });
  }
}

/** The recognizer the app started last. */
export const recognition = () => {
  if (!FakeRecognition.last) throw new Error("Voice typing never started");
  return FakeRecognition.last;
};
