type Props = Readonly<{ message: string; onRetry: () => void }>;

export function CatalogError({ message, onRetry }: Props) {
  return (
    <div className="catalog-error">
      <p role="alert">{message}</p>
      <button type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
