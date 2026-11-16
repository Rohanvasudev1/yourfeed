import { IconChevronDown, IconChevronRight, IconCopy, IconNotebook } from "@tabler/icons-react";
import { useState } from "react";
import { displayTitle, videoCount } from "../domain/format";
import type { Feed, GlobalFilters, Video } from "../domain/types";
import type { Notes } from "../state/useNotes";
import { NoteBox } from "./NoteBox";
import { PlayableThumbnail, PlayableTitle } from "./Playable";
import { SessionMeta } from "./Session";

type Props = Readonly<{
  feed: Feed;
  /** The feed's session videos, Finished first, then Watching now. */
  videos: readonly Video[];
  filters: GlobalFilters;
  notes: Notes;
  onPlay: (video: Video) => void;
}>;

/** The collapsed Feed notes section: a note on the whole feed plus every session video's notes. */
export function FeedNotes({ feed, videos, filters, notes, onPlay }: Props) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? IconChevronDown : IconChevronRight;
  const withNotes = videos.filter((v) => notes.forVideo(v.id).value.trim()).length;
  return (
    <section className="feed-notes" aria-label="Feed notes">
      <h2 className="section-label">
        <button type="button" className="section-toggle" aria-expanded={open} aria-controls="feed-notes-body" onClick={() => setOpen(!open)}>
          <Chevron size={16} aria-hidden="true" />
          <IconNotebook size={18} aria-hidden="true" />
          <span className="section-toggle-name feed-notes-name">Feed notes</span>
          <span className="muted small">
            {feed.name} · {videoCount(videos.length)} · {withNotes} with notes
          </span>
        </button>
      </h2>
      {open && (
        <div id="feed-notes-body" className="feed-notes-body">
          <div className="feed-notes-intro">
            <span className="muted small">Every video you watch in this feed lands here with its notes.</span>
            <button type="button" className="icon-button" aria-label="Copy all notes as Markdown" title="Copy as Markdown" onClick={notes.copy}>
              <IconCopy size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="feed-note">
            <p className="feed-note-label">About this feed</p>
            <NoteBox label="Notes on this whole feed" placeholder="Thoughts on this whole session" note={notes.forFeed} />
          </div>
          {videos.length > 0 ? (
            <ul className="session-list">
              {videos.map((video) => (
                <FeedNotesEntry
                  key={video.id}
                  video={video}
                  watchingNow={video.id === feed.current}
                  filters={filters}
                  notes={notes}
                  onPlay={() => onPlay(video)}
                />
              ))}
            </ul>
          ) : (
            <p className="muted small feed-notes-empty">Watch a video from this feed and it'll show up here, ready for notes.</p>
          )}
        </div>
      )}
    </section>
  );
}

type EntryProps = Readonly<{
  video: Video;
  watchingNow: boolean;
  filters: GlobalFilters;
  notes: Notes;
  onPlay: () => void;
}>;

function FeedNotesEntry({ video, watchingNow, filters, notes, onPlay }: EntryProps) {
  const title = displayTitle(video, filters);
  return (
    <li className="feed-notes-entry">
      <PlayableThumbnail video={video} title={title} honest={filters.honestTitles} onPlay={onPlay} />
      <div className="session-body">
        <div className="feed-notes-title">
          <PlayableTitle title={title} clamp onPlay={onPlay} />
          <span className={watchingNow ? "badge now" : "badge"}>{watchingNow ? "Watching now" : "Finished"}</span>
        </div>
        <SessionMeta video={video} />
        <NoteBox label={`Notes on ${title}`} placeholder="Notes on this video" note={notes.forVideo(video.id)} />
      </div>
    </li>
  );
}
