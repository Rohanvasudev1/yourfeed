import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BehaviourRecord } from "./domain/behaviour";
import type { Video } from "./domain/types";
import { toSaved } from "./state/persistence";
import { DEMO_SEED } from "./state/seed";
import { BIG_CATALOG, CATALOG, memoryStorage } from "./test/fixtures";
import { cardFor, feedTitles, renderApp, settingsLine } from "./test/renderApp";

afterEach(() => {
  vi.restoreAllMocks();
});

const DAY_MS = 24 * 60 * 60 * 1000;

const long = (id: string): Video => ({ ...CATALOG[2], id, title: `Long talk ${id}`, minutes: 90 });
/** Learn's catalog: the fixture plus three 90-minute AI talks, outside Learn's 10–60 min. */
const LONG_CATALOG: readonly Video[] = [...CATALOG, long("long-1"), long("long-2"), long("long-3")];
const finishedLong = (daysAgo: number): BehaviourRecord =>
  ["long-1", "long-2", "long-3"].map((video) => ({ kind: "finished", video, at: Date.now() - daysAgo * DAY_MS }));
const removedGardening = (): BehaviourRecord => BIG_CATALOG.slice(0, 3).map((v) => ({ kind: "removed", video: v.id, at: Date.now() - DAY_MS }));

/** Saved demo state with Learn open and `behaviour` (and any `dismissed`) on it. */
function learnWith(behaviour: BehaviourRecord, dismissed: unknown = []) {
  const saved = toSaved(DEMO_SEED);
  const feeds = saved.state.feeds.map((f) => (f.name === "Learn" ? { ...f, behaviour, dismissed } : f));
  return memoryStorage({ ...saved, state: { ...saved.state, feeds, currentFeed: "Learn" } });
}

const renderLearn = (storage: ReturnType<typeof learnWith>) => renderApp({ loadCatalog: async () => [...LONG_CATALOG, ...BIG_CATALOG], storage });

const card = () => screen.findByRole("region", { name: "Recipe mirror" });
const noCard = () => expect(screen.queryByRole("region", { name: "Recipe mirror" })).not.toBeInTheDocument();
const line = () => (settingsLine().textContent ?? "").replace(/\s+/g, " ");

describe("the recipe mirror", () => {
  it("proposes a change when you keep removing one topic's videos", async () => {
    renderApp({ loadCatalog: async () => BIG_CATALOG });
    for (const title of (await feedTitles()).slice(0, 3)) {
      await userEvent.click(within(await cardFor(title)).getByRole("button", { name: `Remove ${title} from this session` }));
    }
    expect(await card()).toHaveTextContent("You removed 3 Gardening videos from this feed.");
    expect(within(await card()).getByRole("button", { name: "Mute Gardening" })).toBeInTheDocument();
  });

  it("shows nothing after only two", async () => {
    renderApp({ loadCatalog: async () => BIG_CATALOG });
    for (const title of (await feedTitles()).slice(0, 2)) {
      await userEvent.click(within(await cardFor(title)).getByRole("button", { name: `Remove ${title} from this session` }));
    }
    noCard();
  });

  it("applies an accepted proposal as one undo step, with a recipe log line", async () => {
    renderLearn(learnWith(finishedLong(1)));
    const proposal = await card();
    expect(proposal).toHaveTextContent("You Finished 3 videos longer than 60 min, but this feed is 10–60 min.");
    expect(line()).toContain("10–60 min videos");

    await userEvent.click(within(proposal).getByRole("button", { name: "Widen to 10–90 min" }));
    expect(line()).toContain("10–90 min videos");
    noCard();
    expect(within(screen.getByRole("region", { name: "Recipe log" })).getByRole("listitem")).toHaveTextContent(
      "Recipe mirror: Widen to 10–90 min → videos 10–90 min",
    );

    await userEvent.click(screen.getByRole("button", { name: /^Undo/ }));
    expect(line()).toContain("10–60 min videos");
    // Undo takes the change back, not the answer: the card doesn't return this visit.
    noCard();
  });

  it("can be accepted from the keyboard", async () => {
    renderLearn(learnWith(finishedLong(1)));
    within(await card()).getByRole("button", { name: "Widen to 10–90 min" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(line()).toContain("10–90 min videos");
  });

  it("ignores behaviour older than 14 days", async () => {
    renderLearn(learnWith(finishedLong(15)));
    await feedTitles();
    noCard();
  });

  it("hides a dismissed proposal for 7 days, across visits", async () => {
    const storage = learnWith(finishedLong(1));
    const first = renderLearn(storage);
    await userEvent.click(within(await card()).getByRole("button", { name: "Dismiss" }));
    noCard();
    expect(line()).toContain("10–60 min videos");
    first.unmount();

    const second = renderLearn(storage);
    await feedTitles();
    noCard();
    second.unmount();

    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 7 * DAY_MS);
    renderLearn(storage);
    expect(await card()).toHaveTextContent("You Finished 3 videos");
  });

  it("shows at most one proposal per feed per visit", async () => {
    const storage = learnWith([...finishedLong(1), ...removedGardening()]);
    const first = renderLearn(storage);
    await userEvent.click(within(await card()).getByRole("button", { name: "Dismiss" }));
    // Removing Gardening still disagrees with the recipe, but this visit already had its proposal.
    noCard();
    first.unmount();

    renderLearn(storage);
    expect(await card()).toHaveTextContent("You removed 3 Gardening videos from this feed.");
  });

  it("keeps an old save that has no dismissals", async () => {
    const saved = learnWith(finishedLong(1)).saved() as ReturnType<typeof toSaved>;
    const feeds = saved.state.feeds.map((f) => Object.fromEntries(Object.entries(f).filter(([key]) => key !== "dismissed")));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderLearn(memoryStorage({ ...saved, state: { ...saved.state, feeds } }));
    expect(await card()).toHaveTextContent("You Finished 3 videos");
    expect(warn).not.toHaveBeenCalled();
  });

  it("ignores a save whose dismissals aren't valid, starting from the demo", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderLearn(learnWith(finishedLong(1), [{ proposal: "", at: -1 }]));
    await feedTitles();
    expect(screen.getAllByRole("heading", { level: 2 })[0]).toHaveTextContent("Everything");
    expect(warn).toHaveBeenCalled();
  });
});
