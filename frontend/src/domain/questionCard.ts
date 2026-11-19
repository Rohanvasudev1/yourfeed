import { applyFeedActions, type FeedAction } from "./assistant";
import { hash } from "./hash";
import type { Feed, Video } from "./types";

/** Most videos from other topics the assistant is shown for a question card (one per topic). */
export const EXPLORE_VIDEOS = 8;
/** How many of the added topics' videos a feedback card shows. */
export const FEEDBACK_VIDEOS = 3;
export const PICK_FIRST = "Pick at least one first";

type AskAction = Extract<FeedAction, { type: "ask_user" }>;
export type QuestionKind = AskAction["kind"];

/**
 * The assistant asking before it acts, on one feed. `items` are topics for chips and feedback
 * (feedback's are the topics thumbs down removes) and video ids for videos.
 */
export type QuestionCard = Readonly<{
  feed: string;
  kind: QuestionKind;
  question: string;
  items: readonly string[];
  picked: readonly string[];
  error: string | null;
}>;

const card = (feed: string, kind: QuestionKind, question: string, items: readonly string[]): QuestionCard => ({
  feed,
  kind,
  question,
  items,
  picked: [],
  error: null,
});

/** Videos from topics the feed doesn't have, one per topic, in an order the request decides. Clickbait is left out. */
export function exploreVideos(catalog: readonly Video[], feed: Feed, request: string): readonly Video[] {
  const ordered = catalog
    .filter((v) => !v.clickbait && !feed.topics.includes(v.topic))
    .map((v) => ({ v, rank: hash(v.id + request) }))
    .sort((a, b) => a.rank - b.rank);
  const firstOfTopic = new Map<string, Video>();
  for (const { v } of ordered) if (!firstOfTopic.has(v.topic)) firstOfTopic.set(v.topic, v);
  return [...firstOfTopic.values()].slice(0, EXPLORE_VIDEOS);
}

const listPhrase = (items: readonly string[]) =>
  items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** After topics land on a feed that had fewer than two (not Everything), ask whether they look right. */
export function feedbackCard(before: Feed, after: Feed): QuestionCard | null {
  if (before.kind === "home" || before.topics.length >= 2) return null;
  const added = after.topics.filter((t) => !before.topics.includes(t));
  return added.length > 0 ? card(before.name, "feedback", `Added ${listPhrase(added)}. Look right?`, added) : null;
}

/** The card an answer opens: the assistant's own question, or feedback when its actions added the first topics. */
export function cardForAnswer(feed: Feed, actions: readonly FeedAction[], applied: boolean): QuestionCard | null {
  const asked = actions.find((a): a is AskAction => a.type === "ask_user");
  if (asked) return card(feed.name, asked.kind, asked.question, asked.items);
  return applied ? feedbackCard(feed, applyFeedActions(feed, actions)) : null;
}

export const togglePick = (question: QuestionCard, item: string): QuestionCard => ({
  ...question,
  picked: question.picked.includes(item) ? question.picked.filter((x) => x !== item) : [...question.picked, item],
  error: null,
});

/** The topics Add selected adds: the chips picked, or the topics of the videos picked. */
export function topicsToAdd(question: QuestionCard, byId: ReadonlyMap<string, Video>): readonly string[] {
  if (question.kind !== "videos") return question.picked;
  const topics = question.picked.flatMap((id) => byId.get(id)?.topic ?? []);
  return [...new Set(topics)];
}

/** The newest videos of the added topics, for the feedback card to show. */
export const feedbackVideos = (topics: readonly string[], catalog: readonly Video[], hideClickbait: boolean): readonly Video[] =>
  catalog
    .filter((v) => topics.includes(v.topic) && !(hideClickbait && v.clickbait))
    .sort((a, b) => a.ageHours - b.ageHours)
    .slice(0, FEEDBACK_VIDEOS);
