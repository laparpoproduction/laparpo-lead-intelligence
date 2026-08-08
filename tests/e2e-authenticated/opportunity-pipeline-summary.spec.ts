import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  AI_STUB_CALLS_FILE,
  readAuthenticatedE2ERuntime,
} from "../../scripts/authenticated-e2e/runtime.mjs";
import {
  readAIStubCallCount,
  readPipelineAIStubObservations,
  readPipelineFixtureState,
  readRepresentativePipelineState,
} from "./database-helper.mjs";

test.describe.configure({ mode: "serial" });

test("summarizes only authorized pipeline metadata without mutation or persistence", async ({
  page,
}, testInfo) => {
  const runtime = await readAuthenticatedE2ERuntime();
  const user = runtime.managementUsers[testInfo.retry + 2];
  if (!user) throw new Error("Missing retry-safe management fixture");
  const fixtures = runtime.pipelineFixtures;
  const fixtureIds = Object.values(fixtures).map(
    (fixture) => fixture.opportunityId,
  );
  await writeFile(AI_STUB_CALLS_FILE, "", { encoding: "utf8", mode: 0o600 });
  const before = await readPipelineFixtureState(fixtureIds);
  expect(before.opportunities).toHaveLength(4);
  expect(await readAIStubCallCount()).toBe(0);

  const unexpectedOpenAIRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).hostname.endsWith("openai.com")) {
      unexpectedOpenAIRequests.push(request.url());
    }
  });

  await page.goto("/login");
  await page.getByLabel("Work email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/opportunities/pipeline");
  await expect(
    page.getByRole("heading", { name: "Opportunity Pipeline" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "AI Pipeline Summary" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "AI pipeline summary result" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Summarize pipeline" }).click();
  await expect(page.getByText("Suggested review focus ready")).toBeVisible();
  const result = page.getByRole("region", {
    name: "AI pipeline summary result",
  });
  await expect(result).toBeVisible();
  await expect(
    result.getByRole("heading", {
      name: "Expected-close dates that have passed",
    }),
  ).toBeVisible();
  await expect(
    result.getByRole("heading", { name: "Unassigned active Opportunities" }),
  ).toBeVisible();
  await expect(
    result.getByRole("heading", { name: "Quotation follow-up" }),
  ).toBeVisible();
  await expect(
    result.getByRole("link", { name: fixtures.overdue.title, exact: true }).first(),
  ).toBeVisible();
  await expect(
    result
      .getByRole("link", { name: fixtures.unassigned.title, exact: true })
      .first(),
  ).toBeVisible();
  await expect(result.getByText(fixtures.archived.title, { exact: true })).toHaveCount(0);
  await expect(result.getByText(fixtures.won.title, { exact: true })).toHaveCount(0);
  await expect(result.getByRole("button")).toHaveCount(0);
  expect(await readAIStubCallCount()).toBe(1);

  const after = await readPipelineFixtureState(fixtureIds);
  expect(after).toEqual(before);
  expect(unexpectedOpenAIRequests).toEqual([]);

  await page.reload();
  await expect(
    page.getByRole("region", { name: "AI pipeline summary result" }),
  ).toHaveCount(0);
  await expect(page.getByText("Suggested review focus ready")).toHaveCount(0);
  expect(await readAIStubCallCount()).toBe(1);
});

test("L/M proves representative RLS and category-aware 75-of-120 coverage", async ({
  page,
}, testInfo) => {
  const runtime = await readAuthenticatedE2ERuntime();
  const representative = runtime.representativeUsers[testInfo.retry];
  const fixtures = runtime.representativePipelineFixtures[testInfo.retry];
  if (!representative || !fixtures) {
    throw new Error("Missing retry-safe representative pipeline fixture");
  }
  await writeFile(AI_STUB_CALLS_FILE, "", { encoding: "utf8", mode: 0o600 });
  const before = await readRepresentativePipelineState(representative.id);
  expect(before).toMatchObject({
    totalCount: 122,
    activeCount: 120,
    stageCounts: fixtures.expectedStageCounts,
  });
  expect(await readAIStubCallCount()).toBe(0);

  const unexpectedOpenAIRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).hostname.endsWith("openai.com")) {
      unexpectedOpenAIRequests.push(request.url());
    }
  });

  await page.goto("/login");
  await page.getByLabel("Work email").fill(representative.email);
  await page.getByLabel("Password").fill(representative.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/opportunities/pipeline");
  await page.getByRole("button", { name: "Summarize pipeline" }).click();
  await expect(page.getByText("Suggested review focus ready")).toBeVisible();
  const result = page.getByRole("region", {
    name: "AI pipeline summary result",
  });
  await expect(result).toBeVisible();
  await expect(
    result.getByText(
      "This AI-assisted summary covers a bounded portion of your accessible active Opportunities. Review the grounded items below without treating this sample as complete pipeline coverage.",
    ),
  ).toBeVisible();
  await expect(
    result.getByText(/Analyzed 75 of 120 accessible active Opportunities/),
  ).toBeVisible();
  await expect(
    result.getByText(
      "This is a bounded category-aware analysis and may not include every Opportunity that needs attention.",
    ),
  ).toBeVisible();
  await expect(
    result.getByText(
      "For large pipelines, configured attention categories are prioritized before older remaining items.",
    ),
  ).toBeVisible();

  for (const key of ["overdue", "unassigned", "quotation"] as const) {
    await expect(
      result
        .getByRole("link", {
          name: fixtures.categories[key].title,
          exact: true,
        })
        .first(),
    ).toBeVisible();
  }
  await expect(
    result.getByText(fixtures.inaccessible.title, { exact: true }),
  ).toHaveCount(0);
  await expect(result.getByText(fixtures.won.title, { exact: true })).toHaveCount(
    0,
  );
  await expect(result.getByText(fixtures.lost.title, { exact: true })).toHaveCount(
    0,
  );
  await expect(result.getByText(/These are all/iu)).toHaveCount(0);
  await expect(result.getByText(/No unassigned Opportunities exist/iu)).toHaveCount(
    0,
  );

  const observations = await readPipelineAIStubObservations();
  expect(observations).toEqual([
    {
      type: "pipeline-summary",
      activeOpportunityCount: 120,
      analyzedCandidateCount: 75,
      stageCounts: fixtures.expectedStageCounts,
      attentionCodes: [
        "missing_expected_close",
        "negotiation_follow_up",
        "overdue_expected_close",
        "quotation_follow_up",
        "review_probability_override",
        "unassigned_active",
      ],
    },
  ]);
  expect(await readAIStubCallCount()).toBe(1);
  expect(await readRepresentativePipelineState(representative.id)).toEqual(
    before,
  );
  expect(unexpectedOpenAIRequests).toEqual([]);

  await page.reload();
  await expect(
    page.getByRole("region", { name: "AI pipeline summary result" }),
  ).toHaveCount(0);
  expect(await readAIStubCallCount()).toBe(1);
});
