import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { toSaved } from "./state/persistence";
import { DEMO_SEED } from "./state/seed";
import { fakeAccount, SIGNED_IN } from "./test/account";
import { feedTitles, renderApp, settingsLine } from "./test/renderApp";
import { fakeServerState } from "./test/serverState";
import { fakeSharing } from "./test/sharing";

/** An account that saved the starting example's feeds, shares and blends, which these tests build on. */
const demoAccount = () => fakeServerState(toSaved(DEMO_SEED));

/** Real Blend between signed-in accounts (ADR 0013): invites are server rows, the other person approves in their own account. */

// The starting example's feeds, which this account saved: Learn, Sport, Wind down and Cooking.
const MY_TOPICS = ["AI", "Programming", "Economics", "Careers", "Premier League", "Tennis", "Cricket", "Wrestling", "Podcasts", "Live music", "Vlogs", "Cooking"];

const tabBar = () => screen.getByRole("navigation", { name: "Feeds" });
const blendPanel = () => screen.getByRole("region", { name: /^(Blend with a friend|Invite sent to @.+|You \+ @.+)$/ });
const inPanel = () => within(blendPanel());
const usernameBox = () => screen.getByRole("textbox", { name: "Their Yourfeed username" });
const previousBlends = () => screen.getByRole("region", { name: "Previous blends" });

function renderSignedIn(sharing = fakeSharing(), server = demoAccount()) {
  const view = renderApp({ account: fakeAccount({ status: SIGNED_IN }), serverState: server, sharing });
  return { sharing, server, view };
}

async function openExplore(name: RegExp) {
  await userEvent.click(within(tabBar()).getByRole("button", { name: /Explore feeds$/ }));
  await userEvent.click(within(screen.getByRole("dialog", { name: "Explore feeds" })).getByRole("button", { name }));
}

async function openBlend() {
  await feedTitles();
  await openExplore(/^Blend/);
}

/** Leaves Blend for another feed and comes back, which asks the server what changed. */
async function reopenBlend() {
  await openExplore(/^Most viewed/);
  await openExplore(/^Blend/);
}

async function invite(name: string) {
  await userEvent.type(usernameBox(), name);
  await userEvent.click(screen.getByRole("button", { name: "Send invite" }));
}

describe("signed in, inviting someone to blend", () => {
  it("sends the invite with my recipe topics and waits for their approval, with nothing to simulate", async () => {
    const { sharing } = renderSignedIn();
    await openBlend();
    await invite("Maya.K");

    expect(await screen.findByRole("region", { name: "Invite sent to @maya.k" })).toHaveTextContent("@maya.k needs to approve it");
    // The server cleans the username and answers with it as stored.
    expect(sharing.calls.invites).toEqual([{ to: "Maya.K", topics: MY_TOPICS }]);
    expect(inPanel().queryByRole("button", { name: /Simulate/ })).not.toBeInTheDocument();
    // It already reached someone else, so it isn't an undo step.
    expect(screen.queryByRole("button", { name: /^Undo last change/ })).not.toBeInTheDocument();
  });

  it("says when no one has that username, and keeps what was typed", async () => {
    renderSignedIn();
    await openBlend();
    await invite("nobody.here");

    expect(await within(blendPanel()).findByRole("alert")).toHaveTextContent("No one has that username.");
    expect(blendPanel()).toHaveAccessibleName("Blend with a friend");
    expect(usernameBox()).toHaveValue("nobody.here");
  });

  it("says when the server didn't answer", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderSignedIn(fakeSharing({ down: true }));
    await openBlend();
    await invite("maya.k");

    expect(await within(blendPanel()).findByRole("alert")).toHaveTextContent("Couldn't reach Blend. Try again.");
    vi.restoreAllMocks();
  });

  it("cancelling the invite cancels it on the server", async () => {
    const { sharing } = renderSignedIn();
    await openBlend();
    await invite("maya.k");
    await userEvent.click(await inPanel().findByRole("button", { name: "Cancel invite" }));

    await waitFor(() => expect(blendPanel()).toHaveAccessibleName("Blend with a friend"));
    expect(sharing.calls.cancels).toEqual([100]);
    expect(await sharing.blends()).toEqual([]);
  });
});

