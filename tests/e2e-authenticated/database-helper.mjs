import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import {
  AI_STUB_CALLS_FILE,
  readAuthenticatedE2ERuntime,
} from "../../scripts/authenticated-e2e/runtime.mjs";

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function queryJson(sql) {
  const runtime = await readAuthenticatedE2ERuntime();
  const result = spawnSync(
    "psql",
    [
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "--tuples-only",
      "--no-align",
      "--quiet",
      "--dbname",
      runtime.databaseUrl,
      "--file=-",
    ],
    {
      encoding: "utf8",
      input: sql,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  if (result.status !== 0) {
    throw new Error("Disposable database verification failed");
  }
  return JSON.parse(result.stdout.trim());
}

export async function readCreatedCompany(displayName) {
  return queryJson(`
    select coalesce(json_agg(row_to_json(company_record)), '[]'::json)::text
    from (
      select
        id,
        legal_name,
        display_name,
        company_type,
        industry,
        description,
        city,
        state,
        country,
        estimated_branch_count,
        website_url,
        source_url,
        source_type,
        created_by,
        created_at,
        updated_at,
        deleted_at
      from public.companies
      where display_name = ${sqlLiteral(displayName)}
    ) as company_record;
  `);
}

export async function readCompanyAudit(companyId) {
  return queryJson(`
    select coalesce(json_agg(row_to_json(audit_record) order by occurred_at, id), '[]'::json)::text
    from (
      select
        id,
        occurred_at,
        request_id,
        actor_id,
        actor_role,
        resource_type,
        resource_id,
        operation,
        application_operation,
        source,
        changed_fields,
        resource_version_before,
        resource_version_after
      from public.mutation_audit_events
      where resource_type = 'company'
        and resource_id = ${sqlLiteral(companyId)}::uuid
    ) as audit_record;
  `);
}

export async function readCompanyDescendantCounts(companyId) {
  return queryJson(`
    select json_build_object(
      'contacts', (select count(*) from public.contacts where company_id = ${sqlLiteral(companyId)}::uuid),
      'leads', (select count(*) from public.leads where company_id = ${sqlLiteral(companyId)}::uuid)
    )::text;
  `);
}

export async function readAIStubCallCount() {
  const contents = await readFile(AI_STUB_CALLS_FILE, "utf8");
  return contents.split(/\r?\n/u).filter(Boolean).length;
}

export async function readAuditBoundaryPrivileges() {
  return queryJson(`
    select json_build_object(
      'anon',
        has_table_privilege('anon', 'public.mutation_audit_events', 'select')
        or has_table_privilege('anon', 'public.mutation_audit_events', 'insert')
        or has_table_privilege('anon', 'public.mutation_audit_events', 'update')
        or has_table_privilege('anon', 'public.mutation_audit_events', 'delete'),
      'authenticated',
        has_table_privilege('authenticated', 'public.mutation_audit_events', 'select')
        or has_table_privilege('authenticated', 'public.mutation_audit_events', 'insert')
        or has_table_privilege('authenticated', 'public.mutation_audit_events', 'update')
        or has_table_privilege('authenticated', 'public.mutation_audit_events', 'delete'),
      'serviceRole',
        has_table_privilege('service_role', 'public.mutation_audit_events', 'select')
        or has_table_privilege('service_role', 'public.mutation_audit_events', 'insert')
        or has_table_privilege('service_role', 'public.mutation_audit_events', 'update')
        or has_table_privilege('service_role', 'public.mutation_audit_events', 'delete')
    )::text;
  `);
}
