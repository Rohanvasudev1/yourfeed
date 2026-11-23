import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeFeed } from "./domain/feed";
import type { Feed } from "./domain/types";
import { toSaved, type SavedState } from "./state/persistence";
import { DEMO_SEED } from "./state/seed";
import { fakeAccount, NEW_USER, SIGNED_IN } from "./test/account";
import { memoryStorage } from "./test/fixtures";
import { feedTitles, renderApp } from "./test/renderApp";
import { fakeServerState } from "./test/serverState";

const INVALID = "Usernames are 3–20 letters, numbers, dots or underscores";
const TAKEN = "That username is taken. Try another.";
const OFFER = "Bring your demo feeds";

const usernameForm = () => screen.findByRole("form", { name: "Choose a username" });
const usernameBox = () => screen.getByRole("textbox", { name: "Username" });
const saveUsername = () => screen.getByRole("button", { name: "Save username" });
const offer = () => screen.queryByRole("region", { name: OFFER });

async function chooseUsername(typed: string) {
  await userEvent.clear(usernameBox());
  await userEvent.type(usernameBox(), typed);
  await userEvent.click(saveUsername());
}

async function accountMenuText() {
  await userEvent.click(screen.getByRole("button", { name: "Your account" }));
  return screen.getByRole("dialog", { name: "Your account" }).textContent;
}

/** The browser's demo state with the visitor's own feeds added to the starting example. */
const demoStateWith = (...feeds: Feed[]) => memoryStorage(toSaved({ ...DEMO_SEED, feeds: [...DEMO_SEED.feeds, ...feeds] }));

const savedFeed = (saved: unknown, name: string) => (saved as SavedState).state.feeds.find((f) => f.name === name);

describe("choosing a username at first sign-in", () => {
  it("asks a new account for a username before showing the app, then shows @username in the account menu", async () => {
    const account = fakeAccount({ status: NEW_USER });
    renderApp({ account });

    await usernameForm();
    expect(screen.queryByRole("list", { name: "Up next" })).not.toBeInTheDocument();
    await chooseUsername("@Rohan.V");

    await feedTitles();
    expect(account.calls.chooseUsername).toEqual(["rohan.v"]);
    expect(await accountMenuText()).toContain("@rohan.v");
  });

  it("says when a username breaks the rules, without asking the server", async () => {
    const account = fakeAccount({ status: NEW_USER });
    renderApp({ account });
    await usernameForm();

    await chooseUsername("no spaces");
    expect(await screen.findByText(INVALID)).toBeInTheDocument();
    expect(account.calls.chooseUsername).toEqual([]);
    expect(usernameBox()).toHaveAttribute("aria-invalid", "true");
  });

  it("says when someone else has the username, and takes another", async () => {
    const account = fakeAccount({ status: NEW_USER, takenUsernames: ["maya.k"] });
    renderApp({ account });
    await usernameForm();

    await chooseUsername("maya.k");
    expect(await screen.findByText(TAKEN)).toBeInTheDocument();
    await chooseUsername("maya.kim");
    await feedTitles();
    expect(await accountMenuText()).toContain("@maya.kim");
  });

  it("says when the username couldn't be saved, and keeps what was typed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderApp({ account: fakeAccount({ status: NEW_USER, chooseUsername: new Error("The server answered 503.") }) });
    await usernameForm();

    await chooseUsername("maya.k");
    expect(await screen.findByText("Couldn't save your username. Try again.")).toBeInTheDocument();
    expect(usernameBox()).toHaveValue("maya.k");
  });

  it("puts focus in the username box, and Enter saves", async () => {
    renderApp({ account: fakeAccount({ status: NEW_USER }) });
    await usernameForm();

    expect(usernameBox()).toHaveFocus();
    await userEvent.keyboard("maya.k{Enter}");
    await feedTitles();
  });

  it("can sign out instead", async () => {
    const account = fakeAccount({ status: NEW_USER });
    renderApp({ account });
    await usernameForm();

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(account.calls.signOut).toBe(1));
    await feedTitles();
  });

  it("isn't asked for in demo mode, where the menu still shows the demo account", async () => {
    renderApp();
    await feedTitles();
    expect(screen.queryByRole("form", { name: "Choose a username" })).not.toBeInTheDocument();
    expect(offer()).not.toBeInTheDocument();
    expect(await accountMenuText()).toContain("@you · demo account");
  });
});