describe("signed in, once they approve in their own account", () => {
  it("shows you both and mixes their recipe topics into my own catalog", async () => {
    const { sharing } = renderSignedIn();
    await openBlend();
    await invite("maya.k");
    await screen.findByRole("region", { name: "Invite sent to @maya.k" });

    sharing.theyApprove(100, ["AI", "Gardening"]);
    await reopenBlend();

    expect(await screen.findByRole("region", { name: "You + @maya.k" })).toHaveTextContent("% match");
    // Shared (AI), then four of mine (AI again among them), then theirs (Gardening).
    expect(settingsLine()).toHaveTextContent("5 topics");
    expect(await feedTitles()).toContain("Gardening for beginners");
    // Only real blends: the demo's simulated ones are gone.
    expect(within(previousBlends()).getAllByRole("button", { name: /^Open blend with/ }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Open blend with @maya.k",
    ]);
  });

  it("removing the blend removes it for both of us", async () => {
    const sharing = fakeSharing({ blends: [{ id: 5, with: "maya.k", role: "inviter", status: "accepted", topics: ["Gardening"] }] });
    renderSignedIn(sharing);
    await openBlend();
    await userEvent.click(await within(previousBlends()).findByRole("button", { name: "Open blend with @maya.k" }));
    expect(blendPanel()).toHaveAccessibleName("You + @maya.k");

    await userEvent.click(within(previousBlends()).getByRole("button", { name: "Remove blend with @maya.k" }));
    await waitFor(() => expect(blendPanel()).toHaveAccessibleName("Blend with a friend"));
    expect(sharing.calls.cancels).toEqual([5]);
    expect(screen.queryByRole("region", { name: "Previous blends" })).not.toBeInTheDocument();
  });

  it("goes back to asking when they end the blend", async () => {
    const sharing = fakeSharing({ blends: [{ id: 5, with: "maya.k", role: "inviter", status: "accepted", topics: ["Gardening"] }] });
    renderSignedIn(sharing);
    await openBlend();
    await userEvent.click(await within(previousBlends()).findByRole("button", { name: "Open blend with @maya.k" }));

    sharing.theyCancel(5);
    await reopenBlend();
    await waitFor(() => expect(blendPanel()).toHaveAccessibleName("Blend with a friend"));
  });
});

describe("signed in, undo", () => {
  it("still brings back a blend I closed after the server's blends changed", async () => {
    const sharing = fakeSharing({
      blends: [
        { id: 5, with: "maya.k", role: "inviter", status: "accepted", topics: ["Gardening"] },
        { id: 7, with: "devon_r", role: "invitee", status: "accepted", topics: ["Cooking"] },
      ],
    });
    renderSignedIn(sharing);
    await openBlend();
    await userEvent.click(await within(previousBlends()).findByRole("button", { name: "Open blend with @maya.k" }));
    await userEvent.click(inPanel().getByRole("button", { name: "Blend with someone else" }));
    sharing.theyCancel(7);
    await reopenBlend();
    await waitFor(() => expect(within(previousBlends()).getAllByRole("button", { name: /^Open blend with/ })).toHaveLength(1));
    expect(blendPanel()).toHaveAccessibleName("Blend with a friend");

    await userEvent.click(screen.getByRole("button", { name: /^Undo last change/ }));
    expect(await screen.findByRole("region", { name: "You + @maya.k" })).toBeInTheDocument();
  });
});

