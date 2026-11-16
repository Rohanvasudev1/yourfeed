import { ago, compactCount, displayTitle } from "../domain/format";
import type { GlobalFilters, Video } from "../domain/types";
import type { View } from "../state/appState";
import { GridDescriptionToggle, ListDescription } from "./Description";
import { Thumbnail } from "./thumbnail/Thumbnail";

type Props = Readonly<{
  video: Video;
  filters: GlobalFilters;
  view: View;
  descriptionOpen: boolean;
  onToggleDescription: () => void;
}>;

export function VideoCard({ video, filters, view, descriptionOpen, onToggleDescription }: Props) {
  const title = displayTitle(video, filters);
  const channelLine = [
    video.channel,
    ...(filters.hideSubscriberCounts ? [] : [`${compactCount(video.channelSubscribers)} subs`]),
    ...(filters.hideViewCounts ? [] : [`${compactCount(video.views)} views`]),
  ];
  const Description = view === "grid" ? GridDescriptionToggle : ListDescription;
  return (
    <li className={descriptionOpen && view === "grid" ? "card selected" : "card"}>
      <Thumbnail video={video} honest={filters.honestTitles} />
      <div className="card-body">
        <h3 className={view === "grid" ? "card-title clamp" : "card-title"}>{title}</h3>
        <p className="card-meta">{channelLine.join(" · ")}</p>
        <p className="card-meta">
          {video.topic} · {ago(video.ageHours)}
        </p>
        <Description video={video} title={title} open={descriptionOpen} onToggle={onToggleDescription} />
      </div>
    </li>
  );
}
