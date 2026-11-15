import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import type { CatalogLoader, StateStorage } from "./ports";
import { blockedStorage, CATALOG, EVERYTHING_ORDER, memoryStorage, rawLocalStorage } from "./test/fixtures";

type Setup = { loadCatalog?: CatalogLoader; storage?: StateStorage };

function renderApp({ loadCatalog = async () => CATALOG, storage = memoryStorage() }: Setup = {}) {
  return render(<App loadCatalog={loadCatalog} storage={storage} />);
}

async function feedTitles(): Promise<string[]> {
  const feed = await screen.findByRole("list", { name: "Up next" });
  return within(feed)
    .getAllByRole("heading", { level: 3 })
    .map((h) => h.textContent ?? "");
}

describe("opening the app", () => {
  it("opens on Everything, ranked by what you watch, without watched or clickbait videos", async () => {
    renderApp();
    expect(screen.getByRole("heading", { name: "Everything" })).toBeInTheDocument();
    expect(await feedTitles()).toEqual(EVERYTHING_ORDER);
  });
});

describe("when the catalog can't load", () => {
  it("shows the error and a Retry button that recovers", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const loadCatalog = vi
      .fn<CatalogLoader>()
      .mockRejectedValueOnce(new Error("Couldn't reach the Yourfeed server. Is the backend running?"))
      .mockResolvedValue(CATALOG);
    renderApp({ loadCatalog });

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the Yourfeed server");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await feedTitles()).toEqual(EVERYTHING_ORDER);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

const BAIT_TITLE = "YOU WON'T BELIEVE this AI trick";

type Saved = { state: { filters: Record<string, boolean> } };

/**
 * What the app saves on a first visit, edited to show clickbait with honest titles off.
 * This reads the saved shape only because no filter controls exist yet; switch it to
 * clicking the filters popup once that lands.
 */
async function savedWithClickbaitShown(): Promise<Saved> {
  const storage = memoryStorage();
  const { unmount } = renderApp({ storage });
  await feedTitles();
  unmount();
  const saved = storage.saved() as Saved;
  return {
    ...saved,
    state: { ...saved.state, filters: { ...saved.state.filters, hideClickbait: false, honestTitles: false } },
  };
}

describe("saving state in the browser", () => {
  it("keeps state across a reload", async () => {
    const storage = memoryStorage(await savedWithClickbaitShown());
    renderApp({ storage }).unmount();

    renderApp({ storage });
    expect(await feedTitles()).toContain(BAIT_TITLE);
  });

  it("Reset demo restores the starting example, and it stays reset after a reload", async () => {
    const storage = memoryStorage(await savedWithClickbaitShown());
    const { unmount } = renderApp({ storage });
    expect(await feedTitles()).toContain(BAIT_TITLE);

    await userEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(await feedTitles()).toEqual(EVERYTHING_ORDER);

    unmount();
    renderApp({ storage });
    expect(await feedTitles()).toEqual(EVERYTHING_ORDER);
  });

  it.each([
    ["not valid JSON", rawLocalStorage("{oops")],
    ["from an old version", memoryStorage({ version: 0, state: {} })],
    ["missing fields", memoryStorage({ version: 1, state: { feeds: [] } })],
  ])("falls back to the starting example with a warning when saved state is %s", async (_, storage) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderApp({ storage });

    expect(await feedTitles()).toEqual(EVERYTHING_ORDER);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("saved state"), expect.anything());
  });

  it("still works in memory when browser storage is blocked", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { unmount } = renderApp({ storage: blockedStorage() });

    expect(await feedTitles()).toEqual(EVERYTHING_ORDER);
    await userEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(await feedTitles()).toEqual(EVERYTHING_ORDER);
    expect(() => unmount()).not.toThrow();
  });
});
