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

  await expect(
    page.getByRole("heading", { name: "Companies", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("No companies yet")).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
});

test("renders the Companies create workflow on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/companies/new");

  await expect(page.getByRole("heading", { name: "Add company" })).toBeVisible();
  await expect(page.getByLabel("Display name")).toBeVisible();
  await expect(page.getByLabel("Legal name")).toBeVisible();
  await expect(page.getByLabel("Company type")).toBeVisible();
  await expect(page.getByLabel("Source URL")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create company" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Display name")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create company" })).toBeVisible();
});

test("returns not found for an unavailable company details route", async ({
  page,
}) => {
  const response = await page.goto(
    "/companies/22222222-2222-4222-8222-222222222222",
  );

  expect(response?.status()).toBe(404);
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});
