import { durationText } from "../domain/format";
import type { Video } from "../domain/types";
import { Thumbnail } from "./thumbnail/Thumbnail";

type ThumbnailProps = Readonly<{ video: Video; title: string; honest: boolean; rank?: number; watched?: boolean; onPlay: () => void }>;

/** A thumbnail that opens the video. Named like YouTube's: "Play <title>, <duration>". */
export function PlayableThumbnail({ video, title, honest, rank, watched, onPlay }: ThumbnailProps) {
  const length = video.live ? "live" : durationText(video);
  return (
    <button type="button" className="play-thumb" aria-label={`Play ${title}, ${length}${watched ? ", watched" : ""}`} onClick={onPlay}>
      <Thumbnail video={video} honest={honest} rank={rank} watched={watched} />
    </button>
  );
}

type TitleProps = Readonly<{ title: string; clamp?: boolean; onPlay: () => void }>;

/** A card heading whose text opens the video. */
export function PlayableTitle({ title, clamp = false, onPlay }: TitleProps) {
  return (
    <h3 className={clamp ? "card-title clamp" : "card-title"}>
      <button type="button" className="play-title" onClick={onPlay}>
        {title}
      </button>
    </h3>
  );
}
