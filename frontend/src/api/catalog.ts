import type { Video } from "../domain/types";
import type { CatalogSource } from "../ports";

type Envelope<T> = { success: boolean; data: T | null; error: string | null };

const VIDEO_KEYS = ["id", "title", "honestTitle", "channel", "topic"] as const;

const isVideo = (x: unknown): x is Video =>
  typeof x === "object" &&
  x !== null &&
  VIDEO_KEYS.every((k) => typeof (x as Record<string, unknown>)[k] === "string") &&
  typeof (x as Record<string, unknown>).minutes === "number";

export async function fetchCatalog(source: CatalogSource = "demo"): Promise<readonly Video[]> {
  let res: Response;
  try {
    res = await fetch(`/api/catalog?source=${source}`);
  } catch (err) {
    console.error("Catalog request failed", err);
    throw new Error("Couldn't reach the Yourfeed server. Is the backend running?");
  }
  const body = (await res.json().catch(() => null)) as Envelope<unknown[]> | null;
  if (!body || !body.success || !Array.isArray(body.data)) {
    throw new Error(body?.error ?? `The server answered ${res.status}.`);
  }
  const videos = body.data.filter(isVideo);
  if (videos.length !== body.data.length) console.warn(`Dropped ${body.data.length - videos.length} malformed videos`);
  return videos;
}
