import { IconBroadcast } from "@tabler/icons-react";
import { ago, compactCount, durationText } from "../domain/format";
import type { GlobalFilters, Video } from "../domain/types";

type Props = Readonly<{
  video: Video;
  filters: GlobalFilters;
  /** Position badge ("#1") on Most viewed; absent elsewhere. */
  rank?: number;
}>;

export function VideoCard({ video, filters, rank }: Props) {
  const title = filters.honestTitles ? video.honestTitle : video.title;
  const channelLine = [
    video.channel,
    ...(filters.hideSubscriberCounts ? [] : [`${compactCount(video.channelSubscribers)} subs`]),
    ...(filters.hideViewCounts ? [] : [`${compactCount(video.views)} views`]),
  ];
  return (
    <li className="card">
      <div className="thumb">
        <span className="thumb-caption" aria-hidden="true">
          {video.topic.toUpperCase()}
        </span>
        {rank !== undefined && <span className="thumb-badge thumb-rank">#{rank}</span>}
        {video.live ? (
          <span className="thumb-badge thumb-duration thumb-live">
            <IconBroadcast size={12} aria-hidden="true" />
            LIVE
          </span>
        ) : (
          <span className="thumb-badge thumb-duration" aria-hidden="true">
            {durationText(video)}
          </span>
        )}
      </div>
      <div className="card-body">
        <h3 className="card-title clamp">{title}</h3>
        <p className="card-meta">{channelLine.join(" · ")}</p>
        <p className="card-meta">
          {video.topic} · {ago(video.ageHours)}
        </p>
      </div>
    </li>
  );
}
