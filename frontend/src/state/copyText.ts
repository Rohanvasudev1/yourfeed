/** What to tell the visitor after trying to copy something. */
export type CopyMessages = Readonly<{ copied: string; noClipboard: string; failed: string }>;

/** Copies `text` to the clipboard and reports the outcome through `show`; failures are logged for debugging. */
export function copyText(text: string, messages: CopyMessages, show: (message: string) => void): void {
  if (!navigator.clipboard) return show(messages.noClipboard);
  navigator.clipboard.writeText(text).then(
    () => show(messages.copied),
    (error: unknown) => {
      console.warn("Copying to the clipboard failed", error);
      show(messages.failed);
    },
  );
}
