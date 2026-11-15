import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CARDS_CATALOG, memoryStorage } from "./test/fixtures";
import { cardFor, feedTitles, renderApp, savedWithFilters, upNextList } from "./test/renderApp";

const layoutButton = (name: "One per row" | "Three per row") => screen.getByRole("button", { name });

describe("grid and list views", () => {
  it("opens in the grid view, switches to the list view, and keeps it after a reload", async () => {
    const storage = memoryStorage();
    const { unmount } = renderApp({ storage });
    await feedTitles();
    expect(layoutButton("Three per row")).toHaveAttribute("aria-pressed", "true");
    expect(layoutButton("One per row")).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(layoutButton("One per row"));
    expect(layoutButton("One per row")).toHaveAttribute("aria-pressed", "true");
    expect(layoutButton("Three per row")).toHaveAttribute("aria-pressed", "false");

    unmount();
    renderApp({ storage });
    await feedTitles();
    expect(layoutButton("One per row")).toHaveAttribute("aria-pressed", "true");
  });

  it("can be switched from the keyboard", async () => {
    renderApp();
    await feedTitles();
    layoutButton("One per row").focus();
    await userEvent.keyboard("{Enter}");
    expect(layoutButton("One per row")).toHaveAttribute("aria-pressed", "true");
  });
});

describe("thumbnails", () => {
  const catalog = async () => CARDS_CATALOG;

  it.each([
    ["Building a tiny database from scratch", ["BUILD A DATABASE", "from scratch"], "41:37"],
    ["A founder on burnout, ambition and starting over", ["BURNOUT", "starting over"], "1:35:25"],
    ["Graphs vs trees: when to use which", ["GRAPH", "TREE", "VS"], "18:36"],
  ])("shows the designed thumbnail for “%s” with its duration", async (title, captions, duration) => {
    renderApp({ loadCatalog: catalog });
    const card = await cardFor(title);
    for (const caption of captions) expect(within(card).getByText(caption)).toBeInTheDocument();
    expect(within(card).getByText(duration)).toBeInTheDocument();
  });

  it("falls back to the topic as the caption for a video with no design", async () => {
    renderApp({ loadCatalog: catalog });
    expect(within(await cardFor("Pruning roses in winter")).getByText("GARDENING")).toBeInTheDocument();
  });

  it("shows LIVE instead of a duration on a live clip", async () => {
    renderApp({ loadCatalog: catalog });
    const card = await cardFor("Live: storm update and travel disruption");
    expect(within(card).getByText("LIVE")).toBeInTheDocument();
    expect(within(card).queryByText(/^\d+:\d\d$/)).not.toBeInTheDocument();
  });

  it("uses the honest caption on a clickbait design while Honest titles is on", async () => {
    renderApp({ loadCatalog: catalog });
    const card = await cardFor("Planning your next five years");
    expect(within(card).getByText("YOUR 5-YEAR PLAN")).toBeInTheDocument();
    expect(within(card).queryByText("DON'T DO THIS")).not.toBeInTheDocument();
  });
});

describe("card details", () => {
  const catalog = async () => CARDS_CATALOG;
  const DATABASE = "Building a tiny database from scratch";

  it("show the channel, subscribers, topic and age, with view counts hidden in the starting example", async () => {
    renderApp({ loadCatalog: catalog });
    const card = await cardFor(DATABASE);
    expect(within(card).getByText("Byte Garden · 88K subs")).toBeInTheDocument();
    expect(within(card).getByText("Programming · 3 days ago")).toBeInTheDocument();
    expect(within(card).queryByText(/views/)).not.toBeInTheDocument();
  });

  it("show views too once Hide view counts is off", async () => {
    renderApp({ loadCatalog: catalog, storage: memoryStorage(await savedWithFilters({ hideViewCounts: false })) });
    expect(within(await cardFor(DATABASE)).getByText("Byte Garden · 88K subs · 1.9M views")).toBeInTheDocument();
  });
});

describe("descriptions", () => {
  const catalog = async () => CARDS_CATALOG;
  const DATABASE = "Building a tiny database from scratch";
  const descriptionButton = (card: HTMLElement) =>
    within(card).getByRole("button", { name: `Description of ${DATABASE}` });

  const expectFullDescription = (element: HTMLElement) => {
    expect(element).toHaveTextContent(`${DATABASE}.`);
    expect(element).toHaveTextContent("This is a programming video, so most of it is about trade-offs");
    expect(element).toHaveTextContent(
      "Chapters 0:00 Intro 8:12 Background 16:24 The main part 24:36 Key moments 32:48 Wrap-up",
    );
    expect(element).toHaveTextContent("New videos from Byte Garden every week. Subscribe for more Programming.");
  };

  it("opens in grid view as a full-width panel under the card's row, leaving the card as it was", async () => {
    renderApp({ loadCatalog: catalog });
    const card = await cardFor(DATABASE);
    const cardText = card.textContent;
    expect(descriptionButton(card)).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(descriptionButton(card));

    expect(descriptionButton(card)).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("region", { name: DATABASE });
    expectFullDescription(panel);
    expect(card.textContent).toBe(cardText);
    expect(card).not.toContainElement(panel);

    const items = within(await upNextList()).getAllByRole("listitem");
    const cards = items.filter((item) => item !== panel.closest("li"));
    const rowEnd = Math.min((Math.floor(cards.indexOf(card) / 3) + 1) * 3, cards.length);
    expect(items.indexOf(panel.closest("li")!)).toBe(rowEnd);
  });

  it("closes the grid panel from its Hide description button", async () => {
    renderApp({ loadCatalog: catalog });
    await userEvent.click(descriptionButton(await cardFor(DATABASE)));

    await userEvent.click(screen.getByRole("button", { name: "Hide description" }));

    expect(screen.queryByRole("region", { name: DATABASE })).not.toBeInTheDocument();
    expect(descriptionButton(await cardFor(DATABASE))).toHaveAttribute("aria-expanded", "false");
    expect(descriptionButton(await cardFor(DATABASE))).toHaveFocus();
  });

  it("opens inside the card in list view, from the keyboard too, and closes again", async () => {
    renderApp({ loadCatalog: catalog });
    await userEvent.click(await screen.findByRole("button", { name: "One per row" }));
    const card = await cardFor(DATABASE);
    expect(within(card).getByText("…more")).toBeInTheDocument();

    descriptionButton(card).focus();
    await userEvent.keyboard("{Enter}");

    expect(descriptionButton(card)).toHaveAttribute("aria-expanded", "true");
    expect(within(card).getByText("Show less")).toBeInTheDocument();
    expectFullDescription(card);
    expect(descriptionButton(card)).not.toHaveTextContent("Chapters");
    expect(screen.queryByRole("region", { name: DATABASE })).not.toBeInTheDocument();

    await userEvent.click(descriptionButton(card));
    expect(descriptionButton(card)).toHaveAttribute("aria-expanded", "false");
    expect(within(card).getByText("…more")).toBeInTheDocument();
  });
});
