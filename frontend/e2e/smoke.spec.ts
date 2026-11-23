import { expect, test, type Page } from "@playwright/test";

const settingsLine = (page: Page) => page.getByRole("group", { name: "Feed settings" });
const upNextCards = (page: Page) => page.getByRole("list", { name: "Up next" }).getByRole("heading", { level: 3 });
const lengthPhrase = (page: Page) => settingsLine(page).getByRole("button", { name: /^Video length/ });
const mostViewedTab = (page: Page) => page.getByRole("button", { name: "Most viewed, Explore feeds" });
const topicsPhrase = (page: Page) => settingsLine(page).getByRole("button", { name: /topics/ });

/** Opens the topics popup from the settings line and returns it. */
async function openTopics(page: Page) {
  await topicsPhrase(page).click();
  const popup = page.getByRole("dialog", { name: "Topics in this feed" });
  await expect(popup).toBeVisible();
  return popup;
}

test("a length range set on an Explore feed is still there after a reload", async ({ page }) => {
  await page.goto("/");
  await expect(upNextCards(page).first()).toBeVisible();

  await page.getByRole("button", { name: "Explore feeds" }).click();
  await page.getByRole("dialog", { name: "Explore feeds" }).getByRole("button", { name: /^Most viewed/ }).click();
  await expect(mostViewedTab(page)).toHaveAttribute("aria-current", "page");
  await expect(lengthPhrase(page)).toHaveAccessibleName("Video length, 1–120 min");

  await lengthPhrase(page).click();
  const popup = page.getByRole("dialog", { name: "Video length" });
  await popup.getByRole("spinbutton", { name: "Shortest video in minutes" }).fill("5");
  await popup.getByRole("spinbutton", { name: "Longest video in minutes" }).fill("30");
  await popup.getByRole("spinbutton", { name: "Longest video in minutes" }).press("Enter");
  await expect(lengthPhrase(page)).toHaveAccessibleName("Video length, 5–30 min");
  await expect(upNextCards(page).first()).toBeVisible();

  await page.reload();

  await expect(mostViewedTab(page)).toHaveAttribute("aria-current", "page");
  await expect(lengthPhrase(page)).toHaveAccessibleName("Video length, 5–30 min");
  await expect(upNextCards(page).first()).toBeVisible();
});

test("with no AI key, the keyword rules add Cooking from the Claude bar and undo takes it back", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Feeds" }).getByRole("button", { name: "Learn", exact: true }).click();
  await expect(upNextCards(page).first()).toBeVisible();
  const topicsBefore = (await topicsPhrase(page).textContent()) ?? "";
  await expect(await openTopics(page)).not.toContainText("Cooking");
  await page.keyboard.press("Escape");

  await page.getByRole("textbox", { name: "Tell Claude what to change" }).fill("add cooking");
  await page.getByRole("button", { name: "Send to Claude" }).click();

  const undo = page.getByRole("button", { name: /^Undo last change/ });
  await expect(undo).toBeVisible();
  await expect(topicsPhrase(page)).not.toHaveText(topicsBefore);
  await expect(await openTopics(page)).toContainText("Cooking");
  await page.keyboard.press("Escape");

  await undo.click();
  await expect(topicsPhrase(page)).toHaveText(topicsBefore);

  await expect(await openTopics(page)).not.toContainText("Cooking");
});

test("a request adds a recipe log line, a follow-up keeps it, undo greys the follow-up out and Clear log empties the log", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Feeds" }).getByRole("button", { name: "Learn", exact: true }).click();
  await expect(upNextCards(page).first()).toBeVisible();
  const bar = page.getByRole("textbox", { name: "Tell Claude what to change" });
  const log = page.getByRole("region", { name: "Recipe log" });

  await bar.fill("add cooking");
  await page.getByRole("button", { name: "Send to Claude" }).click();
  await expect(log.getByRole("listitem")).toHaveText(["add cooking → added Cooking"]);

  await bar.fill("shorter videos");
  await page.getByRole("button", { name: "Send to Claude" }).click();
  await expect(log.getByRole("listitem")).toHaveCount(2);
  await expect(log.getByRole("listitem").nth(1)).toHaveText(/^shorter videos → videos 1–15 min/);

  await page.getByRole("button", { name: /^Undo last change/ }).click();
  await expect(log.getByRole("listitem").nth(1)).toHaveText(/^Undone: shorter videos/);
  await expect(log.getByRole("listitem").first()).not.toHaveText(/Undone/);

  await page.reload();
  await expect(log.getByRole("listitem")).toHaveCount(2);
  await log.getByRole("button", { name: "Clear log" }).click();
  await expect(log).toHaveCount(0);
});

test("/about argues the design with live pieces, and links to and from the app", async ({ page }) => {
  await page.goto("/");
  await expect(upNextCards(page).first()).toBeVisible();
  await page.getByRole("link", { name: "About this design" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const recipe = page.getByRole("region", { name: "Live recipe", exact: true });
  await recipe.getByRole("textbox", { name: "Tell Claude what to change" }).fill("add cooking");
  await recipe.getByRole("button", { name: "Send to Claude" }).click();
  await expect(recipe.getByRole("region", { name: "Recipe log" }).getByRole("listitem")).toHaveText(["add cooking → added Cooking"]);

  const mirror = page.getByRole("region", { name: "Recipe mirror", exact: true });
  await expect(mirror).toContainText("You removed 3 Economics videos from this feed.");
  await mirror.getByRole("button", { name: "Remove Economics" }).click();
  await expect(recipe.getByRole("region", { name: "Recipe log" }).getByRole("listitem").nth(1)).toHaveText(/^Recipe mirror: Remove Economics/);

  await expect(page.getByRole("region", { name: "Live cards" })).toContainText(/Outside your recipe: .+, next to /);

  await page.reload();
  await expect(page.getByRole("region", { name: "Live cards" })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate<number>("document.documentElement.scrollWidth")).toBeLessThanOrEqual(375);

  await page.getByRole("link", { name: "Back to the app", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(upNextCards(page).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Recipe log" })).toHaveCount(0);
});
