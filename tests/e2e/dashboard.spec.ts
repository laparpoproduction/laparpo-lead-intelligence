import { expect, test } from "@playwright/test";

test("shows the Sprint 1 dashboard preview without local credentials", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Laparpo Lead Intelligence/);
  await expect(page.getByRole("heading", { name: "Lead Intelligence" })).toBeVisible();
  await expect(page.getByText("Turn signals into conversations.")).toBeVisible();
  await expect(page.getByText("New Leads", { exact: true })).toBeVisible();
  await expect(page.getByText("Hot Leads", { exact: true })).toBeVisible();
  await expect(page.getByText("Deposits", { exact: true })).toBeVisible();
  await expect(page.getByText("No qualified leads yet")).toBeVisible();
});

test("exposes protected foundation modules in preview mode", async ({ page }) => {
  await page.goto("/companies");

  await expect(page.getByRole("heading", { name: "Companies" })).toBeVisible();
  await expect(page.getByText("No companies yet")).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
});
