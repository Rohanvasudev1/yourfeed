import { IconCircle, IconCircleCheck } from "@tabler/icons-react";
import { isBuiltIn, isInExplore } from "../domain/feed";
import type { Feed } from "../domain/types";
import type { EditControls } from "../state/useEditMode";
import { useTabDrag } from "./useTabDrag";

type Props = Readonly<{
  feeds: readonly Feed[];
  /** A shelved feed open in the bar for now, if any. */
  temporary: Feed | null;
  edit: EditControls;
  onMove: (name: string, to: string) => void;
}>;

/** The tab bar in edit mode: every tab, Explore's feeds included, is a check that selects it. Your own still drag to reorder. */
export function EditableTabs({ feeds, temporary, edit, onMove }: Props) {
  const drag = useTabDrag(onMove);
  const inBar = feeds.filter((f) => !f.shelved);
  const ordered = [
    ...inBar.filter((f) => f.kind === "home"),
    ...inBar.filter(isInExplore),
    ...inBar.filter((f) => !isBuiltIn(f)),
    ...(temporary ? [temporary] : []),
  ];

  return ordered.map((f) => {
    const selected = edit.selected.includes(f.name);
    const Check = selected ? IconCircleCheck : IconCircle;
    const home = f.kind === "home";
    return (
      <button
        key={f.name}
        type="button"
        className={home ? "tab tab-home" : "tab"}
        aria-pressed={selected}
        aria-label={home ? `${f.name} (home)` : undefined}
        title={home ? f.name : undefined}
        onClick={() => edit.toggle(f.name)}
        {...(isBuiltIn(f) ? {} : drag(f.name))}
      >
        <Check size={14} aria-hidden="true" />
        {!home && f.name}
      </button>
    );
  });
}
