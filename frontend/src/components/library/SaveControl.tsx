import { IconBookmark, IconBookmarkPlus, IconFolder, IconFolderPlus } from "@tabler/icons-react";
import { useState } from "react";
import type { Video } from "../../domain/types";
import type { SaveActions } from "../../state/useLibrary";
import "./library.css";
import { NewFolderForm } from "./NewFolderForm";

type Props = Readonly<{ video: Video; title: string; saving: SaveActions }>;

/** A card's Save button and the "Save to" folder picker it opens. */
export function SaveControl({ video, title, saving }: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const saved = saving.isSaved(video);
  const Icon = saved ? IconBookmark : IconBookmarkPlus;
  const pickerId = `save-to-${video.id}`;

  const close = () => {
    setOpen(false);
    setCreating(false);
    setMessage(null);
  };
  const done = (result: string | null) => (result === null ? close() : setMessage(result));
  const createAndSave = (name: string) => {
    const error = saving.saveToNewFolder(video, name);
    if (error === null) close();
    return error;
  };

  return (
    <>
      <button
        type="button"
        className={saved ? "icon-button on" : "icon-button"}
        aria-label={`Save ${title}`}
        title={saved ? "Saved" : "Save"}
        aria-expanded={open}
        aria-controls={pickerId}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Icon size={16} aria-hidden="true" />
      </button>
      {open && (
        <div id={pickerId} className="save-picker" role="group" aria-label="Save to">
          <span className="muted small">Save to</span>
          {saving.folderNames.map((name) => (
            <button key={name} type="button" className="folder-chip" onClick={() => done(saving.save(video, name))}>
              <IconFolder size={14} aria-hidden="true" />
              {name}
            </button>
          ))}
          {!creating && (
            <button type="button" className="folder-chip" onClick={() => setCreating(true)}>
              <IconFolderPlus size={14} aria-hidden="true" />
              New folder
            </button>
          )}
          {creating && <NewFolderForm onCreate={createAndSave} onCancel={() => setCreating(false)} />}
          {message && (
            <p className="save-message small" role="status">
              {message}
            </p>
          )}
        </div>
      )}
    </>
  );
}
