import { useEffect, useMemo, useState } from "react";
import { fetchCatalog } from "./api/catalog";
import { composeFeed } from "./domain/compose";
import { makeFeed } from "./domain/feed";
import type { Video } from "./domain/types";

const LEARN = makeFeed({ topics: ["AI", "Programming", "Economics", "Careers"], length: [10, 60], session: [30, 90] });
const FILTERS = { hideClickbait: true, boostSmallCreators: true, includeShorts: false } as const;

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; catalog: readonly Video[] };

export default function App() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [seed, setSeed] = useState(0);

  useEffect(() => {
    fetchCatalog()
      .then((catalog) => setLoad({ state: "ready", catalog }))
      .catch((err: Error) => setLoad({ state: "error", message: err.message }));
  }, []);

  const result = useMemo(
    () =>
      load.state === "ready"
        ? composeFeed({ catalog: load.catalog, feed: { ...LEARN, seed }, filters: FILTERS, watched: [], topMaxAgeHours: 8760 })
        : null,
    [load, seed],
  );

  return (
    <main style={{ maxWidth: 720, margin: "32px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ cursor: "pointer" }} onClick={() => setSeed((s) => s + 1)} title="New set for this feed">
        Yourfeed
      </h1>
      {load.state === "loading" && <p>Loading…</p>}
      {load.state === "error" && <p role="alert">{load.message}</p>}
      {result && (
        <>
          <p>
            Learn · {result.upNext.length} videos · {result.usedMinutes} of 90 min · {result.hidden} hidden
          </p>
          <ol>
            {result.upNext.map((v) => (
              <li key={v.id}>
                {v.honestTitle} <small>· {v.channel} · {v.minutes} min · {v.topic}</small>
              </li>
            ))}
          </ol>
        </>
      )}
    </main>
  );
}
