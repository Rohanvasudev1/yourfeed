import { IconLayoutGrid, IconList, type Icon } from "@tabler/icons-react";
import type { View } from "../state/appState";

type Props = Readonly<{ view: View; onChange: (view: View) => void }>;

const OPTIONS: readonly Readonly<{ view: View; label: string; icon: Icon }>[] = [
  { view: "list", label: "One per row", icon: IconList },
  { view: "grid", label: "Three per row", icon: IconLayoutGrid },
];

export function ViewToggle({ view, onChange }: Props) {
  return (
    <div className="seg" role="group" aria-label="Layout">
      {OPTIONS.map(({ view: option, label, icon: Icon }) => (
        <button
          key={option}
          type="button"
          className={option === view ? "on" : undefined}
          aria-label={label}
          title={label}
          aria-pressed={option === view}
          onClick={() => onChange(option)}
        >
          <Icon size={16} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
