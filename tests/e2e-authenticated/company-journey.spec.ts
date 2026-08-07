import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  AI_STUB_CALLS_FILE,
  readAuthenticatedE2ERuntime,
} from "../../scripts/authenticated-e2e/runtime.mjs";
import {
  readAIStubCallCount,
  readAuditBoundaryPrivileges,
  readCompanyAudit,
  readCompanyDescendantCounts,
  readCreatedCompany,
} from "./database-helper.mjs";

test.describe.configure({ mode: "serial" });

test("uses real auth, RLS, Company actions, H7 audit and transient AI", async ({
  context,
  page,
}, testInfo) => {
  const runtime = await readAuthenticatedE2ERuntime();
  const managementUser = runtime.managementUsers[testInfo.retry];
  if (!managementUser) throw new Error("Missing retry-safe management fixture");
  await writeFile(AI_STUB_CALLS_FILE, "", { encoding: "utf8", mode: 0o600 });
  const initialAIStubCallCount = await readAIStubCallCount();
  expect(initialAIStubCallCount).toBe(0);
  const suffix = [
    process.env.GITHUB_RUN_ID ?? "local",
    process.env.GITHUB_RUN_ATTEMPT ?? "1",
    testInfo.retry,
    randomUUID().slice(0, 8),
  ].join("-");
  const displayName = `TEST-010 F&B ${suffix}`;
  const legalName = `${displayName} Sdn Bhd`;
  const websiteUrl = `https://example.test/company-${suffix}`;
  const sourceUrl = `https://directory.example.test/company-${suffix}`;
  const unexpectedOpenAIRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).hostname.endsWith("openai.com")) {
      unexpectedOpenAIRequests.push(request.url());
    }
  });

  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Sign in to your workspace" }),
  ).toBeVisible();
  await expect(page.getByText("Demo preview", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/read-only/i)).toHaveCount(0);

  await page.getByLabel("Work email").fill(managementUser.email);
  await page.getByLabel("Password").fill(managementUser.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { name: "Turn signals into conversations." }),
  ).toBeVisible();
  await expect(
    page.getByText("TEST-010 Management", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Demo preview/i)).toHaveCount(0);
  expect(
    (await context.cookies()).some((cookie) =>
      cookie.name.includes("auth-token"),
    ),
  ).toBe(true);
  const browserStorage = JSON.stringify(await context.storageState());
  expect(browserStorage).not.toContain(runtime.databaseUrl);
  expect(browserStorage).not.toContain(managementUser.password);

  const captureRetryTrace = testInfo.retry === 1;
  if (captureRetryTrace) {
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
  }

  try {
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Turn signals into conversations." }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Companies" }).click();
    await expect(page).toHaveURL("/companies");
    await page.getByRole("link", { name: "Add company" }).click();
    await expect(page).toHaveURL("/companies/new");

    await page.getByLabel("Display name").fill(displayName);
    await page.getByLabel("Legal name").fill(legalName);
    await page.getByLabel("Company type").selectOption("fnb");
    await page.getByLabel("Industry").fill("Food & Beverage");
    await page.getByLabel("Estimated branches").fill("4");
    await page
      .getByLabel("Description")
      .fill(
        "Synthetic public F&B profile for authenticated TEST-010 coverage.",
      );
    await page.getByLabel("Website URL").fill(websiteUrl);
    await page.getByLabel("City").fill("George Town");
    await page.getByLabel("State").fill("Penang");
    await page.getByLabel("Country code").fill("MY");
    await page.getByLabel("Source URL").fill(sourceUrl);
    await page.getByLabel("Source type").fill("synthetic_public_directory");
    await page.getByRole("button", { name: "Create company" }).click();

    await expect(page).toHaveURL("/companies");
    const companiesTable = page.getByRole("table", {
      name: "Companies in the Laparpo CRM",
    });
    await expect(
      companiesTable.getByText(displayName, { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      companiesTable.getByText(displayName, { exact: true }),
    ).toBeVisible();

    const createdRows = await readCreatedCompany(displayName);
    expect(createdRows).toHaveLength(1);
    const created = createdRows[0];
    expect(created).toMatchObject({
      legal_name: legalName,
      display_name: displayName,
      company_type: "fnb",
      industry: "Food & Beverage",
      city: "George Town",
      state: "Penang",
      country: "MY",
      estimated_branch_count: 4,
      website_url: websiteUrl,
      source_url: sourceUrl,
      source_type: "synthetic_public_directory",
      created_by: managementUser.id,
      deleted_at: null,
    });
    expect(created.created_at).toBeTruthy();
    expect(created.updated_at).toBeTruthy();
    expect(await readCompanyDescendantCounts(created.id)).toEqual({
      contacts: 0,
      leads: 0,
    });

    const createAudit = await readCompanyAudit(created.id);
    expect(createAudit).toHaveLength(1);
    expect(createAudit[0]).toMatchObject({
      actor_id: managementUser.id,
      actor_role: "ceo_admin",
      resource_type: "company",
      resource_id: created.id,
      operation: "create",
      application_operation: "create_company",
      source: "application",
    });
    expect(createAudit[0].request_id).toBeTruthy();
    expect(createAudit[0].changed_fields).toEqual(
      expect.arrayContaining(["created_by", "display_name", "source_url"]),
    );
    const syntheticCompanyValues = [
      displayName,
      legalName,
      websiteUrl,
      sourceUrl,
      "Synthetic public F&B profile for authenticated TEST-010 coverage.",
      "George Town",
    ];
    for (const value of syntheticCompanyValues) {
      expect(JSON.stringify(createAudit[0].changed_fields)).not.toContain(value);
    }
    expect(await readAuditBoundaryPrivileges()).toEqual({
      anon: false,
      authenticated: false,
      serviceRole: false,
    });

    await companiesTable
      .getByRole("link", { name: `View ${displayName} details` })
      .click();
    const detailsUrl = `/companies/${created.id}`;
    await expect(page).toHaveURL(detailsUrl);
    await expect(
      page.getByRole("heading", { name: displayName, exact: true }),
    ).toBeVisible();
    await expect(page.getByText(legalName, { exact: true })).toBeVisible();
    await expect(
      page.getByText("Food & Beverage", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("George Town, Penang, MY", { exact: true }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Generate AI intelligence" })
      .click();
    await expect(page.getByText("Recommendation ready")).toBeVisible();
    await expect(page.getByText("AI-assisted", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Recommendation only — no CRM data will be changed."),
    ).toBeVisible();
    await expect(
      page.getByText("AI recommendation generated. No CRM data was changed."),
    ).toBeVisible();
    const intelligence = page.getByRole("region", {
      name: "Company intelligence recommendation",
    });
    await expect(intelligence).toBeVisible();
    await expect(intelligence.getByText("Confidence: Medium")).toBeVisible();
    await expect(intelligence.getByText(/Confidence: High/i)).toHaveCount(0);
    await expect(
      intelligence.getByText(
        "The supplied Company type identifies an F&B business profile.",
      ),
    ).toBeVisible();
    await expect(intelligence.getByRole("link")).toHaveCount(0);
    await expect(intelligence.getByText(/https?:\/\//i)).toHaveCount(0);
    await expect(
      intelligence.getByText(/call|delete|create an opportunity/i),
    ).toHaveCount(0);
    expect(await readAIStubCallCount()).toBe(initialAIStubCallCount + 1);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(intelligence).toBeVisible();
    expect(
      await intelligence.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);

    await page.reload();
    await expect(
      page.getByRole("region", { name: "Company intelligence recommendation" }),
    ).toHaveCount(0);
    await expect(page.getByText("Recommendation ready")).toHaveCount(0);
    expect(await readAIStubCallCount()).toBe(initialAIStubCallCount + 1);

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/companies");
    const companyRow = page
      .getByRole("row")
      .filter({ hasText: displayName });
    await companyRow
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: `Delete ${displayName}?` }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Delete company" }).click();
    await expect(page).toHaveURL("/companies");
    await expect(page.getByText(displayName, { exact: true })).toHaveCount(0);

    const archivedRows = await readCreatedCompany(displayName);
    expect(archivedRows).toHaveLength(1);
    expect(archivedRows[0].id).toBe(created.id);
    expect(archivedRows[0].deleted_at).toBeTruthy();
    expect(archivedRows[0].created_by).toBe(created.created_by);
    expect(archivedRows[0].created_at).toBe(created.created_at);
    expect(await readCompanyDescendantCounts(created.id)).toEqual({
      contacts: 0,
      leads: 0,
    });

    const finalAudit = await readCompanyAudit(created.id);
    expect(finalAudit).toHaveLength(2);
    expect(finalAudit.map((event) => event.id)).toEqual(
      expect.arrayContaining([createAudit[0].id]),
    );
    expect(finalAudit[1]).toMatchObject({
      actor_id: managementUser.id,
      actor_role: "ceo_admin",
      resource_id: created.id,
      operation: "archive",
      application_operation: "archive_company",
      source: "application",
    });
    expect(finalAudit[1].request_id).toBeTruthy();
    expect(finalAudit[1].changed_fields).toEqual(
      expect.arrayContaining(["deleted_at"]),
    );
    expect(finalAudit[1].request_id).not.toBe(createAudit[0].request_id);
    for (const event of finalAudit) {
      expect(
        event.changed_fields.every((field) => /^[a-z][a-z0-9_]*$/u.test(field)),
      ).toBe(true);
    }
    for (const value of syntheticCompanyValues) {
      expect(JSON.stringify(finalAudit)).not.toContain(value);
    }

    await page.goto(detailsUrl);
    await expect(
      page.getByRole("heading", { name: "Company not found" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/login");
    await expect(
      page.getByRole("heading", { name: "Sign in to your workspace" }),
    ).toBeVisible();
    await page.goto("/companies");
    await expect(page).toHaveURL("/login");
    expect(unexpectedOpenAIRequests).toEqual([]);
  } finally {
    if (captureRetryTrace) {
      await context.tracing.stop({ path: testInfo.outputPath("trace.zip") });
    }
  }
});
