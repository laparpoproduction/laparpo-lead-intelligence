import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  AI_STUB_CALLS_FILE,
  readAuthenticatedE2ERuntime,
} from "../../scripts/authenticated-e2e/runtime.mjs";
import { readAIStubCallCount } from "./database-helper.mjs";

test("shares one database actor budget across both AI endpoints", async ({
  page,
}, testInfo) => {
  const runtime = await readAuthenticatedE2ERuntime();
  const firstIndex = 4 + testInfo.retry * 2;
  const secondIndex = firstIndex + 1;
  const companyFirstUser = runtime.managementUsers[firstIndex];
  const pipelineFirstUser = runtime.managementUsers[secondIndex];
  const companyFirstFixture = runtime.rateLimitCompanies[firstIndex - 4];
  const pipelineFirstFixture = runtime.rateLimitCompanies[secondIndex - 4];
  if (
    !companyFirstUser ||
    !pipelineFirstUser ||
    !companyFirstFixture ||
    !pipelineFirstFixture
  ) {
    throw new Error("Missing retry-safe AI rate-limit endpoint fixtures");
  }

  await writeFile(AI_STUB_CALLS_FILE, "", { encoding: "utf8", mode: 0o600 });

  async function signIn(email: string, password: string) {
    await page.goto("/login");
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  }

  await signIn(companyFirstUser.email, companyFirstUser.password);
  await page.goto(`/companies/${companyFirstFixture.id}`);
  await page.getByRole("button", { name: "Generate AI intelligence" }).click();
  await expect(page.getByText("Recommendation ready")).toBeVisible();
  expect(await readAIStubCallCount()).toBe(1);

  await page.goto("/opportunities/pipeline");
  await page.getByRole("button", { name: "Summarize pipeline" }).click();
  await expect(
    page.getByText("Please wait before generating another AI summary."),
  ).toBeVisible();
  expect(await readAIStubCallCount()).toBe(1);

  await page.context().clearCookies();
  await signIn(pipelineFirstUser.email, pipelineFirstUser.password);
  await page.goto("/opportunities/pipeline");
  await page.getByRole("button", { name: "Summarize pipeline" }).click();
  await expect(page.getByText("Suggested review focus ready")).toBeVisible();
  expect(await readAIStubCallCount()).toBe(2);

  await page.goto(`/companies/${pipelineFirstFixture.id}`);
  await page.getByRole("button", { name: "Generate AI intelligence" }).click();
  await expect(
    page.getByText("Please wait before generating another recommendation."),
  ).toBeVisible();
  expect(await readAIStubCallCount()).toBe(2);
});
