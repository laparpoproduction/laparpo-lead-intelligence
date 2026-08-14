import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const staticDirectory = path.resolve(process.cwd(), ".next/static");
const forbidden = [
  "LAPARPO_AUTHENTICATED_E2E",
  "LAPARPO_E2E_AI_STUB",
  "LAPARPO_E2E_AI_STUB_CALLS_FILE",
  "DeterministicE2ECompanyIntelligenceProvider",
  "DeterministicE2EPipelineSummaryProvider",
  "SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "AI_IDENTITY_HMAC_SECRET",
  "AI_FEATURES_ENABLED",
];

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(target)));
    else files.push(target);
  }
  return files;
}

for (const file of await filesUnder(staticDirectory)) {
  const contents = await readFile(file, "utf8");
  for (const marker of forbidden) {
    if (contents.includes(marker)) {
      throw new Error(`Forbidden server marker found in browser bundle: ${marker}`);
    }
  }
}

console.log("Authenticated E2E browser-bundle boundary is clean.");
