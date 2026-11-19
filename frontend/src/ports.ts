import type { AnswerResult } from "./domain/askNotes";
import type { AssistantResult, BarMode, FeedContext } from "./domain/assistant";
import type { Video } from "./domain/types";

/** Loads the catalog the feeds are built from. Production calls the backend; tests pass a fixed list. */
export type CatalogLoader = () => Promise<readonly Video[]>;

/** Keeps app state between visits. `load` returns untrusted data (or null when nothing is saved). */
export type StateStorage = Readonly<{
  load: () => unknown;
  save: (value: unknown) => void;
}>;

/** Answers Claude bar requests and questions in a video's notes. Production calls the backend; tests pass a scripted fake. */
export type AssistantPort = Readonly<{
  request: (text: string, mode: BarMode, context: FeedContext) => Promise<AssistantResult>;
  answer: (videoId: string, question: string) => Promise<AnswerResult>;
}>;
