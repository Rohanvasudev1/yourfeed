import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Video } from "./domain/types";
import { CATALOG } from "./test/fixtures";
import { cardFor, feedTitles, renderApp } from "./test/renderApp";

const upNextLine = () => screen.getByRole("note", { name: "Session plan" });

beforeEach(() => {
  vi.stubGlobal("open", vi.fn(() => ({}) as Window));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Up next line", () => {
  it("counts Up next and the minutes planned for this sitting", async () => {
    renderApp();
    await feedTitles();
    expect(upNextLine()).toHaveTextContent("Up next · 3 videos · 1h session");
  });

  it("keeps counting the video you're watching toward the session", async () => {
    renderApp();
    await userEvent.click(await screen.findByRole("button", { name: "Agents with memory" }));
    expect(upNextLine()).toHaveTextContent("Up next · 2 videos · 1h session");
  });

  it("says how many videos a feed's rules hide", async () => {
    renderApp();
    await feedTitles();
    await userEvent.click(screen.getByRole("button", { name: "Learn" }));
    expect(upNextLine()).toHaveTextContent("Up next · 3 videos · 1h session · 1 hidden by your rules");
  });

  it("warns when the plan is short of the session minimum", async () => {
    const short: readonly Video[] = CATALOG.filter((v) => v.id === "demo-51");
    renderApp({ loadCatalog: async () => short });
    await feedTitles();
    await userEvent.click(screen.getByRole("button", { name: "Learn" }));
    await cardFor("Agents with memory");
    expect(upNextLine()).toHaveTextContent("Up next · 1 video · 20m session");
    expect(upNextLine()).toHaveTextContent("10m short of your minimum");
  });
});
