import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toSaved } from "./state/persistence";
import { DEMO_SEED } from "./state/seed";
import { memoryStorage } from "./test/fixtures";
import { feedTitles, renderApp, settingsLine, upNextList } from "./test/renderApp";

afterEach(() => {
  vi.restoreAllMocks();
});

const tabBar = () => screen.getByRole("navigation", { name: "Feeds" });
const blendPanel = () => screen.getByRole("region", { name: /^(Blend with a friend|Invite sent to @.+|You \+ @.+)$/ });
const inPanel = () => within(blendPanel());
const usernameBox = () => screen.getByRole("textbox", { name: "Their Yourfeed username" });
const previousBlends = () => screen.getByRole("region", { name: "Previous blends" });

async function openBlend() {
  await userEvent.click(within(tabBar()).getByRole("button", { name: /Explore feeds$/ }));
  await userEvent.click(within(screen.getByRole("dialog", { name: "Explore feeds" })).getByRole("button", { name: /^Blend/ }));
}

async function invite(name: string) {
  await userEvent.type(usernameBox(), name);
  await userEvent.click(screen.getByRole("button", { name: "Send invite" }));
}

describe("Blend", () => {
  it("is in Explore, and asks for a username with the same checks as Share", async () => {
    renderApp();
    await userEvent.click(within(tabBar()).getByRole("button", { name: /Explore feeds$/ }));
    expect(within(screen.getByRole("dialog", { name: "Explore feeds" })).getByRole("button", { name: /^Blend/ })).toHaveTextContent(
      "Mixed with a friend",
    );
    await userEvent.keyboard("{Escape}");
    await openBlend();

    expect(blendPanel()).toHaveAccessibleName("Blend with a friend");
    expect(within(await upNextList()).queryAllByRole("listitem")).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "Send invite" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Type a username first");

    await invite("no spaces allowed");
    expect(screen.getByRole("alert")).toHaveTextContent("Usernames are 3–20 letters, numbers, dots or underscores");

    await userEvent.type(usernameBox(), "x");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends an invite with Enter, and Cancel invite goes back to asking", async () => {
    renderApp();
    await openBlend();
    await userEvent.type(usernameBox(), " @sam {Enter}");

    expect(blendPanel()).toHaveAccessibleName("Invite sent to @sam");
    expect(blendPanel()).toHaveTextContent("@sam needs to approve it in their Yourfeed account.");
    expect(within(await upNextList()).queryAllByRole("listitem")).toHaveLength(0);

    await userEvent.click(inPanel().getByRole("button", { name: "Cancel invite" }));
    expect(blendPanel()).toHaveAccessibleName("Blend with a friend");
    expect(usernameBox()).toHaveValue("");
  });

  it("simulated approval shows you both, the match score and blended topics, and composes a feed", async () => {
    renderApp();
    await openBlend();
    await invite("sam");
    await userEvent.click(inPanel().getByRole("button", { name: "Simulate their approval (demo only)" }));

    expect(blendPanel()).toHaveAccessibleName("You + @sam");
    expect(blendPanel()).toHaveTextContent("66% match");
    // Shared (AI), then up to four of mine, then theirs (Gardening): five topics.
    expect(settingsLine()).toHaveTextContent("5 topics");
    const titles = await feedTitles();
    expect(titles.slice(0, 3).sort()).toEqual(["Agents with memory", "Already watched agent build", "Intro to transformers"]);
    expect(titles.at(-1)).toBe("Gardening for beginners");
    expect(within(previousBlends()).getAllByRole("button", { name: /^Open blend with/ })[0]).toHaveAccessibleName("Open blend with @sam");
  });

  it("changing partner resets the blend, and undo brings it back", async () => {
    renderApp();
    await openBlend();
    await invite("sam");
    await userEvent.click(inPanel().getByRole("button", { name: "Simulate their approval (demo only)" }));

    await userEvent.click(inPanel().getByRole("button", { name: "Blend with someone else" }));
    expect(blendPanel()).toHaveAccessibleName("Blend with a friend");
    expect(settingsLine()).toHaveTextContent("0 topics");

    await userEvent.click(screen.getByRole("button", { name: /^Undo/ }));
    expect(blendPanel()).toHaveAccessibleName("You + @sam");
    expect(settingsLine()).toHaveTextContent("5 topics");
  });

  it("undoing an approval takes the blend back out of your blends", async () => {
    renderApp();
    await openBlend();
    await invite("sam");
    await userEvent.click(inPanel().getByRole("button", { name: "Simulate their approval (demo only)" }));

    await userEvent.click(screen.getByRole("button", { name: /^Undo/ }));
    expect(blendPanel()).toHaveAccessibleName("Invite sent to @sam");
    expect(within(previousBlends()).queryByRole("button", { name: "Open blend with @sam" })).not.toBeInTheDocument();
  });

  it("waits for the catalog before sending an invite", async () => {
    renderApp({ loadCatalog: () => new Promise(() => {}) });
    await openBlend();
    expect(screen.getByRole("button", { name: "Send invite" })).toBeDisabled();
  });

  it("starts with the mockup's two blends, which open and can be removed", async () => {
    renderApp();
    await openBlend();
    const list = previousBlends();
    expect(within(list).getAllByRole("button", { name: /^Open blend with/ }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Open blend with @maya.k",
      "Open blend with @devon_r",
    ]);
    expect(list).toHaveTextContent("83% match · Cooking, Cricket, AI, Travel");

    await userEvent.click(within(list).getByRole("button", { name: "Open blend with @maya.k" }));
    expect(blendPanel()).toHaveAccessibleName("You + @maya.k");
    expect(blendPanel()).toHaveTextContent("83% match");
    expect(within(list).getByRole("button", { name: "Open blend with @maya.k" })).toHaveAttribute("aria-current", "true");

    await userEvent.click(within(list).getByRole("button", { name: "Remove blend with @maya.k" }));
    expect(blendPanel()).toHaveAccessibleName("Blend with a friend");
    expect(within(list).getAllByRole("button", { name: /^Open blend with/ })).toHaveLength(1);

    const toggle = within(list).getByRole("button", { name: /^Previous blends/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(list).queryByRole("button", { name: /^Open blend with/ })).not.toBeInTheDocument();
  });

  it("keeps the blend and your blends after a reload", async () => {
    const storage = memoryStorage();
    const first = renderApp({ storage });
    await openBlend();
    await invite("sam");
    await userEvent.click(inPanel().getByRole("button", { name: "Simulate their approval (demo only)" }));
    first.unmount();

    renderApp({ storage });
    expect(blendPanel()).toHaveAccessibleName("You + @sam");
    expect(within(previousBlends()).getAllByRole("button", { name: /^Open blend with/ })).toHaveLength(3);
  });

  it("falls back to the starting example when a saved blend doesn't check out", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const saved = toSaved({ ...DEMO_SEED, blends: [{ name: "maya.k", topics: ["AI"], score: 250 }] });
    renderApp({ storage: memoryStorage(saved) });
    expect(warn).toHaveBeenCalled();
    await openBlend();
    expect(previousBlends()).toHaveTextContent("83% match");
  });
});

describe("quick-send chips in Share", () => {
  it("send to someone you've blended with in one tap", async () => {
    renderApp();
    await feedTitles();
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    const share = screen.getByRole("region", { name: "Share this feed" });

    await userEvent.click(within(share).getByRole("button", { name: "Send to @maya.k" }));
    expect(share).toHaveTextContent("Sent to @maya.k");

    await userEvent.click(within(share).getByRole("button", { name: "Send to @maya.k" }));
    expect(within(share).getByRole("alert")).toHaveTextContent("Already sent to @maya.k");
  });
});
