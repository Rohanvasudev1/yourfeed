import { z } from "zod";
import { isBuiltIn } from "./feed";
import { pinVideo } from "./session";
import type { Feed, FeedKind, Video } from "./types";

/** Longest request the Claude bar sends (ADR 0006). */
export const MAX_REQUEST_CHARS = 300;
/** How many Up next videos the assistant is shown (ADR 0007). */
export const CONTEXT_VIDEOS = 20;

/** Edit changes the current feed; new starts a feed from the request. Built-in feeds are always new. */
export const BAR_MODES = ["edit", "new"] as const;
export type BarMode = (typeof BAR_MODES)[number];

const topics = z.array(z.string()).readonly();
const minutes = z.number().int();

/** The feed actions an assistant can return, as the backend checked them (ADR 0007). */
export const feedActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_topics"), add: topics, remove: topics }).readonly(),
  z.object({ type: z.literal("mute_topic"), topic: z.string() }).readonly(),
  z.object({ type: z.literal("set_length_range"), min: minutes, max: minutes }).readonly(),
  z.object({ type: z.literal("set_session_range"), min: minutes, max: minutes }).readonly(),
  z.object({ type: z.literal("pin_video"), id: z.string() }).readonly(),
  z.object({ type: z.literal("ask_user"), kind: z.enum(["chips", "videos", "feedback"]), question: z.string(), items: topics }).readonly(),
  z.object({ type: z.literal("create_feed"), name: z.string().nullish() }).readonly(),
]);
export type FeedAction = z.infer<typeof feedActionSchema>;

export const assistantResultSchema = z
  .object({
    actions: z.array(feedActionSchema).readonly(),
    reply: z.string().nullish(),
    answeredBy: z.enum(["model", "rules"]),
    notice: z.string().nullish(),
  })
  .readonly();
export type AssistantResult = z.infer<typeof assistantResultSchema>;

export type ContextVideo = Readonly<Pick<Video, "id" | "title" | "topic" | "channel">>;

/** What the assistant is told about the current feed: its settings and the top of Up next. */
export type FeedContext = Readonly<{
  kind: FeedKind;
  name: string;
  topics: readonly string[];
  channels: readonly string[];
  muted: readonly string[];
  length: Feed["length"];
  session: Feed["session"];
  pinned: readonly string[];
  upNext: readonly ContextVideo[];
  /** Videos from topics the feed doesn't have, one per topic, that a question card may offer. */
  explore: readonly ContextVideo[];
}>;

/**
 * The bar's mode on `feed`: a draft is the new feed already, so it's edited; built-in feeds can't
 * be edited, so they're always new; your own feeds follow the visitor's choice.
 */
export function barModeFor(feed: Feed, chosen: BarMode = "edit"): BarMode {
  if (feed.draft) return "edit";
  return isBuiltIn(feed) ? "new" : chosen;
}

const contextVideo = ({ id, title, topic, channel }: Video): ContextVideo => ({ id, title, topic, channel });

export function feedContext(feed: Feed, upNext: readonly Video[], explore: readonly Video[] = []): FeedContext {
  const { kind, name, topics, channels, muted, length, session, pinned } = feed;
  return {
    kind,
    name,
    topics,
    channels,
    muted,
    length,
    session,
    pinned,
    upNext: upNext.slice(0, CONTEXT_VIDEOS).map(contextVideo),
    explore: explore.map(contextVideo),
  };
}

const withAll = (items: readonly string[], added: readonly string[]) => [...items, ...added.filter((x) => !items.includes(x))];
const withoutAny = (items: readonly string[], dropped: readonly string[]) => items.filter((x) => !dropped.includes(x));

/** One action's change to a feed. Question cards and new feeds don't change the current feed. */
function applyAction(feed: Feed, action: FeedAction): Feed {
  switch (action.type) {
    case "set_topics":
      return { ...feed, topics: withoutAny(withAll(feed.topics, action.add), action.remove), muted: withoutAny(feed.muted, action.add) };
    case "mute_topic":
      return { ...feed, muted: withAll(feed.muted, [action.topic]) };
    case "set_length_range":
      return { ...feed, length: [action.min, action.max] };
    case "set_session_range":
      return { ...feed, session: [action.min, action.max] };
    case "pin_video":
      return pinVideo(feed, action.id);
    case "ask_user":
    case "create_feed":
      return feed;
  }
}

/** Every action of one request, in order. */
export const applyFeedActions = (feed: Feed, actions: readonly FeedAction[]): Feed => actions.reduce(applyAction, feed);

/** Whether the actions would change anything the visitor can see on this feed. */
export const changesFeed = (feed: Feed, actions: readonly FeedAction[]): boolean =>
  JSON.stringify(applyFeedActions(feed, actions)) !== JSON.stringify(feed);
