import type { AssistantResult, BarMode, FeedAction, FeedContext } from "../domain/assistant";
import type { AnswerResult } from "../domain/askNotes";
import type { AssistantInfo } from "../domain/assistantInfo";
import type { AssistantPort } from "../ports";

export type AssistantCall = Readonly<{ text: string; mode: BarMode; context: FeedContext }>;

export type QuestionCall = Readonly<{ videoId: string; question: string }>;

type Answer = AssistantResult | Promise<AssistantResult>;
type NoteAnswer = AnswerResult | Promise<AnswerResult>;

type Script = Readonly<{
  /** Answers each question asked in a video's notes. */
  answerQuestion?: (question: string, videoId: string) => NoteAnswer;
  /** Says which assistant answers; a model via Groq unless a test says otherwise. */
  info?: () => AssistantInfo | Promise<AssistantInfo>;
}>;

export const GROQ_INFO: AssistantInfo = { answeredBy: "model", provider: "Groq", model: "gpt-oss-20b" };

/** A stand-in assistant: answers each request with `answer(text)` and records every call and question. */
export function scriptedAssistant(
  answer: (text: string) => Answer = () => replyWith("OK."),
  { answerQuestion = () => answerWith("A scripted answer."), info = () => GROQ_INFO }: Script = {},
): AssistantPort & { calls: AssistantCall[]; questions: QuestionCall[] } {
  const calls: AssistantCall[] = [];
  const questions: QuestionCall[] = [];
  return {
    calls,
    questions,
    request: async (text, mode, context) => {
      calls.push({ text, mode, context });
      return answer(text);
    },
    answer: async (videoId, question) => {
      questions.push({ videoId, question });
      return answerQuestion(question, videoId);
    },
    info: async () => info(),
  };
}

export const answerWith = (answer: string): AnswerResult => ({ answer, answeredBy: "model" });

export const actionsResult = (...actions: FeedAction[]): AssistantResult => ({ actions, answeredBy: "model" });

export const replyWith = (reply: string): AssistantResult => ({ actions: [], reply, answeredBy: "model" });

/** A promise the test settles by hand, to see the bar while the assistant is still thinking. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
