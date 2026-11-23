import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeFeed } from "./domain/feed";
import type { Video } from "./domain/types";
import { toSaved } from "./state/persistence";
import { DEMO_SEED } from "./state/seed";
import { fakeAccount, SIGNED_IN } from "./test/account";
import { CATALOG, memoryStorage } from "./test/fixtures";
import { cardFor, feedTitles, filtersPopup, renderApp, toggleFilters, filtersButton } from "./test/renderApp";
import { fakeServerState } from "./test/serverState";

const DEMO_ONLY = "Demo catalog only";
const TOPIC_LABEL = "This channel's topic";
const YOUTUBES = "YouTube's category";

/** A real catalog: YouTube's readable topics, never clickbait. */
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

const REAL_CATALOG: readonly Video[] = [
  real({ id: "yt-1", title: "Late night monologue", channel: "Late Desk", topic: "TV" }),
  real({ id: "yt-2", title: "Ten minutes of stand-up", channel: "Stand Up Hour", topic: "Comedy" }),
];

/** A signed-in user's saved state with a Laughs feed of Comedy, open on Everything. */
const withLaughs = (extra: Record<string, unknown> = {}) =>
  toSaved({
    ...DEMO_SEED,
    feeds: [...DEMO_SEED.feeds, makeFeed({ name: "Laughs", topics: ["Comedy"], length: [1, 60], session: [10, 120], color: 1 })],
    ...extra,
  });

const openTab = async (name: string) =>
  userEvent.click(within(await screen.findByRole("navigation", { name: "Feeds" })).getByRole("button", { name }));

async function openChannel(title: string, channel: string) {
  await userEvent.click(within(await cardFor(title)).getByRole("button", { name: `Channel: ${channel}` }));
  return screen.getByRole("dialog", { name: channel });
}

function renderSignedIn(server = fakeServerState(withLaughs())) {
  renderApp({ account: fakeAccount({ status: SIGNED_IN }), serverState: server, loadCatalog: async () => REAL_CATALOG });
  return server;
}

describe("a channel's topic, signed in", () => {
  it("moves the channel's videos into feeds with that topic, over YouTube's category, and survives reload", async () => {
    const server = renderSignedIn();
    await openTab("Laughs");
    expect(await feedTitles()).toEqual(["Ten minutes of stand-up"]);

    await openTab("Everything (home)");
    const popup = await openChannel("Late night monologue", "Late Desk");
    const select = within(popup).getByRole("combobox", { name: TOPIC_LABEL });
    expect(select).toHaveValue("");
    await userEvent.selectOptions(select, "Comedy");
    expect(within(await cardFor("Late night monologue")).getByRole("button", { name: "Topic: Comedy" })).toBeInTheDocument();

    await openTab("Laughs");
    expect((await feedTitles()).sort()).toEqual(["Late night monologue", "Ten minutes of stand-up"]);

    await vi.waitFor(() => expect((server.saved() as ReturnType<typeof toSaved>).state.channelTopics).toEqual({ "Late Desk": "Comedy" }));
    cleanup();
    renderSignedIn(server);
    expect((await feedTitles()).sort()).toEqual(["Late night monologue", "Ten minutes of stand-up"]);
  });

  it("goes back to YouTube's category", async () => {
    renderSignedIn(fakeServerState(withLaughs({ channelTopics: { "Late Desk": "Comedy" } })));
    await openTab("Laughs");
    const popup = await openChannel("Late night monologue", "Late Desk");
    const select = within(popup).getByRole("combobox", { name: TOPIC_LABEL });
    expect(select).toHaveValue("Comedy");
    await userEvent.selectOptions(select, YOUTUBES);
    expect(await feedTitles()).toEqual(["Ten minutes of stand-up"]);
  });

  it("is reached by keyboard from the channel's other action", async () => {
    renderSignedIn();
    const popup = await openChannel("Late night monologue", "Late Desk");
    within(popup).getByRole("button", { name: "Add to Subscriptions" }).focus();
    await userEvent.tab();
    expect(within(popup).getByRole("combobox", { name: TOPIC_LABEL })).toHaveFocus();
  });

  it("drops saved channel topics that aren't topics, and keeps the others", async () => {
    renderSignedIn(fakeServerState(withLaughs({ channelTopics: { "Late Desk": "Comedy", "Stand Up Hour": "Not a topic" } })));
    await openTab("Laughs");
    expect((await feedTitles()).sort()).toEqual(["Late night monologue", "Ten minutes of stand-up"]);
  });
});

describe("a channel's topic in demo mode", () => {
  it("isn't offered, and a saved one doesn't change the demo catalog's fixed topics", async () => {
    renderApp({ storage: memoryStorage(toSaved({ ...DEMO_SEED, channelTopics: { "Model School": "Comedy" } })) });
    const popup = await openChannel("Intro to transformers", "Model School");
    expect(within(popup).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(await cardFor("Intro to transformers")).getByRole("button", { name: "Topic: AI" })).toBeInTheDocument();
  });
});

describe("Hide clickbait and Honest titles", () => {
  it("say Demo catalog only when signed in, and don't change", async () => {
    renderApp({ account: fakeAccount({ status: SIGNED_IN }), loadCatalog: async () => CATALOG });
    await feedTitles();
    const before = filtersButton().textContent;
    await userEvent.click(filtersButton());
    const popup = await filtersPopup();
    for (const name of ["Hide clickbait", "Honest titles"]) {
      const toggle = within(popup).getByRole("switch", { name });
      expect(toggle).toHaveAttribute("aria-disabled", "true");
      expect(toggle).toHaveAccessibleDescription(DEMO_ONLY);
      await userEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-checked", "false");
    }
    await userEvent.keyboard("{Escape}");
    expect(filtersButton().textContent).toBe(before);
  });

  it("work as before in demo mode", async () => {
    renderApp();
    await toggleFilters("Hide clickbait");
    expect(await feedTitles()).toContain("A small AI tip");
    await userEvent.click(filtersButton());
    expect(within(await filtersPopup()).queryByText(DEMO_ONLY)).not.toBeInTheDocument();
  });
});
