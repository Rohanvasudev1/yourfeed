import { expect, test, type Page } from "@playwright/test";

const settingsLine = (page: Page) => page.getByRole("group", { name: "Feed settings" });
const upNextCards = (page: Page) => page.getByRole("list", { name: "Up next" }).getByRole("heading", { level: 3 });
const lengthPhrase = (page: Page) => settingsLine(page).getByRole("button", { name: /^Video length/ });
const mostViewedTab = (page: Page) => page.getByRole("button", { name: "Most viewed, Explore feeds" });

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
