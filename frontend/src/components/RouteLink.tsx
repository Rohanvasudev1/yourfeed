import type { MouseEvent, ReactNode } from "react";
import { navigate } from "../state/useRoute";

type Props = Readonly<{ to: string; className?: string; children: ReactNode }>;

/** Whether the browser should handle the click itself: a new tab or window, or not the main button. */
const opensElsewhere = (event: MouseEvent) => event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

/** A link to another page of the app that opens without a reload; modified clicks still open a new tab. */
export function RouteLink({ to, className, children }: Props) {
  return (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        if (opensElsewhere(event)) return;
        event.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
