import { IconShare } from "@tabler/icons-react";
import type { ShareToggle } from "../../state/useShareToggle";

/** The Up next line's Share button. It opens and closes the Share panel, and shows which. */
export function ShareButton({ toggle, panelId }: Readonly<{ toggle: ShareToggle; panelId: string }>) {
  return (
    <button
      type="button"
      className={toggle.open ? "text-button primary" : "text-button"}
      aria-expanded={toggle.open}
      aria-controls={toggle.open ? panelId : undefined}
      onClick={toggle.toggle}
    >
      <IconShare size={15} aria-hidden="true" />
      Share
    </button>
  );
}
