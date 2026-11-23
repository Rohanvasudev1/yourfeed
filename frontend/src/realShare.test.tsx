import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { SentShare } from "./domain/sending";
import { encodeShare, type Share } from "./domain/share";
import type { Video } from "./domain/types";
import { fakeAccount, SIGNED_IN } from "./test/account";
import { CATALOG, memoryStorage } from "./test/fixtures";
import { feedTitles, openFeedTitle, renderApp } from "./test/renderApp";
import { fakeServerState } from "./test/serverState";
import { fakeSharing } from "./test/sharing";

/** Real share and send between signed-in users (ADR 0013); demo mode keeps its simulations. */

const youtubeVideo = (id: string, title: string): Video => ({
  id,
  title,
  honestTitle: title,
  channel: "Pitch Side",
  channelSubscribers: 5_000,
  topic: "Football",
  minutes: 12,
  views: 900,
  ageHours: 30,
  clickbait: false,
  live: false,
  newsCategory: null,
});

const ELSEWHERE = [youtubeVideo("yt-derby", "Derby day tactics"), youtubeVideo("yt-press", "Pressing explained")];

const SENT: SentShare = {
  id: 7,
  from: "maya.k",
  title: "Derby prep",
  videos: ["yt-derby", "yt-press"],
  message: "Watch before Sunday",
  notes: {},
  sentAt: Date.now() - 60_000,
};

afterEach(() => window.history.replaceState(null, "", "/"));

const linkTo = (share: Share) => {
  const result = encodeShare(share);
  if (!result.ok) throw new Error(result.problem);
  return `#share=${result.encoded}`;
};

function renderSignedIn({ sharing = fakeSharing({ youtube: ELSEWHERE }), server = fakeServerState() } = {}) {
  renderApp({ account: fakeAccount({ status: SIGNED_IN }), serverState: server, sharing });
  return { sharing, server };
}

const tabBar = () => screen.getByRole("navigation", { name: "Feeds" });
const exploreButton = () => within(tabBar()).getByRole("button", { name: /Explore feeds$/ });
const sharedHeader = () => screen.findByRole("region", { name: "Shared feed" });
const panel = () => screen.getByRole("region", { name: "Share this feed" });
const usernameBox = () => within(panel()).getByRole("textbox", { name: "Username to send this feed to" });

async function openExplore(name: RegExp) {
  await userEvent.click(exploreButton());
  await userEvent.click(within(screen.getByRole("dialog", { name: "Explore feeds" })).getByRole("button", { name }));
}

async function openSharePanel() {
  await feedTitles();
  await userEvent.click(screen.getByRole("button", { name: "Share" }));
  return panel();
}

describe("signed in, a share link", () => {
  it("opens with videos outside my catalog, looked up on YouTube", async () => {
    window.history.replaceState(null, "", `/${linkTo({ title: "Derby prep", videos: ["yt-derby", "demo-50"] })}`);
    const { sharing } = renderSignedIn();

    expect(await sharedHeader()).toHaveTextContent("Derby prep from a link");
    expect(await feedTitles()).toEqual(["Derby day tactics", "Gardening for beginners"]);
    expect(sharing.calls.lookups).toContainEqual(["yt-derby"]);
  });

  it("still doesn't work when YouTube doesn't know a video either", async () => {
    window.history.replaceState(null, "", `/${linkTo({ title: "Mystery", videos: ["yt-gone"] })}`);
    renderSignedIn();

    expect(await screen.findByRole("alert")).toHaveTextContent("This share link doesn't work.");
    expect(openFeedTitle()).toBe("Everything");
  });

  it("opens when the inbox is already looking up the same video", async () => {
    window.history.replaceState(null, "", `/${linkTo({ title: "Again", videos: ["yt-derby"] })}`);
    const sharing = fakeSharing({ youtube: ELSEWHERE, sent: [SENT] });
    renderSignedIn({ sharing });

    expect(await sharedHeader()).toHaveTextContent("Again from a link");
    expect(await feedTitles()).toEqual(["Derby day tactics"]);
  });

  it("looks a video up again after a lookup failed", async () => {
    const sharing = fakeSharing({ youtube: ELSEWHERE });
    sharing.failNextLookupOf("yt-derby");
    window.history.replaceState(null, "", `/${linkTo({ title: "Derby prep", videos: ["yt-derby"] })}`);
    renderSignedIn({ sharing });
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't look up this link's videos. Open it again in a minute.");

    act(() => {
      window.location.hash = linkTo({ title: "Derby prep", videos: ["yt-derby"] });
    });
    expect(await sharedHeader()).toHaveTextContent("Derby prep from a link");
  });
});

