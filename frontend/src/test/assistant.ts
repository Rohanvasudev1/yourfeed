import type { AssistantResult, BarMode, FeedAction, FeedContext } from "../domain/assistant";
import type { AssistantPort } from "../ports";

export type AssistantCall = Readonly<{ text: string; mode: BarMode; context: FeedContext }>;

type Answer = AssistantResult | Promise<AssistantResult>;

/** A stand-in assistant: answers each request with `answer(text)` and records every call. */
export function scriptedAssistant(answer: (text: string) => Answer = () => replyWith("OK.")): AssistantPort & { calls: AssistantCall[] } {
  const calls: AssistantCall[] = [];
  return {
    calls,
    request: async (text, mode, context) => {
      calls.push({ text, mode, context });
      return answer(text);
    },
  };
}

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
