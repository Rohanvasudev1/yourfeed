import { assistantResultSchema, type AssistantResult, type BarMode, type FeedContext } from "../domain/assistant";
import type { AssistantPort } from "../ports";

type Envelope = { success?: boolean; data?: unknown; error?: string | null };

/** Sends one Claude bar request to the backend and checks the answer before the app trusts it. */
export async function requestAssistant(text: string, mode: BarMode, context: FeedContext): Promise<AssistantResult> {
  const res = await fetch("/api/assistant/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, mode, context }),
  });
  const body = (await res.json().catch(() => null)) as Envelope | null;
  if (!body?.success) throw new Error(body?.error ?? `The server answered ${res.status}.`);
  const parsed = assistantResultSchema.safeParse(body.data);
  if (!parsed.success) throw new Error(`The assistant's answer didn't match the contract: ${parsed.error.message}`);
  return parsed.data;
}

export const apiAssistant: AssistantPort = { request: requestAssistant };
