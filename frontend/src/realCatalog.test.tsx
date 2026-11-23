import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CatalogLoader } from "./ports";
import { fakeAccount, SIGNED_IN, SIGNED_OUT } from "./test/account";
import { CATALOG, EVERYTHING_ORDER } from "./test/fixtures";
import { feedTitles, renderApp } from "./test/renderApp";

const EXPIRED = "Your YouTube access has expired. Sign out, then sign in with Google again.";
const UNAVAILABLE = "YouTube couldn't be reached. Try again in a minute.";

describe("the catalog's source", () => {
  it("is your YouTube when you're signed in", async () => {
    const loadCatalog = vi.fn<CatalogLoader>(async () => CATALOG);
    renderApp({ loadCatalog, account: fakeAccount({ status: SIGNED_IN }) });
    expect(await feedTitles()).toEqual(EVERYTHING_ORDER);
    expect(loadCatalog.mock.calls.map(([source]) => source)).toEqual(["youtube"]);
  });

  it("is the demo catalog when you're signed out or signing in isn't set up", async () => {
    const loadCatalog = vi.fn<CatalogLoader>(async () => CATALOG);
    renderApp({ loadCatalog, account: fakeAccount({ status: SIGNED_OUT }) });
    expect(await feedTitles()).toEqual(EVERYTHING_ORDER);
    expect(new Set(loadCatalog.mock.calls.map(([source]) => source))).toEqual(new Set(["demo"]));
  });
});

describe("when YouTube can't load your catalog", () => {
  it("says why and Retry loads it once YouTube is back", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const loadCatalog = vi.fn<CatalogLoader>().mockRejectedValueOnce(new Error(UNAVAILABLE)).mockResolvedValue(CATALOG);
    renderApp({ loadCatalog, account: fakeAccount({ status: SIGNED_IN }) });

    expect(await screen.findByRole("alert")).toHaveTextContent(UNAVAILABLE);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await feedTitles()).toEqual(EVERYTHING_ORDER);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("offers Sign out next to Retry when your access expired, both by keyboard", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const account = fakeAccount({ status: SIGNED_IN });
    renderApp({ loadCatalog: async () => Promise.reject(new Error(EXPIRED)), account });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(EXPIRED);
    const box = alert.parentElement as HTMLElement;
    within(box).getByRole("button", { name: "Retry" }).focus();
    await userEvent.tab();
    expect(within(box).getByRole("button", { name: "Sign out" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(account.calls.signOut).toBe(1);
  });
});
