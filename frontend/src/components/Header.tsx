import { IconAdjustmentsHorizontal } from "@tabler/icons-react";

export function Header() {
  return (
    <header className="app-header">
      <p className="logo">
        <IconAdjustmentsHorizontal size={20} aria-hidden="true" />
        <span>Yourfeed</span>
      </p>
    </header>
  );
}
