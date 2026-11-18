import { useState, type Dispatch } from "react";
import { bulkProblem, bulkTabActions, type BulkAction } from "../domain/editTabs";
import type { Feed } from "../domain/types";
import type { Action } from "./appState";

/** Edit mode, shared by the tab bar and All tabs. Page state only: a reload starts with it off. */
export type EditControls = Readonly<{
  editing: boolean;
  /** Selected feed names, in the order they were picked. */
  selected: readonly string[];
  /** Waiting for the visitor to confirm deleting the selection. */
  confirmingDelete: boolean;
  message: string | null;
  toggleEditing: () => void;
  stop: () => void;
  toggle: (name: string) => void;
  /** Runs a bulk action, except delete, which asks first. */
  act: (action: BulkAction) => void;
  confirmDelete: () => void;
  cancelDelete: () => void;
}>;

type EditState = Readonly<{
  editing: boolean;
  selected: readonly string[];
  confirmingDelete: boolean;
  message: string | null;
}>;

const OFF: EditState = {
  editing: false,
  selected: [],
  confirmingDelete: false,
  message: null,
};
const ON: EditState = { ...OFF, editing: true };

export function useEditMode(feeds: readonly Feed[], dispatch: Dispatch<Action>): EditControls {
  const [stored, setEdit] = useState<EditState>(OFF);
  // A selected feed can disappear (a dropped draft), so the selection only names feeds that still exist.
  const edit = { ...stored, selected: stored.selected.filter((name) => feeds.some((f) => f.name === name)) };

  const run = (action: BulkAction) => {
    bulkTabActions(edit.selected, action).forEach(dispatch);
    setEdit(ON);
  };

  return {
    ...edit,
    toggleEditing: () => setEdit(edit.editing ? OFF : ON),
    stop: () => setEdit(OFF),
    toggle: (name) =>
      setEdit({
        ...ON,
        selected: edit.selected.includes(name) ? edit.selected.filter((n) => n !== name) : [...edit.selected, name],
      }),
    act: (action) => {
      const problem = bulkProblem(feeds, edit.selected, action);
      if (problem) setEdit({ ...edit, confirmingDelete: false, message: problem });
      else if (action === "delete") setEdit({ ...edit, confirmingDelete: true, message: null });
      else run(action);
    },
    confirmDelete: () => run("delete"),
    cancelDelete: () => setEdit({ ...edit, confirmingDelete: false }),
  };
}
