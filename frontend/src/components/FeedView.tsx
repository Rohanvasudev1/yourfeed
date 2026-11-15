import { useMemo } from "react";
import { composeFeed } from "../domain/compose";
import { TOP_RANGE_HOURS } from "../domain/feed";
import type { GlobalFilters, Feed, Video } from "../domain/types";
import { VideoCard } from "./VideoCard";

type Props = Readonly<{
  catalog: readonly Video[];
  feed: Feed;
  filters: GlobalFilters;
  watched: readonly string[];
}>;

export function FeedView({ catalog, feed, filters, watched }: Props) {
  const { upNext } = useMemo(
    () => composeFeed({ catalog, feed, filters, watched, topMaxAgeHours: TOP_RANGE_HOURS[feed.topRange] }),
    [catalog, feed, filters, watched],
  );
  return (
    <ul className="feed-grid" aria-label="Up next">
      {upNext.map((video) => (
        <VideoCard key={video.id} video={video} filters={filters} />
      ))}
    </ul>
  );
}