describe("Bring your demo feeds", () => {
  const knitting = makeFeed({ name: "Knitting club", topics: ["Knitting"] });
  const jazz = makeFeed({ name: "Jazz nights", topics: ["AI", "Knitting"], length: [5, 15], session: [10, 30], color: 1, muted: ["Gardening"] });

  it("is offered to a new account, and copies the demo feeds' names, ranges and the topics the real catalog has", async () => {
    const server = fakeServerState();
    renderApp({ account: fakeAccount({ status: SIGNED_IN }), storage: demoStateWith(jazz, knitting), serverState: server });

    const region = await screen.findByRole("region", { name: OFFER });
    expect(region).toHaveTextContent("Copy Learn, Jazz nights into your account");
    await userEvent.click(within(region).getByRole("button", { name: OFFER }));

    expect(offer()).not.toBeInTheDocument();
    await waitFor(() => expect(savedFeed(server.saved(), "Jazz nights")).toBeDefined());
    const brought = savedFeed(server.saved(), "Jazz nights");
    expect(brought).toMatchObject({ kind: "topics", topics: ["AI"], length: [5, 15], session: [10, 30], muted: [] });
    // A feed the starting example also has takes the demo's recipe: Learn's demo topics aren't in this catalog.
    expect(savedFeed(server.saved(), "Learn")).toMatchObject({ topics: ["AI"] });
    expect(screen.getAllByText("Jazz nights").length).toBeGreaterThan(0);
    // None of its topics is in the catalog, so it would show nothing; Sport's demo topics aren't either, so it keeps its own.
    expect(savedFeed(server.saved(), "Knitting club")).toBeUndefined();
    expect(savedFeed(server.saved(), "Sport")).toEqual(DEMO_SEED.feeds.find((f) => f.name === "Sport"));
  });

  it("isn't offered when this browser never saved a demo", async () => {
    renderApp({ account: fakeAccount({ status: SIGNED_IN }), storage: memoryStorage() });
    await feedTitles();
    expect(offer()).not.toBeInTheDocument();
  });

  it("brings nothing on No thanks, and is offered only once", async () => {
    const server = fakeServerState();
    const storage = demoStateWith(jazz);
    const first = renderApp({ account: fakeAccount({ status: SIGNED_IN }), storage, serverState: server });

    const region = await screen.findByRole("region", { name: OFFER });
    await userEvent.click(within(region).getByRole("button", { name: "No thanks" }));
    expect(offer()).not.toBeInTheDocument();
    await waitFor(() => expect((server.saved() as SavedState | null)?.state.demoFeedsOffered).toBe(true));
    expect(savedFeed(server.saved(), "Jazz nights")).toBeUndefined();
    first.unmount();

    renderApp({ account: fakeAccount({ status: SIGNED_IN }), storage, serverState: server });
    await feedTitles();
    expect(offer()).not.toBeInTheDocument();
  });

  it("isn't offered to an account saved before the offer existed", async () => {
    const { demoFeedsOffered: _, ...older } = DEMO_SEED;
    renderApp({ account: fakeAccount({ status: SIGNED_IN }), serverState: fakeServerState(toSaved(older as typeof DEMO_SEED)) });
    await feedTitles();
    expect(offer()).not.toBeInTheDocument();
  });

  it("waits for the username first", async () => {
    renderApp({ account: fakeAccount({ status: NEW_USER }), storage: demoStateWith(jazz) });
    await usernameForm();
    expect(offer()).not.toBeInTheDocument();
    await chooseUsername("maya.k");
    expect(await screen.findByRole("region", { name: OFFER })).toBeInTheDocument();
  });

  it("isn't offered in demo mode", async () => {
    renderApp({ storage: demoStateWith(jazz) });
    await feedTitles();
    expect(offer()).not.toBeInTheDocument();
  });
});
