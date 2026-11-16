import { IconBookmark, IconChevronRight, IconFolder, IconFolderOpen, IconFolderPlus } from "@tabler/icons-react";
import { useId, useState } from "react";
import { folderCount, minutesText, videoCount } from "../../domain/format";
import { folderNameFrom } from "../../domain/library";
import type { ResolvedFolder } from "../../state/useLibrary";
import { LibraryRow } from "./LibraryRow";
import { LibrarySection, type LibraryProps } from "./LibrarySection";
import { NewFolderForm } from "./NewFolderForm";

/** Saved folders. The first starts open, as Watch later does in the mockup. */
export function SavedSection(props: LibraryProps) {
  const { folders } = props.library;
  const [openFolders, setOpenFolders] = useState<ReadonlySet<string>>(() => new Set(folders.slice(0, 1).map((f) => f.name)));
  const [creating, setCreating] = useState(false);
  const total = folders.reduce((sum, f) => sum + f.videos.length, 0);

  const toggle = (name: string) =>
    setOpenFolders((open) => (open.has(name) ? new Set([...open].filter((n) => n !== name)) : new Set([...open, name])));
  const create = (name: string) => {
    const error = props.library.createFolder(name);
    if (error === null) {
      setCreating(false);
      setOpenFolders((open) => new Set([...open, folderNameFrom(name)]));
    }
    return error;
  };

  return (
    <LibrarySection name="Saved" icon={IconBookmark} summary={`${folderCount(folders.length)} · ${videoCount(total)}`}>
      <div className="library-toolbar">
        <span className="muted small">Use + to add a saved video to this session</span>
        <button
          type="button"
          className="icon-button"
          aria-label="New folder"
          title="New folder"
          aria-expanded={creating}
          onClick={() => setCreating(!creating)}
        >
          <IconFolderPlus size={16} aria-hidden="true" />
        </button>
      </div>
      {creating && <NewFolderForm onCreate={create} onCancel={() => setCreating(false)} />}
      {folders.map((folder) => (
        <Folder key={folder.name} {...props} folder={folder} open={openFolders.has(folder.name)} onToggle={() => toggle(folder.name)} />
      ))}
    </LibrarySection>
  );
}

type FolderProps = LibraryProps & Readonly<{ folder: ResolvedFolder; open: boolean; onToggle: () => void }>;

function Folder({ folder, open, onToggle, ...props }: FolderProps) {
  const listId = useId();
  const minutes = folder.videos.reduce((sum, v) => sum + v.minutes, 0);
  const FolderIcon = open ? IconFolderOpen : IconFolder;
  return (
    <div className="folder">
      <button type="button" className="folder-toggle" aria-expanded={open} aria-controls={listId} onClick={onToggle}>
        <IconChevronRight size={16} className={open ? "chevron open" : "chevron"} aria-hidden="true" />
        <FolderIcon size={20} className="folder-icon" aria-hidden="true" />
        <span className="section-toggle-name">{folder.name}</span>
        <span className="muted small">
          {videoCount(folder.videos.length)}
          {minutes > 0 && ` · ${minutesText(minutes)}`}
        </span>
      </button>
      {open && (
        <ul id={listId} className="session-list folder-list" aria-label={folder.name}>
          {folder.videos.length === 0 && <li className="muted small library-empty">Empty. Use Save on any video to add one.</li>}
          {folder.videos.map((video) => (
            <LibraryRow
              key={video.id}
              {...props}
              video={video}
              removeFrom={folder.name}
              onRemove={(v) => props.library.removeFromFolder(folder.name, v)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
