import type { Feed } from "./types";

/** One piece of recent Claude work and the topics it suggests. */
export type ClaudeWork = Readonly<{ label: string; topics: readonly string[] }>;

/** The summary connecting reads. In demo mode it's the mockup's fixed `CLAUDE_WORK`. */
export const CLAUDE_WORK: readonly ClaudeWork[] = [
  { label: "Designing a custom YouTube feed app", topics: ["Product design"] },
  { label: "Building MCP tools and agents", topics: ["MCP", "AI"] },
  { label: "Debugging a TypeScript project", topics: ["Programming"] },
];

/** Requests the connected From Claude panel offers as one-tap chips. */
export const CLAUDE_SUGGESTIONS = ["More MCP tutorials", "Something to learn tonight", "Surprise me"] as const;

/** Every topic the summary names, once each, in order. */
export const claudeTopics = (work: readonly ClaudeWork[]): readonly string[] => [...new Set(work.flatMap((w) => w.topics))];

/** Connecting fills the topics from the summary; disconnecting clears them. Mutes are kept either way. */
export const withClaudeConnection = (feed: Feed, connected: boolean): Feed => ({
  ...feed,
  connected,
  topics: connected ? claudeTopics(CLAUDE_WORK) : [],
});

/** A From Claude feed that hasn't been connected yet: it shows the connect step and takes no requests. */
export const awaitsConnection = (feed: Feed): boolean => feed.kind === "claude" && !feed.connected;
