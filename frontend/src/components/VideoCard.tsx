import { ago, compactCount, displayTitle } from "../domain/format";
import type { GlobalFilters, Video } from "../domain/types";
import type { View } from "../state/appState";
import type { SaveActions } from "../state/useLibrary";
import { GridDescriptionToggle, ListDescription } from "./Description";
import { SaveControl } from "./library/SaveControl";
import { PlayableThumbnail, PlayableTitle } from "./Playable";

type Props = Readonly<{
  video: Video;
  filters: GlobalFilters;
  view: View;
  descriptionOpen: boolean;
  onToggleDescription: () => void;
  onPlay: () => void;
  saveActions: SaveActions;
  /** Position badge ("#1") on Most viewed; absent elsewhere. */
  rank?: number;
}>;

export function VideoCard({ video, filters, view, descriptionOpen, onToggleDescription, onPlay, saveActions, rank }: Props) {
  const title = displayTitle(video, filters);
  const channelLine = [
    video.channel,
    ...(filters.hideSubscriberCounts ? [] : [`${compactCount(video.channelSubscribers)} subs`]),
    ...(filters.hideViewCounts ? [] : [`${compactCount(video.views)} views`]),
  ];
  const Description = view === "grid" ? GridDescriptionToggle : ListDescription;
  return (
    <li className={descriptionOpen && view === "grid" ? "card selected" : "card"}>
      <PlayableThumbnail video={video} title={title} honest={filters.honestTitles} rank={rank} onPlay={onPlay} />
      <div className="card-body">
        <PlayableTitle title={title} clamp={view === "grid"} onPlay={onPlay} />
        <p className="card-meta">{channelLine.join(" · ")}</p>
        <p className="card-meta">
          {video.topic} · {ago(video.ageHours)}
        </p>
        <Description video={video} title={title} open={descriptionOpen} onToggle={onToggleDescription} />
      </div>
      <div className="card-actions">
        <SaveControl video={video} title={title} saveActions={saveActions} />
      </div>
    </li>
  );
}
