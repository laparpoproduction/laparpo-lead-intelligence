import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  AI_STUB_CALLS_FILE,
  readAuthenticatedE2ERuntime,
} from "../../scripts/authenticated-e2e/runtime.mjs";
import {
  readAIStubCallCount,
  readPipelineFixtureState,
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
