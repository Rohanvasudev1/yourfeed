import { useState } from "react";

/** Whether the open feed's Share panel is showing. Switching feeds closes it, as in the mockup. */
export function useShareToggle(feedName: string) {
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [lastFeed, setLastFeed] = useState(feedName);
  // Leaving a feed forgets its panel, so coming back doesn't reopen it.
  if (lastFeed !== feedName) {
    setLastFeed(feedName);
    setOpenFor(null);
  }
  const open = openFor === feedName;
  return {
    open,
    toggle: () => setOpenFor(open ? null : feedName),
    close: () => setOpenFor(null),
  };
}

export type ShareToggle = ReturnType<typeof useShareToggle>;
