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

const LABEL = "Why this is here: ";
/** The card's reason line: the element holding the visually hidden "Why this is here:" label. */
const reasonLine = (card: HTMLElement) => within(card).getByText(LABEL.trim()).parentElement!;
const reasonOn = async (title: string) => reasonLine(await cardFor(title)).textContent?.replace(LABEL, "");
const bar = () => screen.getByRole("textbox", { name: "Tell Claude what to change" });

async function play(title: string) {
  await userEvent.click(within(await cardFor(title)).getByRole("button", { name: title }));
}

describe("reasons on cards", () => {
  it("shows every card why it's there", async () => {
    renderApp();
    const cards = within(await upNextList()).getAllByRole("listitem");
    for (const card of cards) expect(reasonLine(card)).toHaveTextContent(/^Why this is here: \S/);
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

  it("records what the logo passed over mid-session, and its undo forgets it", async () => {
    const logo = () => screen.getByRole("button", { name: "Yourfeed: load a new set of videos for this feed" });
    const storage = memoryStorage();
    const first = renderApp({ loadCatalog: async () => BIG_CATALOG, storage });
    await play((await feedTitles())[0]);
    const shown = await feedTitles();
    await userEvent.click(logo());
    await userEvent.click(screen.getByRole("button", { name: "Bring back the previous set" }));
    first.unmount();

    // Undo forgot the skips, so the next visit shows the same Up next.
    renderApp({ loadCatalog: async () => BIG_CATALOG, storage });
    expect(await feedTitles()).toEqual(shown);
  });

  it("doesn't record skips when the logo is used before a session starts", async () => {
    const logo = () => screen.getByRole("button", { name: "Yourfeed: load a new set of videos for this feed" });
    const storage = memoryStorage();
    const first = renderApp({ loadCatalog: async () => BIG_CATALOG, storage });
    const shown = await feedTitles();
    await userEvent.click(logo());
    await userEvent.click(screen.getByRole("button", { name: "Bring back the previous set" }));
    first.unmount();
    renderApp({ loadCatalog: async () => BIG_CATALOG, storage });
    expect(await feedTitles()).toEqual(shown);
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
