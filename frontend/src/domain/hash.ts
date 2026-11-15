/** Stable string hash (same as the prototype) so a seed always gives the same order. */
export const hash = (text: string): number =>
  [...text].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
