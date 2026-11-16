/** How long a flash message stays up. */
export const FLASH_MS = 5000;

/** A short message that clears itself: errors, no-ops and results the visitor can't see. */
export function Flash({ message }: Readonly<{ message: string | null }>) {
  return message ? (
    <p className="flash" role="alert">
      {message}
    </p>
  ) : null;
}
