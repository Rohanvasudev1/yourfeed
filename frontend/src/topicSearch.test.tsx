import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeFeed } from "./domain/feed";
import type { Video } from "./domain/types";
import { toSaved } from "./state/persistence";
import { DEMO_SEED } from "./state/seed";
import { fakeAccount, SIGNED_IN, SIGNED_OUT } from "./test/account";
import { feedTitles, renderApp, settingsLine } from "./test/renderApp";
import { fakeServerState } from "./test/serverState";
import { fakeTopicSearch } from "./test/topicSearch";

const PAUSED = "New topic searches resume tomorrow.";

const real = (o: Partial<Video> & Pick<Video, "id" | "title" | "channel" | "topic">): Video => ({
  honestTitle: o.title,
  channelSubscribers: 40_000,
  minutes: 20,
  views: 10_000,
  ageHours: 48,
  clickbait: false,
  live: false,
  newsCategory: null,
  ...o,
});

const STAND_UP = real({ id: "yt-2", title: "Ten minutes of stand-up", channel: "Stand Up Hour", topic: "Comedy" });
const CROWD_WORK = real({ id: "yt-9", title: "Crowd work compilation", channel: "Open Mic Nights", topic: "Other" });
const SOURDOUGH = real({ id: "yt-10", title: "Sourdough from scratch", channel: "Bread Lab", topic: "Food" });

/** A signed-in user's saved state with a Laughs feed of Comedy. */
const withLaughs = () =>
  toSaved({
    ...DEMO_SEED,
    feeds: [...DEMO_SEED.feeds, makeFeed({ name: "Laughs", topics: ["Comedy"], length: [1, 60], session: [10, 120], color: 1 })],
  });

const openTab = async (name: string) =>
  userEvent.click(within(await screen.findByRole("navigation", { name: "Feeds" })).getByRole("button", { name }));

function renderSignedIn(search: ReturnType<typeof fakeTopicSearch>, catalog: readonly Video[] = [STAND_UP]) {
  renderApp({
    account: fakeAccount({ status: SIGNED_IN }),
    serverState: fakeServerState(withLaughs()),
    loadCatalog: async () => catalog,
    searchTopics: search.search,
  });
}

describe("topic searches, signed in", () => {
  it("bring videos into a feed whose topic has few videos in your catalog", async () => {
    const search = fakeTopicSearch({ found: { Comedy: [CROWD_WORK] } });
    renderSignedIn(search);
    await openTab("Laughs");
    await waitFor(async () => expect(await feedTitles()).toEqual(expect.arrayContaining(["Ten minutes of stand-up", "Crowd work compilation"])));
    expect(search.searched()).toContain("Comedy");
    // Never more than five topics a request.
    expect(search.calls.every((topics) => topics.length <= 5)).toBe(true);
  });

  it("leave a topic with enough videos alone, and ask for each topic once a visit", async () => {
    const search = fakeTopicSearch();
    const plenty = Array.from({ length: 5 }, (_, n) => real({ id: `c-${n}`, title: `Bit ${n}`, channel: "Stand Up Hour", topic: "Comedy" }));
    renderSignedIn(search, plenty);
    await openTab("Laughs");
    await feedTitles();
    await waitFor(() => expect(search.calls.length).toBeGreaterThan(0));
    expect(search.searched()).not.toContain("Comedy");
    expect(new Set(search.searched()).size).toBe(search.searched().length);
  });

  it("search a topic you add to a feed", async () => {
    const search = fakeTopicSearch({ found: { Baking: [SOURDOUGH] } });
    renderSignedIn(search);
    await openTab("Laughs");
    await userEvent.click(within(settingsLine()).getByRole("button", { name: /topics?$/ }));
    const popup = screen.getByRole("dialog", { name: "Topics in this feed" });
    await userEvent.type(within(popup).getByRole("textbox", { name: "Add a topic" }), "Baking{Enter}");
    await userEvent.keyboard("{Escape}");
    await waitFor(async () => expect(await feedTitles()).toContain("Sourdough from scratch"));
    expect(search.searched().filter((t) => t === "Baking")).toHaveLength(1);
    // Topics already asked for this visit aren't asked again.
    expect(search.searched().filter((t) => t === "Comedy")).toHaveLength(1);
  });

  it("say quietly, once, when today's searches are used up", async () => {
    const search = fakeTopicSearch({ paused: true });
    renderSignedIn(search);
    await openTab("Laughs");
    expect(await screen.findByText(PAUSED)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(PAUSED)).not.toBeInTheDocument(), { timeout: 6000 });
    await userEvent.click(within(settingsLine()).getByRole("button", { name: /topics?$/ }));
    const popup = screen.getByRole("dialog", { name: "Topics in this feed" });
    await userEvent.type(within(popup).getByRole("textbox", { name: "Add a topic" }), "Baking{Enter}");
    await waitFor(() => expect(search.searched()).toContain("Baking"));
    expect(screen.queryByText(PAUSED)).not.toBeInTheDocument();
  }, 15_000);

  it("leave the feed as it is when the search fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const search = fakeTopicSearch({ down: true });
    renderSignedIn(search);
    await openTab("Laughs");
    expect(await feedTitles()).toEqual(["Ten minutes of stand-up"]);
    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("topic searches in demo mode", () => {
  it("never happen: the demo catalog is fixed", async () => {
    const search = fakeTopicSearch();
    renderApp({ account: fakeAccount({ status: SIGNED_OUT }), searchTopics: search.search });
    await feedTitles();
    expect(search.calls).toEqual([]);
  });
});
