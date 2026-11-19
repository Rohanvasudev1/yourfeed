import { z } from "zod";

/** Which assistant answers, as `GET /api/assistant/info` reports it: a model with its provider, or the keyword rules. */
export const assistantInfoSchema = z.discriminatedUnion("answeredBy", [
  z.object({ answeredBy: z.literal("model"), provider: z.string().min(1), model: z.string().min(1) }),
  z.object({ answeredBy: z.literal("rules"), provider: z.null(), model: z.null() }),
]);

export type AssistantInfo = z.infer<typeof assistantInfoSchema>;

const PRIVATE = "Don't include anything private.";

/** The account menu's line naming who answers. */
export const answeredByLabel = (info: AssistantInfo): string =>
  info.answeredBy === "model" ? `Answers by ${info.model} via ${info.provider}` : "Answers by simple rules";

/** Where requests and note questions go; `null` while the server hasn't said who answers. */
export function providerNotice(info: AssistantInfo | null): string {
  if (info === null) return `Requests and note questions go to Yourfeed's server. ${PRIVATE}`;
  if (info.answeredBy === "rules") return `Requests and note questions go to Yourfeed's server, where simple rules answer them. ${PRIVATE}`;
  return `Requests and note questions go to ${info.provider}. ${PRIVATE}`;
}
