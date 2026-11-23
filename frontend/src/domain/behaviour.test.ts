import { describe, expect, it } from "vitest";
import { BEHAVIOUR_DAYS, BEHAVIOUR_LIMIT, forgetSignals, recordSignals, resolveBehaviour } from "./behaviour";
import { MS_PER_HOUR } from "./time";
import type { Video } from "./types";

const DAY_MS = 24 * MS_PER_HOUR;
const NOW = 1_800_000_000_000;

describe("behaviour record", () => {
  it("timestamps each signal and drops ones older than 30 days", () => {
    const old = recordSignals([], "finished", ["a"], NOW - (BEHAVIOUR_DAYS + 1) * DAY_MS);
    const record = recordSignals(old, "pinned", ["b"], NOW);
    expect(record).toEqual([{ kind: "pinned", video: "b", at: NOW }]);
  });

  it("records a video skipped at most once a day", () => {
    const once = recordSignals([], "skipped", ["a", "b"], NOW);
    const again = recordSignals(once, "skipped", ["a", "c"], NOW + MS_PER_HOUR);
    expect(again.map((s) => s.video)).toEqual(["a", "b", "c"]);
    expect(recordSignals(again, "skipped", ["a"], NOW + DAY_MS + 1).filter((s) => s.video === "a")).toHaveLength(2);
  });

  it("keeps the newest signals when it grows past its limit", () => {
    const many = Array.from({ length: BEHAVIOUR_LIMIT + 5 }, (_, i) => `v${i}`);
    const record = recordSignals([], "watched", many, NOW);
    expect(record).toHaveLength(BEHAVIOUR_LIMIT);
    expect(record.at(-1)?.video).toBe(`v${BEHAVIOUR_LIMIT + 4}`);
  });

  it("forgets one kind of signal for a video, or the signals of one moment", () => {
    const record = [
      ...recordSignals([], "watched", ["a", "b"], NOW),
      ...recordSignals([], "skipped", ["c"], NOW + 1),
    ];
    expect(forgetSignals(record, { kinds: ["watched"], video: "a" }).map((s) => s.video)).toEqual(["b", "c"]);
    expect(forgetSignals(record, { kinds: ["skipped"], at: NOW + 1 }).map((s) => s.video)).toEqual(["a", "b"]);
  });

  it("resolves signals against the catalog, dropping videos it doesn't have", () => {
    const a = { id: "a", topic: "AI" } as Video;
    const record = recordSignals([], "finished", ["a", "gone"], NOW);
    expect(resolveBehaviour(record, new Map([["a", a]]))).toEqual([{ kind: "finished", video: a, at: NOW }]);
  });
});
