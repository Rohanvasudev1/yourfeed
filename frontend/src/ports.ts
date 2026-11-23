import type { AccountStatus, DeleteResult, UsernameAnswer } from "./domain/account";
import type { AnswerResult } from "./domain/askNotes";
import type { InviteAnswer, ServerBlend } from "./domain/blend";
import type { AssistantResult, BarMode, FeedContext } from "./domain/assistant";
import type { AssistantInfo } from "./domain/assistantInfo";
import type { FollowUp } from "./domain/recipeLog";
import type { SendAnswer, SentShare } from "./domain/sending";
import type { Share } from "./domain/share";
import type { TopicVideos } from "./domain/topicSearch";
import type { Video } from "./domain/types";

/** Where the catalog comes from: the demo's mock videos, or a signed-in user's YouTube (ADR 0011). */
export type CatalogSource = "demo" | "youtube";

/** Loads the catalog the feeds are built from. Production calls the backend; tests pass a fixed list. */
export type CatalogLoader = (source: CatalogSource) => Promise<readonly Video[]>;

/** Loads the catalog of the visitor's source, already chosen: their YouTube when signed in, else the demo's. */
export type SourceCatalogLoader = () => Promise<readonly Video[]>;

/** Searches YouTube for a feed's topics outside the user's subscriptions, at most 5 at a time (ADR 0011). Production calls the backend; tests pass a fake. */
export type TopicSearchPort = (topics: readonly string[]) => Promise<TopicVideos>;

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
  /** Asks the server for `username` (already in the username rules); rejects when it couldn't answer. */
  chooseUsername: (username: string) => Promise<UsernameAnswer>;
  deleteData: () => Promise<DeleteResult>;
}>;

/** Other people, for real, between signed-in users (ADR 0013). Production calls the backend; tests pass a fake. Demo mode has none. */
export type SharingPort = Readonly<{
  /** Videos by id from YouTube, wherever they are, so share links work across catalogs; unknown ids are left out. At most 50 ids. */
  lookupVideos: (ids: readonly string[]) => Promise<readonly Video[]>;
  /** Sends a share to a username; rejects when the server couldn't answer. */
  send: (to: string, share: Share) => Promise<SendAnswer>;
  /** What was sent to this user after the share with id `after`, oldest first, already checked against the share limits. */
  inbox: (after: number) => Promise<readonly SentShare[]>;
  /** This user's pending and accepted blends, newest first. */
  blends: () => Promise<readonly ServerBlend[]>;
  /** Invites a username to blend with this user's recipe topics; rejects when the server couldn't answer. */
  inviteBlend: (to: string, topics: readonly string[]) => Promise<InviteAnswer>;
  /** Approves an invite to this user with their recipe topics; resolves to the blend, with the inviter's topics. */
  acceptBlend: (id: number, topics: readonly string[]) => Promise<ServerBlend>;
  /** Cancels, declines or removes a blend, from either side. */
  cancelBlend: (id: number) => Promise<void>;
}>;
