import { IconBookmark, IconChevronRight, IconFolder, IconFolderOpen, IconFolderPlus, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { minutesText, videoCount } from "../../domain/format";
import type { GlobalFilters, Video } from "../../domain/types";
import type { Library, ResolvedFolder } from "../../state/useLibrary";
import { LibraryRow } from "./LibraryRow";
import { LibrarySection } from "./LibrarySection";
import { NewFolderForm } from "./NewFolderForm";

type Props = Readonly<{ library: Library; filters: GlobalFilters; onPlay: (video: Video) => void }>;

const folderCount = (n: number) => `${n} folder${n === 1 ? "" : "s"}`;

/** Saved folders. The first starts open, as Watch later does in the mockup. */
export function SavedSection({ library, filters, onPlay }: Props) {
  const { folders } = library;
  const [openFolders, setOpenFolders] = useState<ReadonlySet<string>>(() => new Set(folders.slice(0, 1).map((f) => f.name)));
  const [creating, setCreating] = useState(false);
  const total = folders.reduce((sum, f) => sum + f.videos.length, 0);

  const toggle = (name: string) =>
    setOpenFolders((open) => (open.has(name) ? new Set([...open].filter((n) => n !== name)) : new Set([...open, name])));
  const create = (name: string) => {
    const error = library.createFolder(name);
    if (error === null) {
      setCreating(false);
      setOpenFolders((open) => new Set([...open, name.trim()]));
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
        <Folder
          key={folder.name}
          folder={folder}
          open={openFolders.has(folder.name)}
          onToggle={() => toggle(folder.name)}
          library={library}
          filters={filters}
          onPlay={onPlay}
        />
      ))}
    </LibrarySection>
  );
}

type FolderProps = Props & Readonly<{ folder: ResolvedFolder; open: boolean; onToggle: () => void }>;

function Folder({ folder, open, onToggle, library, filters, onPlay }: FolderProps) {
  const minutes = folder.videos.reduce((sum, v) => sum + v.minutes, 0);
  const FolderIcon = open ? IconFolderOpen : IconFolder;
  return (
    <div className="folder">
      <button type="button" className="folder-toggle" aria-expanded={open} onClick={onToggle}>
        <IconChevronRight size={16} className={open ? "chevron open" : "chevron"} aria-hidden="true" />
        <FolderIcon size={20} className="folder-icon" aria-hidden="true" />
        <span className="section-toggle-name">{folder.name}</span>
        <span className="muted small">
          {videoCount(folder.videos.length)}
          {minutes > 0 && ` · ${minutesText(minutes)}`}
        </span>
      </button>
      {open && (
        <ul className="session-list folder-list" aria-label={folder.name}>
          {folder.videos.length === 0 && <li className="muted small library-empty">Empty. Use Save on any video to add one.</li>}
          {folder.videos.map((video) => (
            <LibraryRow
              key={video.id}
              video={video}
              filters={filters}
              inSession={library.inSession(video)}
              onPlay={onPlay}
              onAddToSession={library.pin}
              action={(title) => (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove ${title} from ${folder.name}`}
                  title="Remove from folder"
                  onClick={() => library.removeFromFolder(folder.name, video)}
                >
                  <IconX size={16} aria-hidden="true" />
                </button>
              )}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
