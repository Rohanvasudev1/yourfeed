import { z } from "zod";
import type { TopicVideos } from "../domain/topicSearch";
import type { Video } from "../domain/types";
import type { TopicSearchPort } from "../ports";
import { isVideo } from "./catalog";
import type { ApiSession } from "./session";

const answerSchema = z.object({ videos: z.array(z.unknown()), paused: z.boolean() });

/** The backend's topic searches for a feed's topics outside the user's subscriptions (ADR 0011). */
export function apiTopicSearch(session: ApiSession): TopicSearchPort {
  return async (topics): Promise<TopicVideos> => {
    const query = topics.map((t) => `topic=${encodeURIComponent(t)}`).join("&");
    const answer = answerSchema.parse(await session.call(`/api/catalog/topics?${query}`));
    const videos = answer.videos.filter((v): v is Video => isVideo(v));
    if (videos.length !== answer.videos.length) console.warn(`Dropped ${answer.videos.length - videos.length} malformed videos`);
    return { videos, paused: answer.paused };
  };
}
