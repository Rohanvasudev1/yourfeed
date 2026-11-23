import type { Video } from "./types";
import YOUTUBE_TOPIC_LIST from "./youtubeTopics.json";

/** YouTube's categories in readable words, the fixed list the backend maps `topicCategories` to (ADR 0011). */
export const YOUTUBE_TOPICS: readonly string[] = YOUTUBE_TOPIC_LIST;

/** At most this many channels keep a topic the user set; past it, the oldest one goes back to YouTube's category. */
export const CHANNEL_TOPIC_LIMIT = 2000;

export const isYouTubeTopic = (topic: unknown): topic is string => typeof topic === "string" && YOUTUBE_TOPICS.includes(topic);

/** Saved channel topics, cleaned: entries that aren't one of YouTube's topics are dropped, and only the newest CHANNEL_TOPIC_LIMIT kept. */
export function keptChannelTopics(saved: Readonly<Record<string, unknown>>): ChannelTopics {
  const valid = Object.entries(saved).filter((entry): entry is [string, string] => entry[0].length > 0 && isYouTubeTopic(entry[1]));
  return Object.fromEntries(valid.slice(-CHANNEL_TOPIC_LIMIT));
}

/** Topics the user set for channels, by channel name. Yourfeed data, so it's stored and wins over YouTube's category. */
export type ChannelTopics = Readonly<Record<string, string>>;

/** The topic the user set for `channel`, if any. Own keys only, so a channel called "constructor" has none. */
export const channelTopicOf = (topics: ChannelTopics, channel: string): string | undefined =>
  Object.prototype.hasOwnProperty.call(topics, channel) ? topics[channel] : undefined;

/** The catalog with each channel's own topic in place of YouTube's; unchanged when no channel has one. */
export function withChannelTopics(videos: readonly Video[], topics: ChannelTopics): readonly Video[] {
  if (Object.keys(topics).length === 0) return videos;
  return videos.map((v) => {
    const topic = channelTopicOf(topics, v.channel);
    return topic === undefined || topic === v.topic ? v : { ...v, topic };
  });
}

/** Sets a channel's topic (newest last), or with `null` goes back to YouTube's category. */
export function setChannelTopic(topics: ChannelTopics, channel: string, topic: string | null): ChannelTopics {
  if ((channelTopicOf(topics, channel) ?? null) === topic) return topics;
  const others = Object.entries(topics).filter(([name]) => name !== channel);
  return keptChannelTopics(Object.fromEntries(topic === null ? others : [...others, [channel, topic]]));
}
