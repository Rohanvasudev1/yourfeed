import { useEffect, useRef } from "react";

export type DismissReason = "escape" | "outside";

/**
 * While `active`, calls `onDismiss("escape")` on Escape and `onDismiss("outside")` when a
 * pointer press or focus lands on something `inside` rejects.
 */
export function useDismissal(
  active: boolean,
  inside: (target: EventTarget | null) => boolean,
  onDismiss: (reason: DismissReason) => void,
) {
  const latest = useRef({ inside, onDismiss });
  useEffect(() => {
    latest.current = { inside, onDismiss };
  });

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") latest.current.onDismiss("escape");
    };
    const onOutside = (e: Event) => {
      if (!latest.current.inside(e.target)) latest.current.onDismiss("outside");
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("focusin", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("focusin", onOutside);
    };
  }, [active]);
}