describe("in demo mode, a share link", () => {
  it("is checked against the demo catalog only, with nothing looked up", async () => {
    window.history.replaceState(null, "", `/${linkTo({ title: "Derby prep", videos: ["yt-derby"] })}`);
    const sharing = fakeSharing({ youtube: ELSEWHERE });
    renderApp({ sharing });

    expect(await screen.findByRole("alert")).toHaveTextContent("This share link doesn't work.");
    expect(sharing.calls.lookups).toEqual([]);
  });
});

describe("signed in, sending to a username", () => {
  it("sends the picked videos to the server and says who it went to, with no Demo only note", async () => {
    const { sharing } = renderSignedIn();
    await openSharePanel();

    await userEvent.type(usernameBox(), "@Maya.K{Enter}");

    expect(await within(panel()).findByText("Sent to @maya.k")).toBeInTheDocument();
    expect(sharing.calls.sends).toEqual([{ to: "Maya.K", share: { title: "Everything", videos: ["demo-51", "demo-52", "demo-50"] } }]);
    expect(panel()).not.toHaveTextContent("Demo only");
  });

  it("says when no one has that username", async () => {
    renderSignedIn();
    await openSharePanel();

    await userEvent.type(usernameBox(), "nobody.here{Enter}");

    expect(await within(panel()).findByRole("alert")).toHaveTextContent("No one has that username.");
    expect(panel()).not.toHaveTextContent("Sent to");
    expect(usernameBox()).toHaveValue("nobody.here");
  });

  it("says when the send didn't get through", async () => {
    renderSignedIn({ sharing: fakeSharing({ down: true }) });
    await openSharePanel();

    await userEvent.type(usernameBox(), "maya.k{Enter}");

    expect(await within(panel()).findByRole("alert")).toHaveTextContent("Couldn't send. Try again.");
  });
});

describe("signed in, what others sent you", () => {
  it("lands in Shared with you from its sender, with its videos looked up", async () => {
    renderSignedIn({ sharing: fakeSharing({ youtube: ELSEWHERE, sent: [SENT] }) });
    await feedTitles();
    await waitFor(() => expect(exploreButton()).toHaveAccessibleDescription("3 unread in Shared with you"));

    await openExplore(/^Shared with you/);
    await userEvent.click(screen.getByRole("button", { name: /^Open Derby prep from @maya\.k/ }));

    expect(await sharedHeader()).toHaveTextContent("Derby prep from @maya.k");
    expect(await feedTitles()).toEqual(["Derby day tactics", "Pressing explained"]);
  });

  it("isn't added again after a reload once removed", async () => {
    const sharing = fakeSharing({ youtube: ELSEWHERE, sent: [SENT] });
    const server = fakeServerState();
    const first = renderApp({ account: fakeAccount({ status: SIGNED_IN }), serverState: server, sharing, storage: memoryStorage() });
    await feedTitles();
    await openExplore(/^Shared with you/);
    await userEvent.click(await screen.findByRole("button", { name: "Remove Derby prep from @maya.k" }));
    await waitFor(() => expect(JSON.stringify(server.saved())).toContain('"sentCursor":7'));
    first.unmount();

    const before = sharing.calls.inbox.length;
    renderSignedIn({ sharing, server });
    // It reopens where you left off: Shared with you.
    await screen.findByRole("list", { name: "Shared with you" });
    await waitFor(() => expect(sharing.calls.inbox.slice(before)).toContain(7));
    await openExplore(/^Shared with you/);
    expect(screen.queryByRole("button", { name: /^Open Derby prep/ })).not.toBeInTheDocument();
  });

  it("doesn't reach demo mode", async () => {
    const sharing = fakeSharing({ sent: [SENT] });
    renderApp({ sharing, loadCatalog: async () => CATALOG });
    await feedTitles();
    expect(sharing.calls.inbox).toEqual([]);
  });
});

describe("signed in, From Claude", () => {
  it("still says Demo only", async () => {
    renderSignedIn();
    await feedTitles();
    await openExplore(/^From Claude/);
    expect(screen.getByRole("region", { name: "Connect Claude" })).toHaveTextContent("Demo only");
  });
});
