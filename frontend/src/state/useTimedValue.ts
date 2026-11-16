import { useCallback, useEffect, useRef, useState } from "react";

/** A value that clears itself `ms` after it was last set, like a toast or a short-lived undo. */
export function useTimedValue<T>(ms: number): readonly [T | null, (value: T) => void, () => void] {
  const [value, setValue] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    setValue(null);
  }, []);

  const show = useCallback(
    (next: T) => {
      clearTimeout(timer.current);
      setValue(next);
      timer.current = setTimeout(() => setValue(null), ms);
    },
    [ms],
  );

  useEffect(() => () => clearTimeout(timer.current), []);
  return [value, show, clear] as const;
}
