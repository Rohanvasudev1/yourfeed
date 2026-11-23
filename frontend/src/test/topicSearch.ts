import type { TopicVideos } from "../domain/topicSearch";
import type { Video } from "../domain/types";
import type { TopicSearchPort } from "../ports";

type Script = Readonly<{
  /** What YouTube finds for each topic; topics left out find nothing. */
  found?: Readonly<Record<string, readonly Video[]>>;
  /** Whether today's searches are used up. */
  paused?: boolean;
  /** Makes every search fail, as if the server were down. */
  down?: boolean;
}>;

/** A stand-in for the backend's topic searches: each video comes back as the topic that found it. */
export function fakeTopicSearch({ found = {}, paused = false, down = false }: Script = {}) {
  const calls: (readonly string[])[] = [];
  const search: TopicSearchPort = async (topics) => {
    calls.push(topics);
    if (down) throw new Error("Couldn't reach the Yourfeed server.");
    const videos = topics.flatMap((topic) => (found[topic] ?? []).map((v) => ({ ...v, topic })));
    return { videos, paused } satisfies TopicVideos;
  };
  return { search, calls, searched: () => calls.flat() };
}
