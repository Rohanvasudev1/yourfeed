import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeShare, type Share } from "./domain/share";
import { memoryStorage } from "./test/fixtures";
import { feedTitles, openFeedTitle, renderApp } from "./test/renderApp";
import { SHARED_CATALOG } from "./test/sharedCatalog";

const renderShared = (storage = memoryStorage()) => renderApp({ loadCatalog: async () => SHARED_CATALOG, storage });

afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

const tabBar = () => screen.getByRole("navigation", { name: "Feeds" });
const exploreButton = () => within(tabBar()).getByRole("button", { name: /Explore feeds$/ });
const inbox = () => screen.getByRole("list", { name: "Shared with you" });
const shareCards = () => within(inbox()).queryAllByRole("listitem");
const cardFor = (title: string) => {
  const card = shareCards().find((li) => li.textContent?.includes(title));
  if (!card) throw new Error(`No share card for "${title}"`);
  return card;
};
const openButton = (name: RegExp) => screen.getByRole("button", { name });
const header = () => screen.getByRole("region", { name: "Shared feed" });

async function openSharedWithYou() {
  await userEvent.click(exploreButton());
  await userEvent.click(within(screen.getByRole("dialog", { name: "Explore feeds" })).getByRole("button", { name: /^Shared with you/ }));
  return screen.findByRole("list", { name: "Shared with you" });
}

const linkTo = (share: Share) => {
  const result = encodeShare(share);
  if (!result.ok) throw new Error(result.problem);
  return `#share=${result.encoded}`;
};

const GOOD_SHARE: Share = { title: "Garden picks", videos: ["demo-50", "demo-51"], message: "Try these" };

