import { hash } from "./hash";

/** murmur3 finalizer: spreads small input changes (like seed 0 → 1) across all bits. */
const mix = (n: number): number => {
  let h = n >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};

/** A stable pseudo-random rank for a video under a seed. */
export const seededRank = (id: string, seed: number): number => mix(hash(id) ^ mix(seed + 1));
