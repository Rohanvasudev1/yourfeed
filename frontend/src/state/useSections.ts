import { useEffect, useState } from "react";

/** The collapsed sections at the bottom of a feed page that the account menu can jump to. */
export const SECTIONS = ["saved", "history", "notes"] as const;
export type SectionKey = (typeof SECTIONS)[number];

/** The id of a section's toggle button, which a jump scrolls to and focuses. */
export const sectionToggleId = (key: SectionKey) => `section-toggle-${key}`;

/** Which sections are open, kept above the page so the account menu can open one and move focus to it. */
export function useSections() {
  const [open, setOpen] = useState<ReadonlySet<SectionKey>>(() => new Set());
  // A new object each jump, so jumping to the same section twice still scrolls to it.
  const [target, setTarget] = useState<Readonly<{ key: SectionKey }> | null>(null);

  useEffect(() => {
    if (!target) return;
    const toggle = document.getElementById(sectionToggleId(target.key));
    toggle?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    toggle?.focus({ preventScroll: true });
  }, [target]);

  return {
    isOpen: (key: SectionKey) => open.has(key),
    toggle: (key: SectionKey) => setOpen((o) => (o.has(key) ? new Set([...o].filter((k) => k !== key)) : new Set([...o, key]))),
    jump: (key: SectionKey) => {
      setOpen((o) => new Set([...o, key]));
      setTarget({ key });
    },
  };
}

export type Sections = ReturnType<typeof useSections>;

/** What a collapsible section needs to be opened from outside. */
export type SectionControl = Readonly<{ open: boolean; onToggle: () => void; toggleId: string }>;

export const sectionControl = (sections: Sections, key: SectionKey): SectionControl => ({
  open: sections.isOpen(key),
  onToggle: () => sections.toggle(key),
  toggleId: sectionToggleId(key),
});
