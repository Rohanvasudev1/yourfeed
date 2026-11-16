import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EVERYTHING_ORDER, memoryStorage } from "./test/fixtures";
import { cardFor, feedTitles, renderApp } from "./test/renderApp";

const [FIRST, SECOND] = EVERYTHING_ORDER;

let open: ReturnType<typeof vi.fn>;

beforeEach(() => {
  open = vi.fn(() => ({}) as Window);
  vi.stubGlobal("open", open);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const watchingNow = () => screen.getByRole("region", { name: "Watching now" });

async function playByTitle(title: string) {
  const card = await cardFor(title);
  await userEvent.click(within(card).getByRole("button", { name: title }));
}

describe("opening a video", () => {
  it("opens a YouTube search for its title and channel in a new tab and shows it under Watching now", async () => {
    renderApp();
    await playByTitle(FIRST);

    expect(open).toHaveBeenCalledWith(
      "https://www.youtube.com/results?search_query=Agents%20with%20memory%20Agent%20Workshop",
      "_blank",
      "noopener",
    );
    expect(within(watchingNow()).getByText(FIRST)).toBeInTheDocument();
    expect(await feedTitles()).not.toContain(FIRST);
  });

  it("opens from the thumbnail too", async () => {
    renderApp();
    const card = await cardFor(FIRST);
    await userEvent.click(within(card).getByRole("button", { name: /^Play Agents with memory, \d+:\d\d$/ }));
    expect(within(watchingNow()).getByText(FIRST)).toBeInTheDocument();
  });

  it("says so when the browser blocks the new tab", async () => {
    open.mockReturnValue(null);
    renderApp();
    await playByTitle(FIRST);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your browser blocked the YouTube tab. Allow pop-ups for this page to open videos.",
    );
  });
});

const returnToPage = () => document.dispatchEvent(new Event("visibilitychange"));
const finishedButton = () => within(watchingNow()).getByRole("button", { name: "Finished" });
const finishedSection = () => screen.queryByRole("region", { name: "Finished" });

describe("finishing a video", () => {
  it("doesn't finish a video when you come back to the page, but turns the Finished button blue", async () => {
    renderApp();
    await playByTitle(FIRST);
    expect(finishedButton()).not.toHaveClass("primary");

    returnToPage();

    expect(await screen.findByRole("button", { name: "Finished" })).toHaveClass("primary");
    expect(within(watchingNow()).getByText(FIRST)).toBeInTheDocument();
    expect(finishedSection()).not.toBeInTheDocument();
  });

  it("finishes the current video when you start another", async () => {
    renderApp();
    await playByTitle(FIRST);
    await playByTitle(SECOND);

    expect(within(watchingNow()).getByText(SECOND)).toBeInTheDocument();
    expect(within(finishedSection()!).getByText(FIRST)).toBeInTheDocument();
  });

  it("finishes the current video with the Finished button", async () => {
    renderApp();
    await playByTitle(FIRST);
    await userEvent.click(finishedButton());

    expect(screen.queryByRole("region", { name: "Watching now" })).not.toBeInTheDocument();
    expect(within(finishedSection()!).getByText(FIRST)).toBeInTheDocument();
    expect(within(finishedSection()!).getByText("1 video · 20m")).toBeInTheDocument();
  });

  it("moves a Finished video back to Up next", async () => {
    renderApp();
    await playByTitle(FIRST);
    await userEvent.click(finishedButton());

    await userEvent.click(within(finishedSection()!).getByRole("button", { name: `Move ${FIRST} back to Up next` }));

    expect(finishedSection()).not.toBeInTheDocument();
    expect(await feedTitles()).toEqual(EVERYTHING_ORDER);
  });

  it("can collapse the Finished list from the keyboard", async () => {
    renderApp();
    await playByTitle(FIRST);
    await userEvent.click(finishedButton());
    const toggle = within(finishedSection()!).getByRole("button", { name: /Finished/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    toggle.focus();
    await userEvent.keyboard("{Enter}");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(finishedSection()!).queryByText(FIRST)).not.toBeInTheDocument();
  });

  it("keeps the session after a reload", async () => {
    const storage = memoryStorage();
    const { unmount } = renderApp({ storage });
    await playByTitle(FIRST);
    await playByTitle(SECOND);
    unmount();

    renderApp({ storage });
    await feedTitles();
    expect(within(watchingNow()).getByText(SECOND)).toBeInTheDocument();
    expect(within(finishedSection()!).getByText(FIRST)).toBeInTheDocument();
  });
});
