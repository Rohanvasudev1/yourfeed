import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { replyWith, scriptedAssistant } from "./test/assistant";
import { toSaved } from "./state/persistence";
import { DEMO_SEED } from "./state/seed";
import { BIG_CATALOG, EVERYTHING_ORDER, memoryStorage } from "./test/fixtures";
import { cardFor, feedTitles, renderApp, upNextList } from "./test/renderApp";

const [FIRST, SECOND] = EVERYTHING_ORDER;

beforeEach(() => {
  vi.stubGlobal("open", vi.fn(() => ({}) as Window));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const reasonOn = async (title: string) => within(await cardFor(title)).getByTitle("Why this is here").textContent?.replace("Why this is here: ", "");
const bar = () => screen.getByRole("textbox", { name: "Tell Claude what to change" });

async function play(title: string) {
  await userEvent.click(within(await cardFor(title)).getByRole("button", { name: title }));
}

describe("reasons on cards", () => {
  it("shows every card why it's there", async () => {
    renderApp();
    const cards = within(await upNextList()).getAllByRole("listitem");
    for (const card of cards) expect(within(card).getByTitle("Why this is here")).toHaveTextContent(/^Why this is here: \S/);
    expect(await reasonOn(FIRST)).toBe("New from Agent Workshop, which you follow");
    expect(await reasonOn(SECOND)).toBe("Because you watched an AI video");
  });

  it("says you added a pinned video yourself", async () => {
    renderApp();
    await userEvent.click(within(await cardFor(FIRST)).getByRole("button", { name: `Videos like ${FIRST}` }));
    const [add] = screen.getAllByRole("button", { name: /^Add .* to this session$/ });
    const title = add.getAttribute("aria-label")?.replace(/^Add (.*) to this session$/, "$1") ?? "";
    await userEvent.click(add);
    expect(await reasonOn(title)).toBe("You added this");
  });

  it('gives "why is this first?" the reason the first card shows', async () => {
    const assistant = scriptedAssistant(() => replyWith("ok"));
    renderApp({ assistant });
    const [top] = await feedTitles();
    await userEvent.type(bar(), "why is this first?{Enter}");
    await waitFor(() => expect(assistant.calls).toHaveLength(1));
    expect(assistant.calls[0].context.firstReason).toBe(await reasonOn(top));
  });

  it("puts Finished videos' topic first and says so", async () => {
    renderApp();
    await play(FIRST);
    await userEvent.click(screen.getByRole("button", { name: "Finished" }));
    expect(await reasonOn(SECOND)).toBe("Because you Finished an AI video");
  });
});

describe("skipped videos", () => {
  it("records Up next as skipped when you leave mid-session, so the next visit offers other videos", async () => {
    const storage = memoryStorage();
    const view = renderApp({ loadCatalog: async () => BIG_CATALOG, storage });
    const [first] = await feedTitles();
    await play(first);
    const passedOver = await feedTitles();
    act(() => void window.dispatchEvent(new Event("pagehide")));
    view.unmount();

    renderApp({ loadCatalog: async () => BIG_CATALOG, storage });
    const next = await feedTitles();
    expect(next.length).toBeGreaterThan(0);
    expect(next.filter((title) => passedOver.includes(title))).toEqual([]);
  });

  it("records what the logo passed over as skipped, and its undo forgets them", async () => {
    const logo = () => screen.getByRole("button", { name: "Yourfeed: load a new set of videos for this feed" });
    const skippedSaved = (storage: ReturnType<typeof memoryStorage>) => {
      const saved = storage.saved() as ReturnType<typeof toSaved>;
      return saved.state.feeds.find((f) => f.kind === "home")?.behaviour.filter((s) => s.kind === "skipped").length;
    };
    const kept = memoryStorage();
    const first = renderApp({ loadCatalog: async () => BIG_CATALOG, storage: kept });
    const shown = await feedTitles();
    await userEvent.click(logo());
    first.unmount();
    expect(skippedSaved(kept)).toBe(shown.length);

    const undone = memoryStorage();
    const second = renderApp({ loadCatalog: async () => BIG_CATALOG, storage: undone });
    await feedTitles();
    await userEvent.click(logo());
    await userEvent.click(screen.getByRole("button", { name: "Bring back the previous set" }));
    second.unmount();
    expect(skippedSaved(undone)).toBe(0);
  });

  it("records nothing when you leave before starting a session", async () => {
    const storage = memoryStorage();
    const view = renderApp({ loadCatalog: async () => BIG_CATALOG, storage });
    const shown = await feedTitles();
    act(() => void window.dispatchEvent(new Event("pagehide")));
    view.unmount();

    renderApp({ loadCatalog: async () => BIG_CATALOG, storage });
    expect(await feedTitles()).toEqual(shown);
  });
});

describe("saved behaviour", () => {
  const withBehaviour = (behaviour: unknown) => {
    const saved = toSaved(DEMO_SEED);
    const feeds = saved.state.feeds.map((f) => (f.kind === "home" ? { ...f, behaviour } : f));
    return memoryStorage({ ...saved, state: { ...saved.state, feeds, currentFeed: "Learn" } });
  };

  it("keeps an old save that has no behaviour", async () => {
    const saved = toSaved(DEMO_SEED);
    const feeds = saved.state.feeds.map((f) => Object.fromEntries(Object.entries(f).filter(([key]) => key !== "behaviour")));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderApp({ storage: memoryStorage({ ...saved, state: { ...saved.state, feeds, currentFeed: "Learn" } }) });
    expect(await reasonOn("Intro to transformers")).toBe("Matches AI in this feed");
    expect(warn).not.toHaveBeenCalled();
  });

  it("ignores a save whose behaviour isn't valid, starting from the demo", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderApp({ storage: withBehaviour([{ kind: "liked", video: "demo-0", at: 1 }]) });
    expect(await feedTitles()).toEqual(EVERYTHING_ORDER);
    expect(warn).toHaveBeenCalled();
  });
});
