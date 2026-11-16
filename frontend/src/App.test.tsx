import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CatalogLoader } from "./ports";
import { blockedStorage, CATALOG, EVERYTHING_ORDER, memoryStorage, rawLocalStorage } from "./test/fixtures";
import { feedTitles, renderApp, toggleFilters } from "./test/renderApp";

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

/** Shows clickbait under its bait title, so the change is visible in the feed. */
async function showClickbait() {
  await feedTitles();
  await toggleFilters("Hide clickbait", "Honest titles");
  expect(await feedTitles()).toContain(BAIT_TITLE);
}

describe("saving state in the browser", () => {
  it("keeps state across a reload", async () => {
    const storage = memoryStorage();
    const { unmount } = renderApp({ storage });
    await showClickbait();
    unmount();

    renderApp({ storage });
    expect(await feedTitles()).toContain(BAIT_TITLE);
  });

  it("Reset demo restores the starting example, and it stays reset after a reload", async () => {
    const storage = memoryStorage();
    const { unmount } = renderApp({ storage });
    await showClickbait();

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
