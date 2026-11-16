/** A short message that clears itself: errors, no-ops and results the visitor can't see. */
export function Flash({ message }: Readonly<{ message: string | null }>) {
  return message ? (
    <p className="flash" role="alert">
      {message}
    </p>
  ) : null;
}
