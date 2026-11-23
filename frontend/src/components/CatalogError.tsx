import type { ReactNode } from "react";

type Props = Readonly<{ message: string; onRetry: () => void; retryLabel?: string; children?: ReactNode }>;

/** An error with a button that tries again; `children` adds other ways out. */
export function CatalogError({ message, onRetry, retryLabel = "Retry", children }: Props) {
  return (
    <div className="catalog-error">
      <p role="alert">{message}</p>
      <button type="button" onClick={onRetry}>
        {retryLabel}
      </button>
      {children}
    </div>
  );
}
