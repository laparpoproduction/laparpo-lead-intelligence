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
  // Two retry-safe identities per authenticated browser journey avoid the
  // shared actor limiter coupling otherwise-independent serial tests.
  for (const retryIndex of [0, 1, 2, 3]) {
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

  const pipelineFixtures = {
    overdue: {
      leadId: randomUUID(),
      opportunityId: randomUUID(),
      title: `AI-1B Overdue quotation ${runIdentity}`,
    },
    unassigned: {
      leadId: randomUUID(),
      opportunityId: randomUUID(),
      title: `AI-1B Unassigned negotiation ${runIdentity}`,
    },
    won: {
      leadId: randomUUID(),
      opportunityId: randomUUID(),
      title: `AI-1B Won aggregate ${runIdentity}`,
    },
    archived: {
      leadId: randomUUID(),
      opportunityId: randomUUID(),
      title: `AI-1B ARCHIVED FORBIDDEN ${runIdentity}`,
    },
  };
  runOwnerSql(
    status.databaseUrl,
    `
      insert into public.leads (
        id, title, stage, lead_status, created_by, assigned_to,
        source_type, discovered_at, service_interest
      ) values
        (
          :'overdue_lead_id'::uuid, :'overdue_title', 'qualified', 'active',
          :'actor_id'::uuid, :'actor_id'::uuid, 'manual', now(), 'corporate_video'
        ),
        (
          :'unassigned_lead_id'::uuid, :'unassigned_title', 'qualified', 'active',
          :'actor_id'::uuid, null, 'manual', now(), 'hard_selling_video'
        ),
        (
          :'won_lead_id'::uuid, :'won_title', 'qualified', 'active',
          :'actor_id'::uuid, :'actor_id'::uuid, 'manual', now(), 'food_review'
        ),
        (
          :'archived_lead_id'::uuid, :'archived_title', 'qualified', 'active',
          :'actor_id'::uuid, null, 'manual', now(), 'event_coverage'
        );

      insert into public.opportunities (
        id, lead_id, service, estimated_value_myr, quotation_number,
        quotation_sent_at, meeting_at, pipeline_stage, probability_percent,
        probability_overridden, expected_close_date, owner_id, won_at
      ) values
        (
          :'overdue_opportunity_id'::uuid, :'overdue_lead_id'::uuid,
          'corporate', 8000, 'AI-1B-Q-001', '2026-08-01T08:00:00Z', null,
          'quotation_sent', 60, false, '2026-08-01', :'actor_id'::uuid, null
        ),
        (
          :'unassigned_opportunity_id'::uuid, :'unassigned_lead_id'::uuid,
          'hard_selling', 25000, null, null, '2026-08-02T08:00:00Z',
          'negotiation', 80, false, null, null, null
        ),
        (
          :'won_opportunity_id'::uuid, :'won_lead_id'::uuid,
          'food_review', 3500, null, null, null,
          'won', 100, false, '2026-08-05', :'actor_id'::uuid,
          '2026-08-05T08:00:00Z'
        ),
        (
          :'archived_opportunity_id'::uuid, :'archived_lead_id'::uuid,
          'event_coverage', 9999999, null, null, null,
          'new', 20, false, null, null, null
        );

      update public.leads
      set deleted_at = now()
      where id = :'archived_lead_id'::uuid;
    `,
    {
      actor_id: managementUsers[0].id,
      overdue_lead_id: pipelineFixtures.overdue.leadId,
      overdue_opportunity_id: pipelineFixtures.overdue.opportunityId,
      overdue_title: pipelineFixtures.overdue.title,
      unassigned_lead_id: pipelineFixtures.unassigned.leadId,
      unassigned_opportunity_id: pipelineFixtures.unassigned.opportunityId,
      unassigned_title: pipelineFixtures.unassigned.title,
      won_lead_id: pipelineFixtures.won.leadId,
      won_opportunity_id: pipelineFixtures.won.opportunityId,
      won_title: pipelineFixtures.won.title,
      archived_lead_id: pipelineFixtures.archived.leadId,
      archived_opportunity_id: pipelineFixtures.archived.opportunityId,
      archived_title: pipelineFixtures.archived.title,
    },
  );

  await mkdir(AUTHENTICATED_E2E_DIRECTORY, { recursive: true });
  await writeFile(AI_STUB_CALLS_FILE, "", { encoding: "utf8", mode: 0o600 });
  await writeFile(
    AUTHENTICATED_E2E_RUNTIME_FILE,
    JSON.stringify({
      ...status,
      managementUsers,
      pipelineFixtures,
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
