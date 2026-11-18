import { IconApps, IconLayoutNavbar, IconTrash } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import type { EditControls } from "../state/useEditMode";
import "./editMode.css";

type Props = Readonly<{ edit: EditControls; onAllTabs: boolean }>;

/** Under the tab bar in edit mode: how many tabs are selected and what to do with them. */
export function EditBar({ edit, onAllTabs }: Props) {
  const count = edit.selected.length;
  const cancel = useRef<HTMLButtonElement>(null);
  // The Delete button that asked goes away, so focus moves to the safe answer.
  useEffect(() => {
    if (edit.confirmingDelete) cancel.current?.focus();
  }, [edit.confirmingDelete]);
  return (
    <section className="edit-bar" aria-label="Edit tabs">
      <span className="edit-bar-count">{count ? `${count} selected` : "Select tabs, or drag them to reorder"}</span>
      {edit.confirmingDelete ? (
        <>
          <span>{`Delete ${count} tab${count === 1 ? "" : "s"}? This can't be undone.`}</span>
          <button type="button" className="danger" onClick={edit.confirmDelete}>
            Delete
          </button>
          <button ref={cancel} type="button" onClick={edit.cancelDelete}>
            Cancel
          </button>
        </>
      ) : (
        <>
          {onAllTabs && (
            <button type="button" onClick={() => edit.act("show")}>
              <IconLayoutNavbar size={14} aria-hidden="true" />
              Show in tab bar
            </button>
          )}
          <button type="button" onClick={() => edit.act("shelve")}>
            <IconApps size={14} aria-hidden="true" />
            Move to All tabs
          </button>
          <button type="button" className="danger" onClick={() => edit.act("delete")}>
            <IconTrash size={14} aria-hidden="true" />
            Delete
          </button>
        </>
      )}
      {edit.message && (
        <p className="edit-bar-message" role="alert">
          {edit.message}
        </p>
      )}
    </section>
  );
}
