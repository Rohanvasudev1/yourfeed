import { changesFeed, type FeedAction } from "./assistant";
import type { Signal, SignalKind } from "./behaviour";
import { LENGTH_LIMITS } from "./range";
import { HOURS_PER_DAY, MS_PER_HOUR } from "./time";
import type { Feed, Range } from "./types";

/**
 * The recipe mirror (ADR 0010): when a feed's recent behaviour keeps disagreeing with its recipe,
 * it proposes the recipe change as feed actions. It never changes anything itself; accepting a
 * proposal is one undo step, like a Claude bar request. No model is involved.
 */

const DAY_MS = HOURS_PER_DAY * MS_PER_HOUR;
/** Only behaviour from the last this-many days counts. */
export const MIRROR_DAYS = 14;
/** How many signals (distinct videos) it takes to propose anything. */
export const MIRROR_SIGNALS = 3;
/** A dismissed proposal stays hidden this long. */
export const DISMISS_DAYS = 7;
/** Most dismissals kept per feed; there are only ever a few rules' worth in force. */
export const DISMISSAL_LIMIT = 20;
/** Longest proposal id kept: a rule name plus a topic. */
export const MAX_PROPOSAL_ID_CHARS = 200;

/** A proposal the visitor dismissed, and when (ms). Stored on its feed. */
export type Dismissal = Readonly<{ proposal: string; at: number }>;

/**
 * A proposed recipe change. `id` names the rule and its subject ("length", "removed:Cooking"), so
 * the same disagreement keeps one id as more signals arrive and a dismissal keeps hiding it.
 */
export type Proposal = Readonly<{ id: string; text: string; accept: string; actions: readonly FeedAction[] }>;

const inWindow = (signals: readonly Signal[], kind: SignalKind, now: number) =>
  signals.filter((s) => s.kind === kind && now - s.at <= MIRROR_DAYS * DAY_MS);

/** One signal per video: doing the same thing to a video twice doesn't make it a pattern. */
const distinctVideos = (signals: readonly Signal[]) => [...new Map(signals.map((s) => [s.video.id, s.video])).values()];

const formatRange = ([min, max]: Range) => `${min}–${max} min`;
const clamp = (n: number) => Math.max(LENGTH_LIMITS.lowest, Math.min(LENGTH_LIMITS.highest, n));

function lengthRule(feed: Feed, signals: readonly Signal[], now: number): Proposal | null {
  const [min, max] = feed.length;
  const outside = distinctVideos(inWindow(signals, "finished", now)).filter((v) => v.minutes < min || v.minutes > max);
  if (outside.length < MIRROR_SIGNALS) return null;
  const minutes = outside.map((v) => v.minutes);
  const widened: Range = [clamp(Math.min(min, ...minutes)), clamp(Math.max(max, ...minutes))];
  const longer = minutes.every((m) => m > max);
  const shorter = minutes.every((m) => m < min);
  const count = `You Finished ${outside.length} videos`;
  const text = longer
    ? `${count} longer than ${max} min, but this feed is ${formatRange(feed.length)}.`
    : shorter
      ? `${count} shorter than ${min} min, but this feed is ${formatRange(feed.length)}.`
      : `${count} outside ${formatRange(feed.length)} on this feed.`;
  return {
    id: "length",
    text,
    accept: `Widen to ${formatRange(widened)}`,
    actions: [{ type: "set_length_range", min: widened[0], max: widened[1] }],
  };
}

/** The topic with the most distinct videos among `signals`, if it reaches the threshold; ties go alphabetically. */
function topTopic(signals: readonly Signal[]): Readonly<{ topic: string; count: number }> | null {
  const counts = new Map<string, number>();
  for (const v of distinctVideos(signals)) counts.set(v.topic, (counts.get(v.topic) ?? 0) + 1);
  const [best] = [...counts].sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
  return best && best[1] >= MIRROR_SIGNALS ? { topic: best[0], count: best[1] } : null;
}

function removedTopicRule(feed: Feed, signals: readonly Signal[], now: number): Proposal | null {
  const found = topTopic(inWindow(signals, "removed", now).filter((s) => !feed.muted.includes(s.video.topic)));
  if (!found) return null;
  const { topic, count } = found;
  const listed = feed.topics.includes(topic);
  return {
    id: `removed:${topic}`,
    text: `You removed ${count} ${topic} videos from this feed.`,
    accept: listed ? `Remove ${topic}` : `Mute ${topic}`,
    actions: listed ? [{ type: "set_topics", add: [], remove: [topic] }] : [{ type: "mute_topic", topic }],
  };
}

function mutedPinsRule(feed: Feed, signals: readonly Signal[], now: number): Proposal | null {
  const found = topTopic(inWindow(signals, "pinned", now).filter((s) => feed.muted.includes(s.video.topic)));
  if (!found) return null;
  const { topic, count } = found;
  return {
    id: `muted:${topic}`,
    text: `You pinned ${count} ${topic} videos, but ${topic} is muted here.`,
    accept: `Add ${topic} back`,
    // Adding a topic unmutes it, the same way a request's set_topics does.
    actions: [{ type: "set_topics", add: [topic], remove: [] }],
  };
}

/** The rules, in the order they're offered: one proposal at a time. */
const RULES = [lengthRule, removedTopicRule, mutedPinsRule] as const;

const isDismissed = (feed: Feed, id: string, now: number) =>
  feed.dismissed.some((d) => d.proposal === id && now - d.at < DISMISS_DAYS * DAY_MS);

/**
 * The one change `feed`'s own behaviour proposes at `now`, or null: the first rule that finds at
 * least 3 signals in 14 days disagreeing with the recipe, whose proposal would change the feed and
 * wasn't dismissed in the last 7 days. Drafts and Shared with you have no recipe to change.
 */
export function mirror(feed: Feed, behaviour: readonly Signal[], now: number): Proposal | null {
  if (feed.draft || feed.kind === "shared") return null;
  for (const rule of RULES) {
    const proposal = rule(feed, behaviour, now);
    if (proposal && changesFeed(feed, proposal.actions) && !isDismissed(feed, proposal.id, now)) return proposal;
  }
  return null;
}

/** The feed's dismissals with `proposal` dismissed at `at`, dropping any no longer in force. */
export const dismissProposal = (dismissed: readonly Dismissal[], proposal: string, at: number): readonly Dismissal[] =>
  [...dismissed.filter((d) => d.proposal !== proposal && at - d.at < DISMISS_DAYS * DAY_MS), { proposal, at }].slice(-DISMISSAL_LIMIT);
