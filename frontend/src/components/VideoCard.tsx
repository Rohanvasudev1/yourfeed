import { ago, compactCount, durationText } from "../domain/format";
import type { GlobalFilters, Video } from "../domain/types";

type Props = Readonly<{ video: Video; filters: GlobalFilters }>;

export function VideoCard({ video, filters }: Props) {
  const title = filters.honestTitles ? video.honestTitle : video.title;
  const channelLine = [
    video.channel,
    ...(filters.hideSubscriberCounts ? [] : [`${compactCount(video.channelSubscribers)} subs`]),
    ...(filters.hideViewCounts ? [] : [`${compactCount(video.views)} views`]),
  ];
  return (
    <li className="card">
      <div className="thumb" aria-hidden="true">
        <span className="thumb-caption">{video.topic.toUpperCase()}</span>
        <span className="thumb-duration">{video.live ? "LIVE" : durationText(video)}</span>
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
