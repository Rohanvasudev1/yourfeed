import { IconCopy, IconShare, IconX } from "@tabler/icons-react";
import { useId, useState } from "react";
import { minutesText, videoCount } from "../../domain/format";
import { encodeShare, shareUrl, type Share } from "../../domain/share";
import type { GlobalFilters, Video } from "../../domain/types";
import { copyText, type CopyMessages } from "../../state/copyText";
import { FLASH_MS, useTimedValue } from "../../state/useTimedValue";
import { Flash } from "../Flash";
import { SharePicker } from "./SharePicker";
import { ShareSend } from "./ShareSend";
import "./share.css";

const COPY_MESSAGES: CopyMessages = {
  copied: "Link copied.",
  noClipboard: "Copying isn't available here. Select the link and copy it yourself.",
  failed: "Couldn't copy the link. Try again.",
};

type Props = Readonly<{
  id: string;
  feedName: string;
  /** Everything the share starts with: the session, then pinned videos, then Up next. */
  videos: readonly Video[];
  notes: Readonly<Record<string, string>>;
  filters: GlobalFilters;
  /** People the visitor blends with, offered as one-tap quick-send chips. */
  quickSend: readonly string[];
  onClose: () => void;
}>;

/** Notes on the picked videos that have any, keyed by video id. */
const notesFor = (picked: readonly Video[], notes: Readonly<Record<string, string>>) =>
  Object.fromEntries(picked.flatMap((v) => (notes[v.id]?.trim() ? [[v.id, notes[v.id]]] : [])));

/** "Share this feed": pick videos, maybe include notes, then copy a working link or (demo only) send it. */
export function SharePanel({ id, feedName, videos, notes, filters, quickSend, onClose }: Props) {
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

  const copy = () => copyText(link, COPY_MESSAGES, showFlash);

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

      <SharePicker videos={videos} unticked={unticked} filters={filters} onChange={setUnticked} />
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

      <ShareSend disabled={!encoded.ok} quickSend={quickSend} />

      {notedCount > 0 && (
        <div className="share-notes">
          <label>
            <input type="checkbox" checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} />
            Include my notes ({videoCount(notedCount)})
          </label>
          <p className="muted small">Anyone with the link can read notes you include.</p>
        </div>
      )}
      <p className="share-demo muted">Demo only: nothing is actually sent to anyone.</p>
    </section>
  );
}
