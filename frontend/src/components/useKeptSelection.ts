import { useLayoutEffect, useRef, type RefObject } from "react";

type Seen = Readonly<{ value: string; start: number; end: number }>;

const commonPrefix = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
};

/**
 * Keeps a focused text box's selection on the same text when its value changes from outside
 * (an answer inserted above the caret), instead of letting it jump to the end.
 * Returns `track`, to call whenever the visitor types or moves the caret.
 */
export function useKeptSelection(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  const seen = useRef<Seen>({ value, start: value.length, end: value.length });

  const track = () => {
    const el = ref.current;
    if (el) seen.current = { value: el.value, start: el.selectionStart, end: el.selectionEnd };
  };

  useLayoutEffect(() => {
    const el = ref.current;
    const last = seen.current;
    if (!el || last.value === value) return;
    if (document.activeElement === el) {
      const at = commonPrefix(last.value, value);
      const shift = value.length - last.value.length;
      const move = (n: number) => (n >= at ? Math.max(at, n + shift) : n);
      el.setSelectionRange(move(last.start), move(last.end));
    }
    seen.current = { value, start: el.selectionStart, end: el.selectionEnd };
  }, [ref, value]);

  return track;
}
