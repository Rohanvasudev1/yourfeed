import { IconBookmark, IconBookmarkPlus } from "@tabler/icons-react";
import { useState } from "react";
import type { Video } from "../../domain/types";
import type { SaveActions } from "../../state/useLibrary";
import { FolderPicker } from "./FolderPicker";
import "./library.css";

type Props = Readonly<{ video: Video; title: string; saveActions: SaveActions }>;

/**
 * A card's Save button and the "Save to" picker it opens. Unlike the mockup, a second click doesn't
 * unsave: saving again says "Already in <folder>." Videos leave a folder from the Saved section.
 */
export function SaveControl({ video, title, saveActions }: Props) {
  const [open, setOpen] = useState(false);
  const saved = saveActions.isSaved(video);
  const Icon = saved ? IconBookmark : IconBookmarkPlus;
  const pickerId = `save-to-${video.id}`;

  return (
    <>
      <button
        type="button"
        className={saved ? "icon-button on" : "icon-button"}
        aria-label={saved ? `Save ${title}, saved` : `Save ${title}`}
        title={saved ? "Saved" : "Save"}
        aria-expanded={open}
        aria-controls={pickerId}
        onClick={() => setOpen(!open)}
      >
        <Icon size={16} aria-hidden="true" />
      </button>
      {open && <FolderPicker id={pickerId} video={video} saveActions={saveActions} onSaved={() => setOpen(false)} />}
    </>
  );
}
