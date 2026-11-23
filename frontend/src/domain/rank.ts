import { isRecent, type Signal, type SignalKind } from "./behaviour";
import { activeItems } from "./feedList";
import { seededRank } from "./seeded";
import { HOURS_PER_WEEK } from "./time";
import type { Feed, Video } from "./types";

/**
 * Why a card is where it is, as a typed value the card renders (ADR 0010). The assistant's
 * "why is this first?" is sent the same value's text, so the two never disagree.
 */
export type Reason = Readonly<
  | { kind: "finishedTopic" | "notedTopic" | "watchedTopic"; topic: string; count: number }
  | { kind: "finishedChannel" | "watchedChannel" | "pinnedChannel"; channel: string; count: number }
  | { kind: "newFromSubscription" | "followedChannel"; channel: string }
  | { kind: "matchesTopic"; topic: string }
  | { kind: "outsideRecipe"; topic: string; near: string }
  | { kind: "recent" | "pinned" | "mostViewed" | "live" | "latestNews" | "shared" | "catalog" }
>;

/** The reason for a video nothing else explains. */
export const CATALOG_REASON: Reason = { kind: "catalog" };

export type Ranked = Readonly<{ video: Video; score: number; reason: Reason }>;

/** Per signal, and how many signals of one kind count at most. Views are never a term. */
const WEIGHTS = {
  finishedTopic: 3,
  finishedChannel: 2,
  /** Writing a note is as strong a sign you cared as Finishing; every noted video was also watched. */
  notedTopic: 3,
  watchedTopic: 1.5,
  watchedChannel: 1,
  pinnedChannel: 2,
  removedTopic: -3,
  removedChannel: -3,
  skipped: -2,
} as const;
const MAX_COUNTED = 5;
const MATCHES_TOPIC = 4;
const FOLLOWED_NEW = 2;
const FOLLOWED_OLD = 1;
const RECENCY = 1.5;
/** The seed only breaks near-ties: always under the smallest weight's half. */
const JITTER = 0.5;
const JITTER_STEPS = 1000;

type Term = Readonly<{ score: number; reason: Reason | null }>;

/** How many recent signals of each kind touch a topic, a channel or a video, counted once per `rank` call. */
type Counts = ReadonlyMap<string, number>;
const key = (kind: SignalKind, by: "topic" | "channel" | "id", value: string) => `${kind}\n${by}\n${value}`;

function countSignals(signals: readonly Signal[]): Counts {
  const counts = new Map<string, number>();
  const bump = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);
  for (const { kind, video } of signals) {
    bump(key(kind, "topic", video.topic));
    bump(key(kind, "channel", video.channel));
    bump(key(kind, "id", video.id));
  }
  return counts;
}

function behaviourTerms(video: Video, counts: Counts): Term[] {
  const { topic, channel } = video;
  const values = { topic, channel, id: video.id } as const;
  const n = (kind: SignalKind, by: keyof typeof values) => Math.min(MAX_COUNTED, counts.get(key(kind, by, values[by])) ?? 0);
  const byTopic = (kind: "finishedTopic" | "notedTopic" | "watchedTopic", signal: SignalKind): Term => {
    const c = n(signal, "topic");
    return { score: WEIGHTS[kind] * c, reason: c ? { kind, topic, count: c } : null };
  };
  const byChannel = (kind: "finishedChannel" | "watchedChannel" | "pinnedChannel", signal: SignalKind): Term => {
    const c = n(signal, "channel");
    return { score: WEIGHTS[kind] * c, reason: c ? { kind, channel, count: c } : null };
  };
  return [
    byTopic("finishedTopic", "finished"),
    byChannel("finishedChannel", "finished"),
    byTopic("notedTopic", "noted"),
    byTopic("watchedTopic", "watched"),
    byChannel("watchedChannel", "watched"),
    byChannel("pinnedChannel", "pinned"),
    { score: WEIGHTS.removedTopic * n("removed", "topic"), reason: null },
    { score: WEIGHTS.removedChannel * n("removed", "channel"), reason: null },
    { score: WEIGHTS.skipped * n("skipped", "id"), reason: null },
  ];
}

