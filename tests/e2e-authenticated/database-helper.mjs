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

export async function readPipelineAIStubObservations() {
  const contents = await readFile(AI_STUB_CALLS_FILE, "utf8");
  return contents
    .split(/\r?\n/u)
    .filter((line) => line.startsWith('{"type":"pipeline-summary"'))
    .map((line) => JSON.parse(line));
}

export async function readRepresentativePipelineState(actorId) {
  return queryJson(`
    with fixture_opportunities as (
      select opportunity.*
      from public.opportunities as opportunity
      join public.leads as lead on lead.id = opportunity.lead_id
      where lead.created_by = ${sqlLiteral(actorId)}::uuid
    )
    select json_build_object(
      'totalCount', (select count(*) from fixture_opportunities),
      'activeCount', (
        select count(*) from fixture_opportunities
        where pipeline_stage in ('new', 'discussion', 'quotation_sent', 'negotiation')
      ),
      'stageCounts', (
        select json_build_object(
          'new', count(*) filter (where pipeline_stage = 'new'),
          'discussion', count(*) filter (where pipeline_stage = 'discussion'),
          'quotation_sent', count(*) filter (where pipeline_stage = 'quotation_sent'),
          'negotiation', count(*) filter (where pipeline_stage = 'negotiation'),
          'won', count(*) filter (where pipeline_stage = 'won'),
          'lost', count(*) filter (where pipeline_stage = 'lost')
        )
        from fixture_opportunities
      ),
      'stateHash', (
        select md5(coalesce(string_agg(
          concat_ws('|', id, pipeline_stage, probability_percent,
            probability_overridden, expected_close_date, owner_id,
            estimated_value_myr, updated_at),
          ',' order by id
        ), ''))
        from fixture_opportunities
      ),
      'auditCount', (
        select count(*)
        from public.mutation_audit_events
        where resource_type = 'opportunity'
          and resource_id in (select id from fixture_opportunities)
      )
    )::text;
  `);
}

export async function readPipelineFixtureState(opportunityIds) {
  if (!Array.isArray(opportunityIds) || opportunityIds.length === 0) {
    throw new Error("Pipeline fixture IDs are required");
  }
  const ids = opportunityIds
    .map((id) => `${sqlLiteral(id)}::uuid`)
    .join(", ");
  return queryJson(`
    select json_build_object(
      'opportunities', (
        select coalesce(json_agg(row_to_json(record) order by record.id), '[]'::json)
        from (
          select
            id,
            lead_id,
            pipeline_stage,
            probability_percent,
            probability_overridden,
            expected_close_date,
            owner_id,
            estimated_value_myr,
            updated_at
          from public.opportunities
          where id in (${ids})
          order by id
        ) as record
      ),
      'auditCount', (
        select count(*)
        from public.mutation_audit_events
        where resource_type = 'opportunity'
          and resource_id in (${ids})
      )
    )::text;
  `);
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
