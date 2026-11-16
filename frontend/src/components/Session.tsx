import {
  IconArrowBackUp,
  IconBrandYoutube,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCircleCheck,
} from "@tabler/icons-react";
import { useState } from "react";
import { displayTitle, minutesText, videoCount } from "../domain/format";
import type { GlobalFilters, Video } from "../domain/types";
import { PlayableThumbnail, PlayableTitle } from "./Playable";

type WatchingNowProps = Readonly<{
  video: Video;
  filters: GlobalFilters;
  /** The visitor came back to the page while watching: Finished turns blue to ask if they're done. */
  nudge: boolean;
  onPlay: () => void;
  onFinish: () => void;
}>;

export function WatchingNow({ video, filters, nudge, onPlay, onFinish }: WatchingNowProps) {
  const title = displayTitle(video, filters);
  return (
    <section className="session-section" aria-labelledby="watching-now">
      <h2 id="watching-now" className="section-label">
        <span className="live-dot" aria-hidden="true" />
        Watching now
      </h2>
      <div className="session-row current">
        <PlayableThumbnail video={video} title={title} honest={filters.honestTitles} onPlay={onPlay} />
        <div className="session-body">
          <PlayableTitle title={title} onPlay={onPlay} />
          <p className="card-meta">
            {video.channel} · {video.minutes} min
          </p>
          <div className="session-actions">
            <button type="button" className="icon-button" aria-label="Open on YouTube again" title="Open on YouTube again" onClick={onPlay}>
              <IconBrandYoutube size={16} aria-hidden="true" />
            </button>
            <button type="button" className={nudge ? "text-button primary" : "text-button"} onClick={onFinish}>
              <IconCheck size={16} aria-hidden="true" />
              Finished
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

type FinishedProps = Readonly<{
  videos: readonly Video[];
  filters: GlobalFilters;
  onPlay: (video: Video) => void;
  onMoveBack: (video: Video) => void;
}>;

/** The session's Finished videos, open by default as in the mockup. */
export function FinishedSection({ videos, filters, onPlay, onMoveBack }: FinishedProps) {
  const [open, setOpen] = useState(true);
  const Chevron = open ? IconChevronDown : IconChevronRight;
  const total = videos.reduce((sum, v) => sum + v.minutes, 0);
  return (
    <section className="session-section" aria-label="Finished">
      <h2 className="section-label">
        <button type="button" className="section-toggle" aria-expanded={open} aria-controls="finished-list" onClick={() => setOpen(!open)}>
          <Chevron size={16} aria-hidden="true" />
          <IconCircleCheck size={17} className="finished-icon" aria-hidden="true" />
          <span className="section-toggle-name">Finished</span>
          <span className="muted small">
            {videoCount(videos.length)} · {minutesText(total)}
          </span>
        </button>
      </h2>
      {open && (
        <ul id="finished-list" className="session-list">
          {videos.map((video) => {
            const title = displayTitle(video, filters);
            return (
              <li key={video.id} className="session-row">
                <PlayableThumbnail video={video} title={title} honest={filters.honestTitles} onPlay={() => onPlay(video)} />
                <div className="session-body">
                  <PlayableTitle title={title} onPlay={() => onPlay(video)} />
                  <p className="card-meta">
                    {video.channel} · {video.minutes} min
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Move ${title} back to Up next`}
                  title="Move back to Up next"
                  onClick={() => onMoveBack(video)}
                >
                  <IconArrowBackUp size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
