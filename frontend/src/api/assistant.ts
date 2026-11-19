import { answerResultSchema, type AnswerResult } from "../domain/askNotes";
import { assistantResultSchema, type AssistantResult, type BarMode, type FeedContext } from "../domain/assistant";
import type { AssistantPort } from "../ports";

type Envelope = { success?: boolean; data?: unknown; error?: string | null };

type Schema<T> = Readonly<{ safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: Error } }>;

/** Posts to an assistant endpoint and checks the answer against `schema` before the app trusts it. */
async function post<T>(path: string, payload: unknown, schema: Schema<T>): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => null)) as Envelope | null;
  if (!body?.success) throw new Error(body?.error ?? `The server answered ${res.status}.`);
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) throw new Error(`The assistant's answer didn't match the contract: ${parsed.error.message}`);
  return parsed.data;
}

/** Sends one Claude bar request to the backend. */
export const requestAssistant = (text: string, mode: BarMode, context: FeedContext): Promise<AssistantResult> =>
  post("/api/assistant/request", { text, mode, context }, assistantResultSchema);

/** Asks the backend a question from a video's notes; it looks the video up itself. */
export const answerQuestion = (videoId: string, question: string): Promise<AnswerResult> =>
  post("/api/assistant/answer", { videoId, question }, answerResultSchema);

export const apiAssistant: AssistantPort = { request: requestAssistant, answer: answerQuestion };
