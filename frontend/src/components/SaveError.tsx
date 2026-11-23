import { ACCOUNT_TEXT } from "../domain/account";

/** A save to the visitor's account that failed. It stays until a save works: the next change, or the button, tries again. */
export function SaveError({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <div className="catalog-error">
      <p role="alert">{ACCOUNT_TEXT.saveFailed}</p>
      <button type="button" onClick={onRetry}>
        {ACCOUNT_TEXT.retrySave}
      </button>
    </div>
  );
}
