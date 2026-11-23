import type { AccountStatus, DeleteResult } from "./domain/account";
import type { AnswerResult } from "./domain/askNotes";
import type { AssistantResult, BarMode, FeedContext } from "./domain/assistant";
import type { AssistantInfo } from "./domain/assistantInfo";
import type { FollowUp } from "./domain/recipeLog";
import type { Video } from "./domain/types";

/** Where the catalog comes from: the demo's mock videos, or a signed-in user's YouTube (ADR 0011). */
export type CatalogSource = "demo" | "youtube";

/** Loads the catalog the feeds are built from. Production calls the backend; tests pass a fixed list. */
export type CatalogLoader = (source: CatalogSource) => Promise<readonly Video[]>;

/** Loads the catalog of the visitor's source, already chosen: their YouTube when signed in, else the demo's. */
export type SourceCatalogLoader = () => Promise<readonly Video[]>;

/** Keeps app state between visits. `load` returns untrusted data (or null when nothing is saved). */
export type StateStorage = Readonly<{
  load: () => unknown;
  save: (value: unknown) => void;
}>;

/** A signed-in user's state on the server (ADR 0012). `load` returns untrusted data, or null before the first save; `save` rejects when the server didn't keep it. */
export type ServerStatePort = Readonly<{
  load: () => Promise<unknown>;
  save: (value: unknown) => Promise<void>;
}>;

/** Answers Claude bar requests and questions in a video's notes. Production calls the backend; tests pass a scripted fake. */
export type AssistantPort = Readonly<{
  /** `followUps` are the current feed's newest live recipe log lines, oldest first. */
  request: (text: string, mode: BarMode, context: FeedContext, followUps: readonly FollowUp[]) => Promise<AssistantResult>;
  answer: (videoId: string, question: string) => Promise<AnswerResult>;
  /** Which assistant answers, for the account menu and the provider notice. */
  info: () => Promise<AssistantInfo>;
}>;

/** Signing in with Google and leaving. Production calls the backend; tests pass a fake. */
export type AccountPort = Readonly<{
  status: () => Promise<AccountStatus>;
  /** Whether this browser was signed in when last asked, known at once: then the app waits for the account instead of showing the demo first. */
  expectsSignedIn: () => boolean;
  /** Leaves the page for Google's sign-in; Google sends the visitor back to the app. */
  signIn: () => void;
  signOut: () => Promise<void>;
  deleteData: () => Promise<DeleteResult>;
}>;
