import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { makeFeed } from "./domain/feed";
import type { Video } from "./domain/types";
import { toSaved } from "./state/persistence";
import { ACCOUNT_SEED } from "./state/seed";
import { fakeAccount, SIGNED_IN } from "./test/account";
import { cardFor, feedTitles, renderApp } from "./test/renderApp";
import { fakeServerState } from "./test/serverState";
import { fakeTopicSearch } from "./test/topicSearch";

const SUBSCRIBED = "Subscribed on YouTube";

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

/** Your subscriptions' recent uploads. */
const OWN_CATALOG: readonly Video[] = [
  real({ id: "yt-1", title: "Late night monologue", channel: "Late Desk", topic: "TV" }),
  real({ id: "yt-2", title: "Ten minutes of stand-up", channel: "Stand Up Hour", topic: "Comedy", ageHours: 24 * 30 }),
];

/** What a topic search finds for Cooking, from a channel you don't subscribe to. */
const FOUND = real({ id: "yt-3", title: "Weeknight pasta", channel: "Pan Club", topic: "Cooking" });

/** A new account with one feed of Cooking, which is thin in your catalog, so it's searched. */
const withCooking = () =>
  toSaved({
    ...ACCOUNT_SEED,
    feeds: [...ACCOUNT_SEED.feeds, makeFeed({ name: "Dinner", topics: ["Cooking"], length: [1, 60], session: [10, 120], color: 1 })],
  });

/** Renders a signed-in account and waits for the topic search to bring its video onto Everything. */
async function renderSignedIn() {
  renderApp({
    account: fakeAccount({ status: SIGNED_IN }),
    serverState: fakeServerState(withCooking()),
    loadCatalog: async () => OWN_CATALOG,
    searchTopics: fakeTopicSearch({ found: { Cooking: [FOUND] } }).search,
  });
  await screen.findByRole("heading", { level: 3, name: FOUND.title });
}

const tabBar = () => screen.getByRole("navigation", { name: "Feeds" });

async function openSubscriptions() {
  await userEvent.click(within(tabBar()).getByRole("button", { name: /Explore feeds$/ }));
  await userEvent.click(within(screen.getByRole("dialog", { name: "Explore feeds" })).getByRole("button", { name: /^Subscriptions/ }));
}

async function openChannel(title: string, channel: string) {
  await userEvent.click(within(await cardFor(title)).getByRole("button", { name: `Channel: ${channel}` }));
  return screen.getByRole("dialog", { name: channel });
}

const reasonOn = async (title: string) => within(await cardFor(title)).getByText("Why this is here:").parentElement?.textContent;

describe("Subscriptions, signed in", () => {
  it("shows your catalog's channels, not topic-search videos", async () => {
    await renderSignedIn();
    await openSubscriptions();
    expect(await feedTitles()).toEqual(["Late night monologue", "Ten minutes of stand-up"]);
  });

  it("ranks new uploads from your subscriptions as followed on Everything", async () => {
    await renderSignedIn();
    expect(await reasonOn("Late night monologue")).toContain("New from Late Desk, which you follow");
    expect(await reasonOn(FOUND.title)).not.toContain("which you follow");
  });

  it("says a channel you subscribe to on YouTube is followed, and offers no unfollow we can't do", async () => {
    await renderSignedIn();
    const popup = await openChannel("Late night monologue", "Late Desk");
    expect(popup).toHaveTextContent(SUBSCRIBED);
    expect(within(popup).queryByRole("button", { name: "Remove from Subscriptions" })).not.toBeInTheDocument();
    expect(within(popup).queryByRole("button", { name: "Add to Subscriptions" })).not.toBeInTheDocument();
  });

  it("still adds a topic-search channel to Subscriptions by hand", async () => {
    await renderSignedIn();
    const popup = await openChannel(FOUND.title, "Pan Club");
    expect(popup).not.toHaveTextContent(SUBSCRIBED);
    await userEvent.click(within(popup).getByRole("button", { name: "Add to Subscriptions" }));

    await openSubscriptions();
    expect(await feedTitles()).toContain(FOUND.title);
    expect(await openChannel(FOUND.title, "Pan Club")).toHaveTextContent("You follow this channel");
  });
});
