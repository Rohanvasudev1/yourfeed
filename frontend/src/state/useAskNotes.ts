import { useEffect, useRef, useState, type Dispatch } from "react";
import { MAX_QUESTION_CHARS, questionsIn, unansweredQuestions } from "../domain/askNotes";
import type { AssistantPort } from "../ports";
import type { Action } from "./appState";

export const ASK_MESSAGES = {
  tooLong: `Keep questions under ${MAX_QUESTION_CHARS} characters`,
  allAnswered: "Your questions are already answered. Write a new line ending in ?",
  noQuestion: "Write a question in your notes ending in ?, then press Enter",
  failed: "Couldn't answer that right now. Try again.",
} as const;

/** How long one word of a new answer waits after the one before it, and how long the last one takes to ink in. */
export const INK_WORD_MS = 45;
const INK_MS = 500;

/** What a video's notes box shows and does for Ask in notes. */
export type AskBinding = Readonly<{
  /** Questions on their way to the assistant, trimmed. */
  waiting: readonly string[];
  /** Answers just inserted, still inking in word by word. */
  inking: readonly string[];
  /** An error or no-op message in place of the hint, or null for the hint. */
  message: string | null;
  /** Enter after a question line: asks it. */
  ask: (question: string) => void;
  /** The ✱ button: asks the last question with no answer, or says why it can't. */
  askLast: () => void;
}>;

type PerVideo<T> = Readonly<Record<string, T>>;
const NONE: readonly string[] = [];

const without = <T>(map: PerVideo<T>, key: string): PerVideo<T> => Object.fromEntries(Object.entries(map).filter(([k]) => k !== key));
const removeOne = (list: readonly string[] | undefined, item: string) => (list ?? NONE).filter((x) => x !== item);

type Input = Readonly<{
  assistant: AssistantPort;
  notes: Readonly<Record<string, string>>;
  dispatch: Dispatch<Action>;
}>;

/** Ask in notes: sends question lines to the assistant and puts each answer under its question. Nothing is sent until asked. */
export function useAskNotes({ assistant, notes, dispatch }: Input) {
  // Mirrors `waiting` without waiting for a render, so two quick asks of one question send once.
  const sent = useRef<PerVideo<readonly string[]>>({});
  const [waiting, setWaiting] = useState<PerVideo<readonly string[]>>({});
  const [inking, setInking] = useState<PerVideo<readonly string[]>>({});
  const [messages, setMessages] = useState<PerVideo<string>>({});
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const setSent = (video: string, questions: readonly string[]) => {
    sent.current = { ...sent.current, [video]: questions };
    setWaiting(sent.current);
  };
  const say = (video: string, message: string | null) =>
    setMessages((m) => (message === null ? without(m, video) : { ...m, [video]: message }));

  const inkIn = (video: string, answer: string) => {
    setInking((m) => ({ ...m, [video]: [...(m[video] ?? NONE), answer] }));
    const words = answer.split(/\s+/).length;
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setInking((m) => ({ ...m, [video]: removeOne(m[video], answer) }));
    }, words * INK_WORD_MS + INK_MS);
    timers.current.add(timer);
  };

  const ask = (video: string, question: string) => {
    if (question.length > MAX_QUESTION_CHARS) return say(video, ASK_MESSAGES.tooLong);
    const busy = sent.current[video] ?? NONE;
    if (busy.includes(question) || !unansweredQuestions(notes[video] ?? "").includes(question)) return;
    say(video, null);
    setSent(video, [...busy, question]);
    assistant
      .answer(video, question)
      .then(({ answer }) => {
        dispatch({ type: "insert_answer", video, question, answer });
        inkIn(video, answer);
      })
      .catch((error: unknown) => {
        console.warn("Couldn't answer a question in notes", error);
        say(video, ASK_MESSAGES.failed);
      })
      .finally(() => setSent(video, removeOne(sent.current[video], question)));
  };

  const askLast = (video: string) => {
    const note = notes[video] ?? "";
    const open = unansweredQuestions(note);
    const busy = sent.current[video] ?? NONE;
    const last = [...open].reverse().find((q) => !busy.includes(q));
    if (last) return ask(video, last);
    if (open.length > 0) return; // Every open question is already on its way.
    say(video, questionsIn(note).length > 0 ? ASK_MESSAGES.allAnswered : ASK_MESSAGES.noQuestion);
  };

  return (video: string): AskBinding => ({
    waiting: waiting[video] ?? NONE,
    inking: inking[video] ?? NONE,
    message: messages[video] ?? null,
    ask: (question) => ask(video, question),
    askLast: () => askLast(video),
  });
}