function recipeTerms(video: Video, feed: Feed, following: readonly string[]): Term[] {
  const isNew = video.ageHours <= HOURS_PER_WEEK;
  const followed = following.includes(video.channel);
  return [
    { score: activeItems(feed).includes(video.topic) ? MATCHES_TOPIC : 0, reason: { kind: "matchesTopic", topic: video.topic } },
    {
      score: followed ? (isNew ? FOLLOWED_NEW : FOLLOWED_OLD) : 0,
      reason: { kind: isNew ? "newFromSubscription" : "followedChannel", channel: video.channel },
    },
    { score: RECENCY * Math.exp(-video.ageHours / HOURS_PER_WEEK), reason: isNew ? { kind: "recent" } : null },
  ];
}

/** The reason is the largest term that has one; with none, the video is simply in your catalog. */
function score(video: Video, feed: Feed, counts: Counts, following: readonly string[]): Ranked {
  const terms = [...behaviourTerms(video, counts), ...recipeTerms(video, feed, following)];
  const top = terms.filter((t) => t.reason && t.score > 0).reduce<Term | null>((best, t) => (best && best.score >= t.score ? best : t), null);
  const jitter = ((seededRank(video.id, feed.seed) % JITTER_STEPS) / JITTER_STEPS) * JITTER;
  const total = terms.reduce((sum, t) => sum + t.score, jitter);
  return { video, score: total, reason: top?.reason ?? CATALOG_REASON };
}

/**
 * The Ranker (ADR 0010): scores a feed's candidates from its recipe, the visitor's behaviour of the
 * last 30 days, recency and the channels they follow, best first, each with its reason. Never views.
 * Pure: same inputs, same output; the feed's seed only breaks near-ties.
 */
export function rank(
  candidates: readonly Video[],
  feed: Feed,
  behaviour: readonly Signal[],
  now: number,
  following: readonly string[] = [],
): Ranked[] {
  const counts = countSignals(behaviour.filter((s) => isRecent(s.at, now)));
  return candidates
    .map((v) => score(v, feed, counts, following))
    .sort((a, b) => b.score - a.score || (a.video.id < b.video.id ? -1 : a.video.id > b.video.id ? 1 : 0));
}

const videos = (n: number) => (n === 1 ? "a video" : `${n} videos`);
const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");
const topicVideos = (n: number, topic: string) => (n === 1 ? `${article(topic)} ${topic} video` : `${n} ${topic} videos`);

/** The words a card shows for its reason. */
export function reasonText(reason: Reason): string {
  switch (reason.kind) {
    case "finishedTopic":
      return `Because you Finished ${topicVideos(reason.count, reason.topic)}`;
    case "notedTopic":
      return `Because you took notes on ${topicVideos(reason.count, reason.topic)}`;
    case "watchedTopic":
      return `Because you watched ${topicVideos(reason.count, reason.topic)}`;
    case "finishedChannel":
      return `Because you Finished ${videos(reason.count)} from ${reason.channel}`;
    case "watchedChannel":
      return `Because you watched ${videos(reason.count)} from ${reason.channel}`;
    case "pinnedChannel":
      return `You added ${videos(reason.count)} from ${reason.channel}`;
    case "newFromSubscription":
      return `New from ${reason.channel}, which you follow`;
    case "followedChannel":
      return `From ${reason.channel}, which you follow`;
    case "matchesTopic":
      return `Matches ${reason.topic} in this feed`;
    case "outsideRecipe":
      return `Outside your recipe: ${reason.topic}, next to ${reason.near}`;
    case "recent":
      return "New this week";
    case "pinned":
      return "You added this";
    case "mostViewed":
      return "Ranked by views";
    case "live":
      return "Live now";
    case "latestNews":
      return "Latest news";
    case "shared":
      return "In this share";
    case "catalog":
      return "From your catalog";
  }
}
