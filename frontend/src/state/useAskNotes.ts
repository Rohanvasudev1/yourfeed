import { useRef, useState, type Dispatch } from "react";
import { MAX_QUESTION_CHARS, questionsIn, unansweredQuestions } from "../domain/askNotes";
import type { AssistantPort } from "../ports";
import type { Action } from "./appState";
import { useInking } from "./useInking";

export const ASK_MESSAGES = {
  tooLong: `Keep questions under ${MAX_QUESTION_CHARS} characters`,
  allAnswered: "Your questions are already answered. Write a new line ending in ?",
  noQuestion: "Write a question in your notes ending in ?, then press Enter",
  failed: "Couldn't answer that right now. Try again.",
} as const;

/** What a video's notes box shows and does for Ask in notes. */
export type AskBinding = Readonly<{
  /** Questions on their way to the assistant, trimmed. */
  waiting: readonly string[];
  /** Answers just inserted, still inking in word by word. */
  inking: readonly string[];
  /** An error or no-op message in place of the hint, or null for the hint. */
  message: string | null;
  /** Enter after a question line: asks it. */
  askQuestion: (question: string) => void;
  /** The ✱ button: asks the last question with no answer, or says why it can't. */
  askLast: () => void;
}>;

type PerVideo<T> = Readonly<Record<string, T>>;
const NONE: readonly string[] = [];

type Input = Readonly<{
  assistant: AssistantPort;
  notes: Readonly<Record<string, string>>;
  dispatch: Dispatch<Action>;
}>;

/** Ask in notes: sends question lines to the assistant and puts each answer under its question. Nothing is sent until asked. */
export function useAskNotes({ assistant, notes, dispatch }: Input) {
  // The source of truth for questions on their way, read without waiting for a render so two quick asks send once.
  const sent = useRef<PerVideo<readonly string[]>>({});
  const [waiting, setWaiting] = useState<PerVideo<readonly string[]>>({});
  const [messages, setMessages] = useState<PerVideo<string | null>>({});
  const { inkingFor, inkIn } = useInking();

  const setSent = (video: string, questions: readonly string[]) => {
    sent.current = { ...sent.current, [video]: questions };
    setWaiting(sent.current);
  };
  const say = (video: string, message: string | null) => setMessages((m) => ({ ...m, [video]: message }));

  const askQuestion = (video: string, question: string) => {
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
      .finally(() => setSent(video, (sent.current[video] ?? NONE).filter((q) => q !== question)));
  };

  const askLast = (video: string) => {
    const note = notes[video] ?? "";
    const open = unansweredQuestions(note);
    const busy = sent.current[video] ?? NONE;
    const last = [...open].reverse().find((q) => !busy.includes(q));
    if (last) return askQuestion(video, last);
    if (open.length > 0) return; // Every open question is already on its way, as in the mockup.
    say(video, questionsIn(note).length > 0 ? ASK_MESSAGES.allAnswered : ASK_MESSAGES.noQuestion);
  };

  return (video: string): AskBinding => ({
    waiting: waiting[video] ?? NONE,
    inking: inkingFor(video),
    message: messages[video] ?? null,
    askQuestion: (question) => askQuestion(video, question),
    askLast: () => askLast(video),
  });
}
