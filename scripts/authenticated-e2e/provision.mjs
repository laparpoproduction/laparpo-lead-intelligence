import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import {
  AI_STUB_CALLS_FILE,
  AUTHENTICATED_E2E_DIRECTORY,
  AUTHENTICATED_E2E_RUNTIME_FILE,
  SUPABASE_STATUS_FILE,
  parseSupabaseStatusEnv,
  validateSupabaseStatus,
} from "./runtime.mjs";

function runOwnerSql(databaseUrl, sql, variables = {}) {
  const args = ["-X", "-v", "ON_ERROR_STOP=1", "--dbname", databaseUrl];
  for (const [name, value] of Object.entries(variables)) {
    args.push(`--set=${name}=${value}`);
  }
  args.push("--file=-");
  const result = spawnSync("psql", args, {
    encoding: "utf8",
    input: sql,
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error("Disposable database fixture setup failed");
  }
}

async function main() {
  if (process.env.LAPARPO_AUTHENTICATED_E2E !== "true") {
    throw new Error("Authenticated E2E fixture setup requires explicit opt-in");
  }
  const correlationSecret = process.env.MUTATION_AUDIT_CORRELATION_SECRET;
  if (!correlationSecret || correlationSecret.trim().length < 32) {
    throw new Error("Authenticated E2E correlation secret is not configured");
  }

  const status = validateSupabaseStatus(
    parseSupabaseStatusEnv(await readFile(SUPABASE_STATUS_FILE, "utf8")),
  );

  const migrationVersions = (await readdir("supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => name.split("_", 1)[0]);
  if (migrationVersions.length !== 23) {
    throw new Error("Authenticated E2E migration inventory is invalid");
  }
  runOwnerSql(
    status.databaseUrl,
    `
      select 1 / ((
        select string_agg(version, ',' order by version)
        from supabase_migrations.schema_migrations
      ) = :'expected_versions')::integer;
    `,
    { expected_versions: migrationVersions.join(",") },
  );

  runOwnerSql(
    status.databaseUrl,
    `
      insert into mutation_audit_private.mutation_correlation_secret (
        singleton,
        secret
      ) values (true, :'correlation_secret')
      on conflict (singleton) do update set secret = excluded.secret;
    `,
    { correlation_secret: correlationSecret },
  );

  const admin = createClient(status.apiUrl, status.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const runIdentity = `${process.env.GITHUB_RUN_ID ?? "local"}-${randomUUID()}`;
  const managementUsers = [];
  for (const retryIndex of [0, 1]) {
    const email = `test010-management-${retryIndex}-${runIdentity}@example.test`;
    const password = `${randomBytes(24).toString("base64url")}aA1!`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "TEST-010 Management" },
    });
    if (error || !data.user) {
      throw new Error("Disposable Auth fixture creation failed");
    }

    runOwnerSql(
      status.databaseUrl,
      `
        update public.profiles
        set role = 'ceo_admin', is_active = true, email = :'management_email'
        where id = :'management_id'::uuid;

        select 1 / (count(*) = 1)::integer
        from public.profiles
        where id = :'management_id'::uuid
          and role = 'ceo_admin'
          and is_active = true;
      `,
      {
        management_id: data.user.id,
        management_email: email,
      },
    );
    managementUsers.push({ id: data.user.id, email, password });
  }

  await mkdir(AUTHENTICATED_E2E_DIRECTORY, { recursive: true });
  await writeFile(AI_STUB_CALLS_FILE, "", { encoding: "utf8", mode: 0o600 });
  await writeFile(
    AUTHENTICATED_E2E_RUNTIME_FILE,
    JSON.stringify({
      ...status,
      managementUsers,
      serverSecrets: {
        companyConfirmation: randomBytes(32).toString("base64url"),
        contactConfirmation: randomBytes(32).toString("base64url"),
        leadConfirmation: randomBytes(32).toString("base64url"),
        mutationAuditCorrelation: correlationSecret,
      },
    }),
    { encoding: "utf8", mode: 0o600 },
  );
}

await main();
