import { IconCopy, IconShare, IconX } from "@tabler/icons-react";
import { useId, useState } from "react";
import { displayTitle, minutesText, videoCount } from "../../domain/format";
import { encodeShare, shareUrl, type Share } from "../../domain/share";
import type { GlobalFilters, Video } from "../../domain/types";
import { useTimedValue } from "../../state/useTimedValue";
import { Flash } from "../Flash";
import { Thumbnail } from "../thumbnail/Thumbnail";
import { ShareSend } from "./ShareSend";
import "./share.css";

const FLASH_MS = 5000;
const COPIED = "Link copied.";
const NO_CLIPBOARD = "Copying isn't available here. Select the link and copy it yourself.";
const COPY_FAILED = "Couldn't copy the link. Try again.";

type Props = Readonly<{
  id: string;
  feedName: string;
  /** Everything the share starts with: the session, then pinned videos, then Up next. */
  videos: readonly Video[];
  notes: Readonly<Record<string, string>>;
  filters: GlobalFilters;
  onClose: () => void;
}>;

/** Notes on the picked videos that have any, keyed by video id. */
const notesFor = (picked: readonly Video[], notes: Readonly<Record<string, string>>) =>
  Object.fromEntries(picked.flatMap((v) => (notes[v.id]?.trim() ? [[v.id, notes[v.id]]] : [])));

/** "Share this feed": pick videos, maybe include notes, then copy a working link or (demo only) send it. */
export function SharePanel({ id, feedName, videos, notes, filters, onClose }: Props) {
  const headingId = useId();
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set());
  const [includeNotes, setIncludeNotes] = useState(false);
  const [flash, showFlash] = useTimedValue<string>(FLASH_MS);

  const picked = videos.filter((v) => !unticked.has(v.id));
  const pickedNotes = notesFor(picked, notes);
  const notedCount = Object.keys(pickedNotes).length;
  const share: Share = {
    title: feedName,
    videos: picked.map((v) => v.id),
    ...(includeNotes && notedCount > 0 ? { notes: pickedNotes } : {}),
  };
  const encoded = encodeShare(share);
  const link = encoded.ok ? shareUrl(window.location.href, encoded.encoded) : "";
  const allPicked = picked.length === videos.length;

  const toggle = (id: string) => {
    const next = new Set(unticked);
    if (!next.delete(id)) next.add(id);
    setUnticked(next);
  };
  const copy = () => {
    if (!navigator.clipboard) return showFlash(NO_CLIPBOARD);
    navigator.clipboard.writeText(link).then(
      () => showFlash(COPIED),
      (error: unknown) => {
        console.warn("Copying the share link failed", error);
        showFlash(COPY_FAILED);
      },
    );
  };

  return (
    <section id={id} className="share-panel" aria-labelledby={headingId}>
      <div className="share-head">
        <IconShare size={20} aria-hidden="true" />
        <div className="share-head-text">
          <h3 id={headingId}>Share this feed</h3>
          <p className="muted small">
            {feedName} · {videoCount(picked.length)}
            {picked.length > 0 && ` · ${minutesText(picked.reduce((sum, v) => sum + v.minutes, 0))}`}. Untick anything you don't want to send.
          </p>
        </div>
        <button type="button" className="icon-button" aria-label="Close sharing" title="Close" onClick={onClose}>
          <IconX size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="share-list-head">
        <span className="share-label">
          Videos · {picked.length} of {videos.length} selected
        </span>
        <button type="button" className="link-button" onClick={() => setUnticked(allPicked ? new Set(videos.map((v) => v.id)) : new Set())}>
          {allPicked ? "Clear all" : "Select all"}
        </button>
      </div>
      <ul className="share-list">
        {videos.map((video) => {
          const title = displayTitle(video, filters);
          const on = !unticked.has(video.id);
          return (
            <li key={video.id}>
              <label className={on ? "share-pick" : "share-pick off"}>
                <input type="checkbox" checked={on} aria-label={`Include ${title}`} onChange={() => toggle(video.id)} />
                <span className="share-thumb" aria-hidden="true">
                  <Thumbnail video={video} honest={filters.honestTitles} />
                </span>
                <span className="share-title">{title}</span>
                <span className="muted small">{video.minutes}m</span>
              </label>
            </li>
          );
        })}
      </ul>
      {!encoded.ok && (
        <p className="field-error share-problem" aria-live="polite">
          {encoded.problem}
        </p>
      )}

      <p className="share-label">Link</p>
      <div className="share-row">
        <input type="text" readOnly aria-label="Share link" value={link} placeholder="Pick a video first" onFocus={(e) => e.target.select()} />
        <button type="button" className="text-button" disabled={!encoded.ok} onClick={copy}>
          <IconCopy size={15} aria-hidden="true" />
          Copy link
        </button>
      </div>
      <Flash message={flash} />

      <ShareSend disabled={!encoded.ok} />

      {notedCount > 0 && (
        <div className="share-notes">
          <label>
            <input type="checkbox" checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} />
            Include my notes ({videoCount(notedCount)})
          </label>
          {includeNotes && <p className="muted small">Anyone with the link can read these notes.</p>}
        </div>
      )}
      <p className="share-demo muted">Demo only: nothing is actually sent to anyone.</p>
    </section>
  );
}
