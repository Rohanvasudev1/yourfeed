import type { Dispatch } from "react";
import { activeItems, listKeyOf } from "../domain/feedList";
import { isInSession } from "../domain/session";
import { similarVideos } from "../domain/similar";
import type { Feed, Video } from "../domain/types";
import type { Action, AppState } from "./appState";

/** Where a topic stands in the open feed. */
export type TopicStanding = Readonly<{
  feed: Feed;
  /** One of the feed's topics (boosted, on Everything). */
  listed: boolean;
  /** Hidden here. */
  muted: boolean;
  /** The feed keeps a topic list, so the topic can be added or removed (Subscriptions keeps channels instead). */
  editable: boolean;
  /** Videos in the catalog with this topic. */
  count: number;
}>;

export type ChannelStanding = Readonly<{
  subscribers: number;
  /** Videos in the catalog from this channel. */
  count: number;
  /** In the Subscriptions feed's channels. */
  followed: boolean;
}>;

/** What a card's quick actions read and do. Every change goes through the reducer, so topic and channel changes are undoable. */
export type CardActions = Readonly<{
  topic: (topic: string) => TopicStanding;
  addTopic: (topic: string) => void;
  removeTopic: (topic: string) => void;
  hideTopic: (topic: string) => void;
  showTopic: (topic: string) => void;
  channel: (channel: string) => ChannelStanding;
  /** Adds the channel to Subscriptions, or takes it out. */
  setFollowed: (channel: string, followed: boolean) => void;
  isWatched: (video: Video) => boolean;
  toggleWatched: (video: Video) => void;
  similarTo: (video: Video) => readonly Video[];
  inSession: (video: Video) => boolean;
  pin: (video: Video) => void;
  removeFromSession: (video: Video) => void;
}>;

export function useCardActions(state: AppState, feed: Feed, catalog: readonly Video[], dispatch: Dispatch<Action>): CardActions {
  const subs = state.feeds.find((f) => f.kind === "subs");
  const countWhere = (match: (v: Video) => boolean) => catalog.filter(match).length;
  const onFeed = (type: "add_to_feed" | "remove_from_feed", item: string) => dispatch({ type, feed: feed.name, item });
  const isWatched = (video: Video) => state.watched.includes(video.id);

  return {
    topic: (topic) => ({
      feed,
      listed: feed.topics.includes(topic),
      muted: feed.muted.includes(topic),
      editable: listKeyOf(feed) === "topics",
      count: countWhere((v) => v.topic === topic),
    }),
    addTopic: (topic) => onFeed("add_to_feed", topic),
    removeTopic: (topic) => onFeed("remove_from_feed", topic),
    hideTopic: (topic) => dispatch({ type: "mute_topic", feed: feed.name, topic }),
    showTopic: (topic) => dispatch({ type: "unmute_topic", feed: feed.name, topic }),
    channel: (channel) => ({
      subscribers: catalog.find((v) => v.channel === channel)?.channelSubscribers ?? 0,
      count: countWhere((v) => v.channel === channel),
      followed: subs?.channels.includes(channel) ?? false,
    }),
    setFollowed: (channel, followed) => {
      if (subs) dispatch({ type: followed ? "add_to_feed" : "remove_from_feed", feed: subs.name, item: channel });
    },
    isWatched,
    toggleWatched: (video) =>
      dispatch(isWatched(video) ? { type: "forget_watch", video: video.id } : { type: "mark_watched", video: video.id }),
    similarTo: (video) => similarVideos(catalog, video, activeItems(feed)),
    inSession: (video) => isInSession(feed, video.id),
    pin: (video) => dispatch({ type: "pin_video", feed: feed.name, video: video.id }),
    removeFromSession: (video) => dispatch({ type: "remove_from_session", feed: feed.name, video: video.id }),
  };
}