describe("Shared with you", () => {
  it("sits in Explore with its unread count", async () => {
    renderShared();
    await feedTitles();
    expect(exploreButton()).toHaveAccessibleDescription("2 unread in Shared with you");

    await userEvent.click(exploreButton());
    const item = within(screen.getByRole("dialog", { name: "Explore feeds" })).getByRole("button", { name: /^Shared with you/ });
    expect(item).toHaveTextContent("Feeds people sent you");
    expect(item).toHaveTextContent("2");
  });

  it("lists the demo inbox: sender, title, count, time, age, message, thumbnails, notes and unread dots", async () => {
    renderShared();
    await openSharedWithYou();

    expect(openFeedTitle()).toBe("Shared with you");
    expect(shareCards()).toHaveLength(3);
    const trip = cardFor("Trip planning");
    expect(trip).toHaveTextContent("@maya.k shared Trip planning");
    expect(trip).toHaveTextContent("4 videos · 1h 10m · 2 hours ago");
    expect(trip).toHaveTextContent("“For your Japan trip, the night trains one is great”");
    expect(within(trip).getByRole("img", { name: "New" })).toBeInTheDocument();
    expect(within(trip).getAllByRole("img", { name: /^Thumbnail/ })).toHaveLength(4);
    expect(trip).not.toHaveTextContent("includes their notes");

    expect(cardFor("Learn")).toHaveTextContent("includes their notes");
    const sport = cardFor("Sport");
    expect(sport).toHaveTextContent("3 videos · 31m · 3 days ago");
    expect(within(sport).queryByRole("img", { name: "New" })).not.toBeInTheDocument();
  });

  it("opens a share as a feed in the sender's order, marks it read, and goes back to the inbox", async () => {
    renderShared();
    await openSharedWithYou();

    await userEvent.click(openButton(/^Open Trip planning from @maya\.k/));

    expect(header()).toHaveTextContent("Trip planning from @maya.k");
    expect(header()).toHaveTextContent("“For your Japan trip, the night trains one is great”");
    expect(await feedTitles()).toEqual(["Night trains across Japan", "Kyoto on a budget", "Packing light for two weeks", "Tokyo food alleys"]);
    expect(exploreButton()).toHaveAccessibleDescription("1 unread in Shared with you");

    await userEvent.click(screen.getByRole("button", { name: "Night trains across Japan" }));
    expect(screen.getByRole("region", { name: "Watching now" })).toHaveTextContent("Night trains across Japan");

    await userEvent.click(within(header()).getByRole("button", { name: "Back to everything shared with you" }));
    expect(within(cardFor("Trip planning")).queryByRole("img", { name: "New" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Up next" })).not.toBeInTheDocument();

    await userEvent.click(openButton(/^Open Trip planning/));
    expect(screen.getByRole("region", { name: "Watching now" })).toHaveTextContent("Night trains across Japan");
  });

  it("shows the sender's notes above the videos", async () => {
    renderShared();
    await openSharedWithYou();
    await userEvent.click(openButton(/^Open Learn from @devon_r/));

    const notes = within(header()).getByRole("list", { name: "@devon_r's notes" });
    expect(notes).toHaveTextContent("Build an MCP server: Skip to 6:00 for the actual server code");
    expect(notes).toHaveTextContent("Tools vs resources: Good explanation of tools vs resources");
  });

  it("saves a share as one of your feeds, named for its sender", async () => {
    renderShared();
    await openSharedWithYou();
    await userEvent.click(openButton(/^Open Sport from @sam_k/));

    await userEvent.click(within(header()).getByRole("button", { name: "Save as my feed" }));

    expect(openFeedTitle()).toBe("Sport from @sam_k");
    expect(within(tabBar()).getByRole("button", { name: "Sport from @sam_k" })).toHaveAttribute("aria-current", "page");
    expect(await feedTitles()).toEqual(["Derby highlights", "Five set final", "Cricket's best catches"]);
  });

  it("removes shares from the inbox or while open, and says so when nothing is left", async () => {
    renderShared();
    await openSharedWithYou();

    await userEvent.click(screen.getByRole("button", { name: "Remove Trip planning from @maya.k" }));
    expect(shareCards()).toHaveLength(2);
    expect(exploreButton()).toHaveAccessibleDescription("1 unread in Shared with you");

    await userEvent.click(openButton(/^Open Learn/));
    await userEvent.click(within(header()).getByRole("button", { name: "Remove this shared feed" }));
    expect(shareCards()).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Remove Sport from @sam_k" }));
    expect(screen.getByText("Nothing shared with you yet")).toBeInTheDocument();
    expect(exploreButton()).not.toHaveAccessibleDescription();
  });

  it("closes an open share when you leave the tab", async () => {
    renderShared();
    await openSharedWithYou();
    await userEvent.click(openButton(/^Open Trip planning/));

    await userEvent.click(within(tabBar()).getByRole("button", { name: "Everything (home)" }));
    await openSharedWithYou();
    expect(shareCards()).toHaveLength(3);
  });

  it("keeps what you've read across a reload", async () => {
    const storage = memoryStorage();
    const { unmount } = renderShared(storage);
    await openSharedWithYou();
    await userEvent.click(openButton(/^Open Trip planning/));
    unmount();

    renderShared(storage);
    await feedTitles().catch(() => null);
    expect(exploreButton()).toHaveAccessibleDescription("1 unread in Shared with you");
  });
});

describe("opening a share link", () => {
  it("adds the shared feed to the inbox once, opens it and clears the link", async () => {
    const storage = memoryStorage();
    window.history.replaceState(null, "", `/${linkTo({ ...GOOD_SHARE, notes: { "demo-50": "<b>Start here</b>" } })}`);
    const { unmount } = renderShared(storage);

    expect(await screen.findByRole("region", { name: "Shared feed" })).toHaveTextContent("Garden picks from a link");
    expect(await feedTitles()).toEqual(["Gardening for beginners", "Agents with memory"]);
    expect(window.location.hash).toBe("");
    // Notes are plain text: markup in a link is shown, never rendered.
    expect(header()).toHaveTextContent("Gardening for beginners: <b>Start here</b>");
    expect(within(header()).queryByText("Start here")).not.toBeInTheDocument();
    unmount();

    window.history.replaceState(null, "", `/${linkTo({ ...GOOD_SHARE, notes: { "demo-50": "<b>Start here</b>" } })}`);
    renderShared(storage);
    await screen.findByRole("region", { name: "Shared feed" });
    await userEvent.click(within(header()).getByRole("button", { name: "Back to everything shared with you" }));
    expect(shareCards()).toHaveLength(4);
    expect(shareCards()[0]).toHaveTextContent("Garden picks");
  });

  it("opens a link followed while the app is already open", async () => {
    renderShared();
    await feedTitles();

    act(() => {
      window.location.hash = linkTo(GOOD_SHARE);
    });

    expect(await screen.findByRole("region", { name: "Shared feed" })).toHaveTextContent("Garden picks from a link");
    await waitFor(() => expect(window.location.hash).toBe(""));
  });

  it.each([
    ["malformed", "#share=not*base64"],
    ["oversize", `#share=${"A".repeat(50_000)}`],
    ["naming a video the catalog doesn't have", linkTo({ title: "Mystery", videos: ["demo-999"] })],
  ])("says a %s link doesn't work and changes nothing", async (_, hash) => {
    window.history.replaceState(null, "", `/${hash}`);
    renderShared();

    expect(await screen.findByRole("alert")).toHaveTextContent("This share link doesn't work.");
    expect(openFeedTitle()).toBe("Everything");
    expect(window.location.hash).toBe("");
    await openSharedWithYou();
    expect(shareCards()).toHaveLength(3);
  });
});
