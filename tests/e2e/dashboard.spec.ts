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
  await expect(page.getByRole("searchbox", { name: "Search companies" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply filters" })).toBeVisible();
  await expect(page.getByText("No companies yet")).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
});

test("drives Companies search and filters through canonical URL state", async ({
  page,
}) => {
  await page.goto("/companies");

  await page.getByRole("searchbox", { name: "Search companies" }).fill("Acme");
  await page.getByRole("combobox", { name: "Company type" }).selectOption("agency");
  await page.getByRole("textbox", { name: "City" }).fill("George Town");
  await page.getByRole("combobox", { name: "Sort by" }).selectOption("displayName");
  await page.getByRole("combobox", { name: "Direction" }).selectOption("asc");
  await page.getByRole("button", { name: "Apply filters" }).click();

  await expect(page).toHaveURL(
    "/companies?q=Acme&companyType=agency&city=George+Town&sortBy=displayName&sortDirection=asc",
  );
  await expect(page.getByText("No matching companies")).toBeVisible();

  await page.getByRole("link", { name: "Clear all filters" }).first().click();
  await expect(page).toHaveURL(
    "/companies?sortBy=displayName&sortDirection=asc",
  );
  await expect(page.getByText("No companies yet")).toBeVisible();
});

test("normalizes invalid Companies queries and keeps mobile filters usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    "/companies?q=%20&companyType=invalid&sortBy=fingerprint&sortDirection=sideways&page=-2",
  );

  await expect(page).toHaveURL("/companies");
  await expect(page.getByRole("searchbox", { name: "Search companies" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Company type" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Industry" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "City" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "State" })).toBeVisible();

  await page.goto("/companies?page=999");
  await expect(page).toHaveURL("/companies");
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
  const companyDetailsUrl =
    "/companies/22222222-2222-4222-8222-222222222222";
  await page.goto(companyDetailsUrl);

  await expect(page).toHaveURL(companyDetailsUrl);
  await expect(
    page.getByRole("heading", { name: "Company not found" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Companies" })).toBeVisible();
  await expect(page.getByText("Workspace ready")).toHaveCount(0);
});

test("opens the bounded Contacts list and empty create path", async ({ page }) => {
  await page.goto("/contacts");

  await expect(
    page.getByRole("heading", { name: "Contacts", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("No contacts yet")).toBeVisible();
  await expect(page.getByRole("link", { name: "Add contact" })).toHaveAttribute(
    "href",
    "/contacts/new",
  );
  await page.getByRole("link", { name: "Add contact" }).click();
  await expect(page).toHaveURL("/contacts/new");
  await expect(page.getByRole("heading", { name: "Add contact" })).toBeVisible();
});

test("renders the Contacts create workflow on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/contacts/new");

  await expect(page.getByLabel("Full name")).toBeVisible();
  await expect(page.getByLabel("Work email")).toBeVisible();
  await expect(page.getByLabel("WhatsApp phone")).toBeVisible();
  await expect(page.getByLabel("Contact status")).toHaveValue("discovered");
  await expect(page.getByLabel("Source URL")).toBeVisible();
  await expect(page.getByLabel("Discovered at")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create contact" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Full name")).toBeVisible();
  await expect(page.getByLabel("Company ID")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Source provenance" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Create contact" })).toBeVisible();
});

test("returns not found for an inaccessible Contact details route", async ({
  page,
}) => {
  const contactDetailsUrl = "/contacts/22222222-2222-4222-8222-222222222222";
  await page.goto(contactDetailsUrl);

  await expect(page).toHaveURL(contactDetailsUrl);
  await expect(page.getByRole("heading", { name: "Contact not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Contacts" })).toBeVisible();
  await expect(page.getByText("Contact workspace ready")).toHaveCount(0);
});
