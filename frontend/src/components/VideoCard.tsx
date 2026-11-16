import { IconCarouselHorizontal, IconEye, IconEyeCheck, IconTrash } from "@tabler/icons-react";
import { ago, compactCount, displayTitle } from "../domain/format";
import type { GlobalFilters, Video } from "../domain/types";
import type { View } from "../state/appState";
import type { CardActions } from "../state/useCardActions";
import type { SaveActions } from "../state/useLibrary";
import { ChannelWord, TopicWord } from "./card/CardWords";
import { likeRowId } from "./card/ids";
import { GridDescriptionToggle, ListDescription } from "./Description";
import { SaveControl } from "./library/SaveControl";
import { PlayableThumbnail, PlayableTitle } from "./Playable";
import type { PopupController } from "./popup/usePopupController";

type Props = Readonly<{
  video: Video;
  filters: GlobalFilters;
  view: View;
  descriptionOpen: boolean;
  onToggleDescription: () => void;
  likeOpen: boolean;
  onToggleLike: () => void;
  onPlay: () => void;
  saveActions: SaveActions;
  actions: CardActions;
  /** Shared by every card in the feed, so only one topic or channel popup is open. */
  popups: PopupController<string>;
  /** Position badge ("#1") on Most viewed; absent elsewhere. */
  rank?: number;
}>;

export function VideoCard(props: Props) {
  const { video, filters, view, descriptionOpen, onToggleDescription, onPlay, actions, popups, rank } = props;
  const title = displayTitle(video, filters);
  const watched = actions.isWatched(video);
  const counts = [
    ...(filters.hideSubscriberCounts ? [] : [`${compactCount(video.channelSubscribers)} subs`]),
    ...(filters.hideViewCounts ? [] : [`${compactCount(video.views)} views`]),
  ];
  const Description = view === "grid" ? GridDescriptionToggle : ListDescription;
  const wordProps = { actions, popups };
  return (
    <li className={(descriptionOpen || props.likeOpen) && view === "grid" ? "card selected" : "card"}>
      <PlayableThumbnail video={video} title={title} honest={filters.honestTitles} rank={rank} watched={watched} onPlay={onPlay} />
      <div className="card-body">
        <PlayableTitle title={title} clamp={view === "grid"} onPlay={onPlay} />
        {/* Divs, not paragraphs: the topic and channel popups hold block content. */}
        <div className="card-meta">
          <ChannelWord value={video.channel} popupKey={`channel-${video.id}`} hideSubscriberCounts={filters.hideSubscriberCounts} {...wordProps} />
          {counts.map((count) => ` · ${count}`)}
        </div>
        <div className="card-meta">
          <TopicWord value={video.topic} popupKey={`topic-${video.id}`} {...wordProps} /> · {ago(video.ageHours)}
        </div>
        <Description video={video} title={title} open={descriptionOpen} onToggle={onToggleDescription} />
      </div>
      <CardButtons {...props} title={title} watched={watched} />
    </li>
  );
}

function CardButtons({ video, title, watched, likeOpen, onToggleLike, saveActions, actions }: Props & Readonly<{ title: string; watched: boolean }>) {
  const WatchedIcon = watched ? IconEyeCheck : IconEye;
  return (
    <div className="card-actions">
      <SaveControl video={video} title={title} saveActions={saveActions} />
      <button
        type="button"
        className={watched ? "icon-button on" : "icon-button"}
        aria-label={`Mark ${title} as watched`}
        aria-pressed={watched}
        title={watched ? "Watched" : "Already watched"}
        onClick={() => actions.toggleWatched(video)}
      >
        <WatchedIcon size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={likeOpen ? "icon-button on" : "icon-button"}
        aria-label={`Videos like ${title}`}
        title="Videos like this"
        aria-expanded={likeOpen}
        aria-controls={likeOpen ? likeRowId(video) : undefined}
        onClick={onToggleLike}
      >
        <IconCarouselHorizontal size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label={`Remove ${title} from this session`}
        title="Remove from session"
        onClick={() => actions.removeFromSession(video)}
      >
        <IconTrash size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
