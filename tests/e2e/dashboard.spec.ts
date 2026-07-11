import { expect, test } from "@playwright/test";

test("shows the Sprint 1 dashboard preview without local credentials", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Laparpo Lead Intelligence/);
  await expect(page.getByRole("heading", { name: "Sales overview" })).toBeVisible();
  await expect(page.getByText("Turn signals into conversations.")).toBeVisible();
  await expect(page.getByText("No qualified leads yet")).toBeVisible();
});
