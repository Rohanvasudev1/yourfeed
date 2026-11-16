import { useCallback, useEffect, useId, useRef, useState, type HTMLAttributes, type RefCallback } from "react";
import { useDismissal } from "./useDismissal";

/** Hover delay before a popup opens, so passing the pointer over a phrase doesn't flash one. */
export const POPUP_OPEN_MS = 120;
/** Grace period after the pointer leaves, long enough to cross the gap into the popup. */
export const POPUP_CLOSE_MS = 220;

type Open<K> = Readonly<{ key: K | null; pinned: boolean }>;
const CLOSED: Open<never> = { key: null, pinned: false };

type TriggerProps = Pick<
  HTMLAttributes<HTMLElement>,
  "onMouseEnter" | "onMouseLeave" | "onClick" | "aria-haspopup" | "aria-expanded" | "aria-controls"
> & { ref: RefCallback<HTMLElement> };

type PopupProps = Pick<HTMLAttributes<HTMLElement>, "id" | "role" | "onMouseEnter" | "onMouseLeave" | "onFocus"> & {
  ref: RefCallback<HTMLElement>;
};

/**
 * One shared hover/click popup controller: at most one popup is open. Hovering a trigger opens
 * its popup after POPUP_OPEN_MS; leaving both closes it after POPUP_CLOSE_MS. Clicking a trigger
 * (or moving focus into the popup) pins it open. Escape, a click outside and focus moving
 * elsewhere close it; Escape on a pinned popup returns focus to its trigger.
 */
export function usePopupController<K extends string>() {
  const [open, setOpen] = useState<Open<K>>(CLOSED);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const triggers = useRef(new Map<K, HTMLElement>());
  const popup = useRef<HTMLElement | null>(null);
  const overPopup = useRef(false);
  const idPrefix = useId();

  const clearTimer = () => clearTimeout(timer.current);
  const close = useCallback(() => {
    clearTimeout(timer.current);
    overPopup.current = false;
    setOpen(CLOSED);
  }, []);

  const closeSoon = () => {
    clearTimer();
    timer.current = setTimeout(() => {
      const focusInside = popup.current?.contains(document.activeElement) ?? false;
      if (overPopup.current || focusInside) return;
      setOpen((o) => (o.pinned ? o : CLOSED));
    }, POPUP_CLOSE_MS);
  };

  useEffect(() => clearTimer, []);
  useDismissal(
    open.key !== null,
    (target) => isInside(target, popup.current, triggers.current),
    (reason) => {
      // Escape on a popup the pointer merely opened shouldn't pull focus from wherever it is.
      const focusInside = popup.current?.contains(document.activeElement) ?? false;
      if (reason === "escape" && open.key && (open.pinned || focusInside)) triggers.current.get(open.key)?.focus();
      close();
    },
  );

  const popupId = (key: K) => `${idPrefix}-${key}`;

  const trigger = (key: K): TriggerProps => ({
    ref: (el) => {
      if (el) triggers.current.set(key, el);
      else triggers.current.delete(key);
    },
    onMouseEnter: () => {
      clearTimer();
      if (open.key === key) return;
      timer.current = setTimeout(() => setOpen({ key, pinned: false }), POPUP_OPEN_MS);
    },
    onMouseLeave: closeSoon,
    onClick: () => {
      clearTimer();
      if (open.key === key && open.pinned) close();
      else setOpen({ key, pinned: true });
    },
    "aria-haspopup": "dialog",
    "aria-expanded": open.key === key,
    "aria-controls": open.key === key ? popupId(key) : undefined,
  });

  const popupProps = (key: K): PopupProps => ({
    ref: (el) => {
      popup.current = el;
    },
    id: popupId(key),
    role: "dialog",
    onMouseEnter: () => {
      overPopup.current = true;
      clearTimer();
    },
    onMouseLeave: () => {
      overPopup.current = false;
      closeSoon();
    },
    onFocus: () => setOpen((o) => (o.key === key ? { key, pinned: true } : o)),
  });

  return { openKey: open.key, trigger, popup: popupProps };
}

function isInside(target: EventTarget | null, popup: HTMLElement | null, triggers: ReadonlyMap<string, HTMLElement>): boolean {
  if (!(target instanceof Node)) return false;
  return (popup?.contains(target) ?? false) || [...triggers.values()].some((t) => t.contains(target));
}
