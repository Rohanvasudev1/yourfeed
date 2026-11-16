import { IconFolder, IconFolderPlus } from "@tabler/icons-react";
import { useState } from "react";
import type { Video } from "../../domain/types";
import type { SaveActions } from "../../state/useLibrary";
import { NewFolderForm } from "./NewFolderForm";

type Props = Readonly<{ id: string; video: Video; saveActions: SaveActions; onSaved: () => void }>;

/** "Save to" one of the folders or a new one. A repeat save stays open and says so. */
export function FolderPicker({ id, video, saveActions, onSaved }: Props) {
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const saveTo = (folder: string) => {
    const result = saveActions.save(video, folder);
    if (result === null) onSaved();
    else setMessage(result);
  };
  const createAndSave = (name: string) => {
    const error = saveActions.createFolder(name, video);
    if (error === null) onSaved();
    return error;
  };

  return (
    <div id={id} className="save-picker" role="group" aria-label="Save to">
      <span className="muted small">Save to</span>
      {saveActions.folderNames.map((name) => (
        <button key={name} type="button" className="folder-chip" onClick={() => saveTo(name)}>
          <IconFolder size={14} aria-hidden="true" />
          {name}
        </button>
      ))}
      {creating ? (
        <NewFolderForm onCreate={createAndSave} onCancel={() => setCreating(false)} />
      ) : (
        <button type="button" className="folder-chip" onClick={() => setCreating(true)}>
          <IconFolderPlus size={14} aria-hidden="true" />
          New folder
        </button>
      )}
      {message && (
        <p className="save-message small" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
