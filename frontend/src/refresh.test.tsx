import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BIG_CATALOG } from "./test/fixtures";
import { feedTitles, renderApp } from "./test/renderApp";

const loadBig = async () => BIG_CATALOG;
const logo = () => screen.getByRole("button", { name: "Yourfeed: load a new set of videos for this feed" });
const undoButton = () => screen.queryByRole("button", { name: "Bring back the previous set" });

describe("the logo loads a new set", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a set with nothing from the last one", async () => {
    renderApp({ loadCatalog: loadBig });
    const first = await feedTitles();
    expect(first).toHaveLength(4);

    await userEvent.click(logo());

    const second = await feedTitles();
    expect(second).toHaveLength(4);
    expect(second.filter((t) => first.includes(t))).toEqual([]);
  });

  it("starts over once nothing new is left", async () => {
    renderApp({ loadCatalog: loadBig });
    const seen = new Set(await feedTitles());
    await userEvent.click(logo());
    (await feedTitles()).forEach((t) => seen.add(t));
    await userEvent.click(logo());
    (await feedTitles()).forEach((t) => seen.add(t));
    expect(seen.size).toBe(12);

    await userEvent.click(logo());
    expect(await feedTitles()).toHaveLength(4);
  });

  it("can be undone from the round button", async () => {
    renderApp({ loadCatalog: loadBig });
    const first = await feedTitles();
    expect(undoButton()).not.toBeInTheDocument();
    await userEvent.click(logo());

    await userEvent.click(undoButton()!);

    expect(await feedTitles()).toEqual(first);
    expect(undoButton()).not.toBeInTheDocument();
  });

  it("offers undo for 5 seconds only", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp({ loadCatalog: loadBig });
    await feedTitles();
    await user.click(logo());

    act(() => vi.advanceTimersByTime(4900));
    expect(undoButton()).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    expect(undoButton()).not.toBeInTheDocument();
  });
});
