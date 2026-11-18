import { useState } from "react";
import { suggestFor, type Suggestion, type SuggestionCorpus } from "../../domain/search";

type Box = Readonly<{
  /** What's in the box: what was typed, or the highlighted suggestion. */
  text: string;
  /** What the visitor typed; suggestions are for this. */
  typed: string;
  open: boolean;
  /** Index of the highlighted suggestion, or -1 for none. */
  active: number;
}>;

const CLOSED: Box = { text: "", typed: "", open: false, active: -1 };

/** Steps through `count` suggestions and the typed text (-1), wrapping at both ends. */
const wrap = (active: number, step: 1 | -1, count: number) => ((active + step + 1 + count + 1) % (count + 1)) - 1;

/** The search box's text and its suggestion list, as a Google-style combobox. */
export function useSuggestions(corpus: SuggestionCorpus, recent: readonly string[]) {
  const [box, setBox] = useState<Box>(CLOSED);
  const items: readonly Suggestion[] = box.open ? suggestFor(corpus, recent, box.typed) : [];
  // Removing a recent search can leave the highlight past the end.
  const active = box.active < items.length ? box.active : -1;

  /** Arrows wrap through the list and back to what was typed, filling the box as they go. */
  const move = (step: 1 | -1) => {
    if (items.length === 0) return setBox((b) => ({ ...b, open: true, typed: b.text, active: -1 }));
    const next = wrap(active, step, items.length);
    setBox((b) => ({ ...b, active: next, text: next < 0 ? b.typed : items[next].phrase }));
  };

  return {
    text: box.text,
    typed: box.typed,
    items,
    active,
    /** The visitor typed, or voice search heard something: suggest for it. */
    type: (text: string) => setBox({ text, typed: text, open: true, active: -1 }),
    reopen: () => setBox((b) => ({ ...b, typed: b.text, open: true, active: -1 })),
    move,
    /** Closes the list, leaving the box's text. */
    close: () => setBox((b) => ({ ...b, open: false, active: -1 })),
    /** Esc: closes the list and puts back what was typed. */
    dismiss: () => setBox((b) => ({ ...b, text: b.typed, open: false, active: -1 })),
    /** After a recent search is removed, show the list for what was typed again. */
    unhighlight: () => setBox((b) => ({ ...b, text: b.typed, active: -1 })),
  };
}
