import { describe, expect, it } from "vitest";
import { makeFeed } from "./feed";
import { appendLine, followUpsOf, newLine, setLive, summarizeChange } from "./recipeLog";

const line = (request: string) => newLine(request, "no change");

describe("the recipe log", () => {
  it("keeps the newest 20 lines", () => {
    const log = Array.from({ length: 22 }, (_, i) => `request ${i + 1}`).reduce((l, r) => appendLine(l, line(r)), appendLine([], line("first")));
    expect(log).toHaveLength(20);
    expect(log[0].request).toBe("request 3");
    expect(log.at(-1)?.request).toBe("request 22");
  });

  it("greys out and restores one line, and leaves the log alone for a line that's gone", () => {
    const one = line("one");
    const log = appendLine(appendLine([], one), line("two"));
    const greyed = setLive(log, one.id, false);
    expect(greyed.map((l) => l.live)).toEqual([false, true]);
    expect(followUpsOf(greyed)).toEqual([{ request: "two", summary: "no change" }]);
    expect(setLive(greyed, one.id, true)).toEqual(log);
    expect(setLive(log, "cleared-long-ago", false)).toBe(log);
  });

  it("cuts long requests, summaries and replies to what the backend accepts", () => {
    const long = newLine("x".repeat(400), "y".repeat(200), "z".repeat(400));
    expect(long.request.length).toBe(300);
    expect(long.summary.length).toBe(120);
    expect(long.reply?.length).toBe(200);
    expect(newLine("hi", "no change", "  ")).not.toHaveProperty("reply");
  });

  it("says in a few words what a request changed", () => {
    const before = makeFeed({ topics: ["AI", "Careers"], length: [10, 60], session: [30, 90] });
    const after = { ...before, topics: ["AI", "Cooking"], muted: ["News"], length: [10, 30] as const, session: [20, 40] as const, pinned: ["demo-1"] };
    expect(summarizeChange(before, after)).toBe("added Cooking · removed Careers · muted News · videos 10–30 min · sessions 20–40 min · put a video first");
    expect(summarizeChange(before, before)).toBe("no change");
  });
});
