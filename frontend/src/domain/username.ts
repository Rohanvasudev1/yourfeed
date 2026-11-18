/** Yourfeed usernames, as Share and Blend ask for them. Demo mode only checks the shape. */
export const USERNAME_LENGTH = { min: 3, max: 20 } as const;

const USERNAME = new RegExp(`^[a-z0-9_.]{${USERNAME_LENGTH.min},${USERNAME_LENGTH.max}}$`, "i");

/** A typed username without the "@" people often add, and without surrounding spaces. */
export const cleanUsername = (typed: string): string => typed.trim().replace(/^@/, "");

/** Why `name` can't be sent to, in the visitor's words, or null when it can. `taken` names it already went to (any case). */
export function usernameProblem(name: string, taken: readonly string[]): string | null {
  if (!name) return "Type a username first";
  if (!USERNAME.test(name))
    return `Usernames are ${USERNAME_LENGTH.min}–${USERNAME_LENGTH.max} letters, numbers, dots or underscores`;
  if (taken.some((t) => t.toLowerCase() === name.toLowerCase())) return `Already sent to @${name}`;
  return null;
}
