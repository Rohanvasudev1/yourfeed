import { useEffect, useRef, useState } from "react";
import { INK_WORD_MS, oneLine } from "../domain/askNotes";

/** How long the last word of a new answer takes to ink in. */
const INK_MS = 500;
const NONE: readonly string[] = [];

/** Answers just inserted, per video, kept only while they ink in word by word (so they animate once). */
export function useInking() {
  const [inking, setInking] = useState<Readonly<Record<string, readonly string[]>>>({});
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const inkIn = (video: string, answer: string) => {
    const line = oneLine(answer);
    setInking((m) => ({ ...m, [video]: [...(m[video] ?? NONE), line] }));
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setInking((m) => ({ ...m, [video]: (m[video] ?? NONE).filter((x) => x !== line) }));
    }, line.split(/\s+/).length * INK_WORD_MS + INK_MS);
    timers.current.add(timer);
  };

  return { inkingFor: (video: string) => inking[video] ?? NONE, inkIn };
}
