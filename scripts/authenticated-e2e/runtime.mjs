import { readFile } from "node:fs/promises";
import path from "node:path";

export const AUTHENTICATED_E2E_DIRECTORY = path.resolve(
  process.cwd(),
  ".tmp/authenticated-e2e",
);
export const SUPABASE_STATUS_FILE = path.join(
  AUTHENTICATED_E2E_DIRECTORY,
  "supabase.env",
);
export const AUTHENTICATED_E2E_RUNTIME_FILE = path.join(
  AUTHENTICATED_E2E_DIRECTORY,
  "runtime.json",
);
export const AI_STUB_CALLS_FILE = path.join(
  AUTHENTICATED_E2E_DIRECTORY,
  "ai-stub-calls.log",
);

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return JSON.parse(trimmed);
  }
  return trimmed;
}

export function parseSupabaseStatusEnv(contents) {
  const parsed = {};
  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) {
      throw new Error("Invalid local Supabase status format");
    }
    parsed[line.slice(0, separator)] = unquote(line.slice(separator + 1));
  }
  return parsed;
}

function requireLocalHttpUrl(value, label, expectedPort) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== String(expectedPort)
  ) {
    throw new Error(`${label} must target the disposable local stack`);
  }
  return url.toString().replace(/\/$/u, "");
}

function requireLocalDatabaseUrl(value) {
  const url = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "54322" ||
    url.pathname !== "/postgres"
  ) {
    throw new Error("Database URL must target the disposable local stack");
  }
  return value;
}

export function validateSupabaseStatus(status) {
  const apiUrl = status.API_URL ?? status.SUPABASE_URL;
  const anonKey = status.ANON_KEY ?? status.PUBLISHABLE_KEY;
  const serviceRoleKey = status.SERVICE_ROLE_KEY;
  const databaseUrl = status.DB_URL;

  if (!apiUrl || !anonKey || !serviceRoleKey || !databaseUrl) {
    throw new Error("Local Supabase status is missing required fixture values");
  }
  if (anonKey === serviceRoleKey) {
    throw new Error("Local Supabase public and service-role keys must differ");
  }

  return {
    apiUrl: requireLocalHttpUrl(apiUrl, "Supabase API URL", 54321),
    anonKey,
    serviceRoleKey,
    databaseUrl: requireLocalDatabaseUrl(databaseUrl),
  };
}

export async function readAuthenticatedE2ERuntime() {
  const parsed = JSON.parse(
    await readFile(AUTHENTICATED_E2E_RUNTIME_FILE, "utf8"),
  );
  const status = validateSupabaseStatus({
    API_URL: parsed.apiUrl,
    ANON_KEY: parsed.anonKey,
    SERVICE_ROLE_KEY: parsed.serviceRoleKey,
    DB_URL: parsed.databaseUrl,
  });
  if (
    !Array.isArray(parsed.managementUsers) ||
    parsed.managementUsers.length < 2 ||
    parsed.managementUsers.some(
      (user) =>
        typeof user?.id !== "string" ||
        typeof user?.email !== "string" ||
        typeof user?.password !== "string" ||
        user.password.length < 8,
    )
  ) {
    throw new Error("Authenticated E2E management fixture is invalid");
  }
  return {
    databaseUrl: status.databaseUrl,
    managementUsers: parsed.managementUsers,
  };
}
