import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EVERYTHING_ORDER, memoryStorage } from "./test/fixtures";
import { cardFor, feedTitles, renderApp, upNextList } from "./test/renderApp";

const [FIRST, SECOND] = EVERYTHING_ORDER;
/** In the seed's Watch later folder and its watch history. */
const SEEDED = "Already watched agent build";

beforeEach(() => {
  vi.stubGlobal(
    "open",
    vi.fn(() => ({}) as Window),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const savedSection = () => screen.getByRole("region", { name: "Saved" });
const historySection = () => screen.getByRole("region", { name: "Watch history" });

async function openSection(name: "Saved" | "Watch history") {
  const section = screen.getByRole("region", { name });
  const toggle = within(section).getByRole("button", { name: new RegExp(`^${name}`) });
  if (toggle.getAttribute("aria-expanded") === "false") await userEvent.click(toggle);
  return section;
}

async function openFolder(name: string) {
  const section = await openSection("Saved");
  const toggle = within(section).getByRole("button", { name: new RegExp(`^${name}`) });
  if (toggle.getAttribute("aria-expanded") === "false") await userEvent.click(toggle);
  return within(section).getByRole("list", { name });
}

async function saveTo(title: string, folder: string) {
  const card = await cardFor(title);
  await userEvent.click(within(card).getByRole("button", { name: `Save ${title}` }));
  await userEvent.click(within(within(card).getByRole("group", { name: "Save to" })).getByRole("button", { name: folder }));
}

const titlesIn = (list: HTMLElement) =>
  within(list)
    .queryAllByRole("heading", { level: 3 })
    .map((h) => h.textContent);

describe("saving a video", () => {
  it("puts it in the chosen folder, and it is still there after a reload", async () => {
    const storage = memoryStorage();
    const { unmount } = renderApp({ storage });
    await saveTo(FIRST, "Weekend");
    expect(titlesIn(await openFolder("Weekend"))).toEqual([FIRST]);

    unmount();
    renderApp({ storage });
    await feedTitles();
    expect(titlesIn(await openFolder("Weekend"))).toEqual([FIRST]);
  });

  it('says "Already in Weekend." when it is saved there twice', async () => {
    renderApp();
    await saveTo(FIRST, "Weekend");
    await saveTo(FIRST, "Weekend");
    expect(within(await cardFor(FIRST)).getByRole("status")).toHaveTextContent("Already in Weekend.");
    expect(titlesIn(await openFolder("Weekend"))).toEqual([FIRST]);
  });

  it("can go into a new folder made from the card", async () => {
    renderApp();
    const card = await cardFor(FIRST);
    await userEvent.click(within(card).getByRole("button", { name: `Save ${FIRST}` }));
    await userEvent.click(within(card).getByRole("button", { name: "New folder" }));
    await userEvent.type(within(card).getByRole("textbox", { name: "Folder name" }), "Agents{Enter}");
    expect(titlesIn(await openFolder("Agents"))).toEqual([FIRST]);
  });

  it("works from the keyboard", async () => {
    renderApp();
    const card = await cardFor(FIRST);
    within(card).getByRole("button", { name: `Save ${FIRST}` }).focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.tab();
    expect(document.activeElement).toHaveAccessibleName("Watch later");
    await userEvent.keyboard("{Enter}");
    expect(titlesIn(await openFolder("Watch later"))).toEqual([SEEDED, FIRST]);
  });
});

describe("the Saved section", () => {
  it("starts collapsed and opens to show folders that open and close", async () => {
    renderApp();
    await feedTitles();
    const toggle = within(savedSection()).getByRole("button", { name: /^Saved/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(savedSection()).queryByRole("button", { name: /^Weekend/ })).not.toBeInTheDocument();

    await userEvent.click(toggle);
    const watchLater = within(savedSection()).getByRole("button", { name: /^Watch later/ });
    expect(watchLater).toHaveAttribute("aria-expanded", "true");
    expect(titlesIn(within(savedSection()).getByRole("list", { name: "Watch later" }))).toEqual([SEEDED]);

    await userEvent.click(watchLater);
    expect(within(savedSection()).queryByRole("list", { name: "Watch later" })).not.toBeInTheDocument();
  });

  it("makes a new, empty folder and refuses a blank or repeated name", async () => {
    renderApp();
    await feedTitles();
    const section = await openSection("Saved");
    await userEvent.click(within(section).getByRole("button", { name: "New folder" }));
    const name = within(section).getByRole("textbox", { name: "Folder name" });

    await userEvent.click(within(section).getByRole("button", { name: "Create folder" }));
    expect(within(section).getByRole("alert")).toHaveTextContent("Name the folder first");

    await userEvent.type(name, "weekend{Enter}");
    expect(within(section).getByRole("alert")).toHaveTextContent("You already have a folder with that name");

    await userEvent.clear(name);
    await userEvent.type(name, "Someday{Enter}");
    expect(within(section).getByRole("list", { name: "Someday" })).toHaveTextContent("Empty. Use Save on any video to add one.");
  });

  it("removes a video from a folder", async () => {
    renderApp();
    await feedTitles();
    const list = await openFolder("Watch later");
    await userEvent.click(within(list).getByRole("button", { name: `Remove ${SEEDED} from Watch later` }));
    expect(titlesIn(await openFolder("Watch later"))).toEqual([]);
  });

  it("+ adds a saved video to the session, first in Up next", async () => {
    renderApp();
    await feedTitles();
    const list = await openFolder("Watch later");
    await userEvent.click(within(list).getByRole("button", { name: `Add ${SEEDED} to this session` }));

    expect((await feedTitles())[0]).toBe(SEEDED);
    expect(within(await upNextList()).getAllByRole("heading", { level: 3 })).toHaveLength(EVERYTHING_ORDER.length + 1);
    expect(screen.getByRole("note", { name: "Session plan" })).toHaveTextContent("Up next · 4 videos");
    expect(within(list).getByText("In this session")).toBeInTheDocument();
    expect(within(list).queryByRole("button", { name: `Add ${SEEDED} to this session` })).not.toBeInTheDocument();
  });
});

describe("Watch history", () => {
  it("starts collapsed and lists watched videos, newest first", async () => {
    renderApp();
    await userEvent.click(within(await cardFor(FIRST)).getByRole("button", { name: FIRST }));
    const toggle = within(historySection()).getByRole("button", { name: /^Watch history/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(toggle);
    expect(titlesIn(historySection())).toEqual([FIRST, SEEDED]);
  });

  it("removes one video", async () => {
    renderApp();
    await feedTitles();
    const section = await openSection("Watch history");
    await userEvent.click(within(section).getByRole("button", { name: `Remove ${SEEDED} from watch history` }));
    expect(within(section).getByText("Nothing here yet. Videos you watch will show up here.")).toBeInTheDocument();
  });

  it("asks before clearing all of it", async () => {
    renderApp();
    await userEvent.click(within(await cardFor(SECOND)).getByRole("button", { name: SECOND }));
    const section = await openSection("Watch history");

    await userEvent.click(within(section).getByRole("button", { name: "Clear watch history" }));
    await userEvent.click(within(section).getByRole("button", { name: "Cancel" }));
    expect(titlesIn(section)).toEqual([SECOND, SEEDED]);

    await userEvent.click(within(section).getByRole("button", { name: "Clear watch history" }));
    expect(within(section).getByText("Clear all history?")).toBeInTheDocument();
    await userEvent.click(within(section).getByRole("button", { name: "Clear" }));
    expect(titlesIn(section)).toEqual([]);
  });

  it("+ adds a history video to the session", async () => {
    renderApp();
    await feedTitles();
    const section = await openSection("Watch history");
    await userEvent.click(within(section).getByRole("button", { name: `Add ${SEEDED} to this session` }));
    expect((await feedTitles())[0]).toBe(SEEDED);
  });
});
