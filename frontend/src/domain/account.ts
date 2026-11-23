/** Whether this visitor can sign in, and whether they are (ADR 0012). Signed out or not set up, the app is in demo mode. */
export type AccountStatus =
  | Readonly<{ kind: "unavailable" }>
  | Readonly<{ kind: "signedOut"; signInFailed: boolean }>
  | Readonly<{ kind: "signedIn" }>;

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
  confirmDelete: "Delete your account and everything Yourfeed stored for it, and remove its access to your Google account? This can't be undone.",
} as const;