describe("signed in, an invite to me", () => {
  it("shows in Blend; approving sends my topics and opens the blend with theirs", async () => {
    const sharing = fakeSharing();
    const id = sharing.theyInvite("sam.r", ["Gardening"]);
    renderSignedIn(sharing);
    await openBlend();

    const invites = await screen.findByRole("region", { name: "Blend invites" });
    expect(invites).toHaveTextContent("@sam.r wants to blend with you");
    await userEvent.click(within(invites).getByRole("button", { name: "Approve blend with @sam.r" }));

    expect(await screen.findByRole("region", { name: "You + @sam.r" })).toBeInTheDocument();
    expect(sharing.calls.accepts).toEqual([{ id, topics: MY_TOPICS }]);
    expect(await feedTitles()).toContain("Gardening for beginners");
    expect(screen.queryByRole("region", { name: "Blend invites" })).not.toBeInTheDocument();
  });

  it("declining cancels it on the server", async () => {
    const sharing = fakeSharing();
    const id = sharing.theyInvite("sam.r", ["Gardening"]);
    renderSignedIn(sharing);
    await openBlend();
    await userEvent.click(within(await screen.findByRole("region", { name: "Blend invites" })).getByRole("button", { name: "Decline blend with @sam.r" }));

    await waitFor(() => expect(screen.queryByRole("region", { name: "Blend invites" })).not.toBeInTheDocument());
    expect(sharing.calls.cancels).toEqual([id]);
    expect(blendPanel()).toHaveAccessibleName("Blend with a friend");
  });

  it("is keyboard-reachable", async () => {
    const sharing = fakeSharing();
    sharing.theyInvite("sam.r", ["Gardening"]);
    renderSignedIn(sharing);
    await openBlend();
    const approve = within(await screen.findByRole("region", { name: "Blend invites" })).getByRole("button", { name: "Approve blend with @sam.r" });
    approve.focus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("region", { name: "You + @sam.r" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Blend invites" })).not.toBeInTheDocument();
  });
});

describe("signed in, a long recipe", () => {
  it("sends at most the 50 topics the server takes", async () => {
    const topics = Array.from({ length: 60 }, (_, i) => `Topic ${i}`);
    const learn = DEMO_SEED.feeds.map((f) => (f.name === "Learn" ? { ...f, topics } : f));
    const { sharing } = renderSignedIn(fakeSharing(), fakeServerState(toSaved({ ...DEMO_SEED, feeds: learn, currentFeed: "Blend" })));
    await screen.findByRole("textbox", { name: "Their Yourfeed username" });
    await invite("maya.k");
    await screen.findByRole("region", { name: "Invite sent to @maya.k" });
    expect(sharing.calls.invites[0].topics).toEqual(topics.slice(0, 50));
  });
});

describe("signed in, after a reload", () => {
  it("keeps which blend is open, by its server id", async () => {
    const sharing = fakeSharing();
    const server = demoAccount();
    const first = renderSignedIn(sharing, server);
    await openBlend();
    await invite("maya.k");
    await screen.findByRole("region", { name: "Invite sent to @maya.k" });
    await waitFor(() => expect(JSON.stringify(server.saved())).toContain('"id":100'));
    first.view.unmount();

    renderSignedIn(sharing, server);
    await userEvent.click(await within(await screen.findByRole("region", { name: "Invite sent to @maya.k" })).findByRole("button", { name: "Cancel invite" }));
    await waitFor(() => expect(sharing.calls.cancels).toEqual([100]));
  });

  it("falls back to a fresh start when a saved blend's id doesn't check out", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const saved = toSaved({ ...DEMO_SEED, blends: [{ id: -3, name: "maya.k", topics: ["AI"], score: 80 }] });
    renderSignedIn(fakeSharing(), fakeServerState(saved));
    await feedTitles();
    expect(warn).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe("in demo mode", () => {
  it("keeps Simulate their approval, and never asks the server", async () => {
    const sharing = fakeSharing();
    renderApp({ sharing });
    await openBlend();
    await invite("sam");
    await userEvent.click(inPanel().getByRole("button", { name: "Simulate their approval (demo only)" }));

    expect(blendPanel()).toHaveAccessibleName("You + @sam");
    expect(sharing.calls.invites).toEqual([]);
  });
});
