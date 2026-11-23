/** Whether this visitor can sign in, and whether they are (ADR 0012). Signed out or not set up, the app is in demo mode. */
export type AccountStatus =
  | Readonly<{ kind: "unavailable" }>
  | Readonly<{ kind: "signedOut"; signInFailed: boolean }>
  /** `username` is null until the user chooses one, which first sign-in asks for (ADR 0013). */
  | Readonly<{ kind: "signedIn"; username: string | null }>;

/** The server kept the username (as it stores it), or said why not. */
export type UsernameAnswer = Readonly<{ ok: true; username: string }> | Readonly<{ ok: false; problem: string }>;

/** Delete my data always deletes; `revoked` says whether Google confirmed it removed Yourfeed's access too. */
export type DeleteResult = Readonly<{ revoked: boolean }>;

export const ACCOUNT_TEXT = {
  notSetUp: "Signing in isn't set up here.",
  reads: "Reads your YouTube subscriptions, likes and playlists, read-only.",
  testing: "Yourfeed is in testing mode, so Google will warn that the app isn't verified.",
  signInFailed: "Signing in with Google didn't work. Try again.",
  signOutFailed: "Couldn't sign out. Try again.",
  deleteFailed: "Couldn't delete your data. Try again.",
  notRevoked: "Your data is deleted, but Google didn't confirm it removed Yourfeed's access. Remove it at myaccount.google.com/permissions.",
  saveFailed: "Couldn't save your changes to your account.",
  retrySave: "Try saving again",
  loadFailed: "Couldn't load your feeds from your account.",
  loading: "Loading…",
  chooseUsername: "Choose a username",
  usernameHint: "People send you feeds and invite you to Blends by your username.",
  usernameLabel: "Username",
  saveUsername: "Save username",
  usernameFailed: "Couldn't save your username. Try again.",
  confirmDelete: "Delete your account and everything Yourfeed stored for it, and remove its access to your Google account? This can't be undone.",
} as const;
