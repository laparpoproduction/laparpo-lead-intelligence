\set ON_ERROR_STOP on

-- This suite runs after the CRM smoke portfolio so the common Supabase-style
-- table grants are present. Keep the Company boundary exact after every broad
-- fixture grant.
reset role;
revoke delete on public.companies from authenticated;
revoke delete on public.companies from anon;
revoke delete on public.companies from public;

-- Reuse the H1 actors and make its inactive fixture an inactive manager. The
-- table owner is the only intentional break-glass authority.
update public.profiles
set role = 'sales_manager'
where id = '82000000-0000-4000-8000-000000000005';

insert into public.companies (
  id, legal_name, display_name, company_type, country,
  source_url, source_type, discovered_at, created_by
) values (
  '83000000-0000-4000-8000-000000000001',
  'H2 Preservation Company Sdn Bhd',
  'H2 Preservation Company',
  'other',
  'MY',
  'https://h2-preservation.test/about',
  'company_website',
  now(),
  '82000000-0000-4000-8000-000000000001'
);

insert into public.lead_sources (
  id, company_id, source_url, source_type, discovered_at
) values (
  '83000000-0000-4000-8000-000000000002',
  '83000000-0000-4000-8000-000000000001',
  'https://h2-preservation.test/campaign',
  'campaign',
  now()
);

insert into public.contacts (
  id, company_id, full_name, work_email,
  source_url, source_type, discovered_at, created_by
) values (
  '83000000-0000-4000-8000-000000000003',
  '83000000-0000-4000-8000-000000000001',
  'H2 Public Contact',
  'contact@h2-preservation.test',
  'https://h2-preservation.test/team',
  'company_website',
  now(),
  '82000000-0000-4000-8000-000000000001'
);

insert into public.leads (
  id, title, company_id, primary_contact_id, primary_source_id,
  stage, lead_status, qualification_status, created_by, assigned_to,
  source_type, source_url, discovered_at, service_interest,
  estimated_value, currency
) values (
  '83000000-0000-4000-8000-000000000004',
  'H2 converted preservation Lead',
  '83000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000003',
  '83000000-0000-4000-8000-000000000002',
  'qualified',
  'active',
  'qualified',
  '82000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000004',
  'campaign',
  'https://h2-preservation.test/campaign',
  now(),
  'corporate_video',
  8000,
  'MYR'
);

insert into public.lead_signals (
  id, lead_id, signal_type, signal_description, confidence,
  source_url, observed_at
) values (
  '83000000-0000-4000-8000-000000000005',
  '83000000-0000-4000-8000-000000000004',
  'public_campaign',
  'Public brief requests a corporate production partner',
  0.95,
  'https://h2-preservation.test/campaign',
  now()
);

update public.leads
set source_signal_id = '83000000-0000-4000-8000-000000000005'
where id = '83000000-0000-4000-8000-000000000004';

insert into public.company_mutation_confirmations (
  confirmation_id, actor_id, operation, company_id,
  submission_hash, consumed_at
) values (
  '83000000-0000-4000-8000-000000000006',
  '82000000-0000-4000-8000-000000000001',
  'update',
  '83000000-0000-4000-8000-000000000001',
  repeat('a', 64),
  now()
);

insert into public.contact_mutation_confirmations (
  confirmation_id, actor_id, operation, contact_id,
  submission_hash, consumed_at
) values (
  '83000000-0000-4000-8000-000000000007',
  '82000000-0000-4000-8000-000000000001',
  'update',
  '83000000-0000-4000-8000-000000000003',
  repeat('b', 64),
  now()
);

insert into public.lead_mutation_confirmations (
  confirmation_id, actor_id, operation, lead_id,
  submission_hash, consumed_at
) values (
  '83000000-0000-4000-8000-000000000008',
  '82000000-0000-4000-8000-000000000001',
  'update',
  '83000000-0000-4000-8000-000000000004',
  repeat('c', 64),
  now()
);

insert into public.sales_tasks (
  id, lead_id, assigned_to, title
) values (
  '83000000-0000-4000-8000-000000000009',
  '83000000-0000-4000-8000-000000000004',
  '82000000-0000-4000-8000-000000000004',
  'H2 preservation follow-up'
);

-- Use the supported authenticated atomic conversion path so the fixture has a
-- real immutable conversion ledger and designated Opportunity.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000001',
  false
);

select *
from public.convert_lead_to_opportunity(
  '83000000-0000-4000-8000-000000000004',
  null,
  null
);

update public.opportunities
set
  pipeline_stage = 'negotiation',
  probability_percent = 73,
  probability_overridden = true,
  expected_close_date = date '2026-09-30',
  owner_id = '82000000-0000-4000-8000-000000000004'
where id = (
  select opportunity_id
  from public.lead_conversions
  where lead_id = '83000000-0000-4000-8000-000000000004'
);

reset role;

insert into public.lead_activities (
  id, lead_id, opportunity_id, activity_type, subject,
  description, activity_at, created_by, assigned_to
)
select
  '83000000-0000-4000-8000-000000000010',
  conversion.lead_id,
  conversion.opportunity_id,
  'meeting',
  'H2 preservation meeting',
  'History must survive Company archive and blocked hard deletes',
  now(),
  '82000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000004'
from public.lead_conversions as conversion
where conversion.lead_id = '83000000-0000-4000-8000-000000000004';

create temp table h2_company_history_snapshot (
  record_type text primary key,
  state jsonb not null
);

insert into h2_company_history_snapshot (record_type, state)
select
  'company',
  to_jsonb(company) - 'deleted_at' - 'updated_at'
from public.companies as company
where company.id = '83000000-0000-4000-8000-000000000001'
union all
select 'lead_source', to_jsonb(source)
from public.lead_sources as source
where source.id = '83000000-0000-4000-8000-000000000002'
union all
select 'contact', to_jsonb(contact)
from public.contacts as contact
where contact.id = '83000000-0000-4000-8000-000000000003'
union all
select 'lead', to_jsonb(lead)
from public.leads as lead
where lead.id = '83000000-0000-4000-8000-000000000004'
union all
select 'lead_signal', to_jsonb(signal)
from public.lead_signals as signal
where signal.id = '83000000-0000-4000-8000-000000000005'
union all
select 'company_confirmation', to_jsonb(confirmation)
from public.company_mutation_confirmations as confirmation
where confirmation.confirmation_id = '83000000-0000-4000-8000-000000000006'
union all
select 'contact_confirmation', to_jsonb(confirmation)
from public.contact_mutation_confirmations as confirmation
where confirmation.confirmation_id = '83000000-0000-4000-8000-000000000007'
union all
select 'lead_confirmation', to_jsonb(confirmation)
from public.lead_mutation_confirmations as confirmation
where confirmation.confirmation_id = '83000000-0000-4000-8000-000000000008'
union all
select 'sales_task', to_jsonb(task)
from public.sales_tasks as task
where task.id = '83000000-0000-4000-8000-000000000009'
union all
select 'lead_activity', to_jsonb(activity)
from public.lead_activities as activity
where activity.id = '83000000-0000-4000-8000-000000000010'
union all
select 'conversion', to_jsonb(conversion)
from public.lead_conversions as conversion
where conversion.lead_id = '83000000-0000-4000-8000-000000000004'
union all
select 'opportunity', to_jsonb(opportunity)
from public.opportunities as opportunity
join public.lead_conversions as conversion
  on conversion.opportunity_id = opportunity.id
 and conversion.lead_id = opportunity.lead_id
where conversion.lead_id = '83000000-0000-4000-8000-000000000004';

do $$
begin
  if (select count(*) from h2_company_history_snapshot) <> 12 then
    raise exception 'H2 descendant fixture is incomplete';
  end if;
end;
$$;
-- Active CEO/Admin direct authenticated DELETE is rejected.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000001',
  false
);
do $$
declare
  blocked boolean := false;
begin
  begin
    delete from public.companies
    where id = '83000000-0000-4000-8000-000000000001';
  exception
    when insufficient_privilege then blocked := true;
  end;
  if not blocked then
    raise exception 'CEO/Admin Company hard delete was not rejected';
  end if;
end;
$$;
reset role;
do $$
begin
  if not exists (
    select 1 from public.companies
    where id = '83000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Company disappeared after CEO/Admin DELETE attempt';
  end if;
end;
$$;

-- Active Sales Manager direct authenticated DELETE is rejected.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000002',
  false
);
do $$
declare
  blocked boolean := false;
begin
  begin
    delete from public.companies
    where id = '83000000-0000-4000-8000-000000000001';
  exception
    when insufficient_privilege then blocked := true;
  end;
  if not blocked then
    raise exception 'Sales Manager Company hard delete was not rejected';
  end if;
end;
$$;
reset role;
do $$
begin
  if not exists (
    select 1 from public.companies
    where id = '83000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Company disappeared after Sales Manager DELETE attempt';
  end if;
end;
$$;

-- Active Sales Representative direct authenticated DELETE is rejected.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000004',
  false
);
do $$
declare
  blocked boolean := false;
begin
  begin
    delete from public.companies
    where id = '83000000-0000-4000-8000-000000000001';
  exception
    when insufficient_privilege then blocked := true;
  end;
  if not blocked then
    raise exception 'Sales Representative Company hard delete was not rejected';
  end if;
end;
$$;
reset role;
do $$
begin
  if not exists (
    select 1 from public.companies
    where id = '83000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Company disappeared after Representative DELETE attempt';
  end if;
end;
$$;

-- Inactive management and authenticated-without-identity DELETE are rejected.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000005',
  false
);
do $$
declare
  blocked boolean := false;
begin
  begin
    delete from public.companies
    where id = '83000000-0000-4000-8000-000000000001';
  exception
    when insufficient_privilege then blocked := true;
  end;
  if not blocked then
    raise exception 'Inactive manager Company hard delete was not rejected';
  end if;
end;
$$;
reset role;
do $$
begin
  if not exists (
    select 1 from public.companies
    where id = '83000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Company disappeared after inactive DELETE attempt';
  end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', '', false);
do $$
declare
  blocked boolean := false;
begin
  begin
    delete from public.companies
    where id = '83000000-0000-4000-8000-000000000001';
  exception
    when insufficient_privilege then blocked := true;
  end;
  if not blocked then
    raise exception 'Unauthenticated Company hard delete was not rejected';
  end if;
end;
$$;
reset role;
do $$
begin
  if not exists (
    select 1 from public.companies
    where id = '83000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Company disappeared after unauthenticated DELETE attempt';
  end if;
end;
$$;

-- The anonymous database role has no DELETE table privilege.
set role anon;
do $$
declare
  blocked boolean := false;
begin
  begin
    delete from public.companies
    where id = '83000000-0000-4000-8000-000000000001';
  exception
    when insufficient_privilege then blocked := true;
  end;
  if not blocked then
    raise exception 'Anonymous Company hard delete was not rejected';
  end if;
end;
$$;
reset role;
do $$
begin
  if not exists (
    select 1 from public.companies
    where id = '83000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Company disappeared after anonymous DELETE attempt';
  end if;
end;
$$;

-- Defence in depth: even a future permissive policy plus DELETE grant cannot
-- let an authenticated CEO/Admin bypass the trigger.
grant delete on public.companies to authenticated;
create policy "h2 simulated Company DELETE regression"
  on public.companies for delete to authenticated
  using (true);

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000001',
  false
);
do $$
declare
  blocked boolean := false;
begin
  begin
    delete from public.companies
    where id = '83000000-0000-4000-8000-000000000001';
  exception
    when insufficient_privilege then
      if position(
        'Companies must be archived instead of permanently deleted'
        in sqlerrm
      ) = 0 then
        raise;
      end if;
      blocked := true;
  end;
  if not blocked then
    raise exception 'Company delete bypassed the database guard';
  end if;
end;
$$;
reset role;

drop policy "h2 simulated Company DELETE regression" on public.companies;
revoke delete on public.companies from authenticated;

do $$
begin
  if not exists (
    select 1 from public.companies
    where id = '83000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Company disappeared during grant/policy regression proof';
  end if;
end;
$$;

-- BYPASSRLS service application roles are also blocked by the trigger.
grant usage on schema public to service_role;
grant delete on public.companies to service_role;
set role service_role;
do $$
declare
  blocked boolean := false;
begin
  begin
    delete from public.companies
    where id = '83000000-0000-4000-8000-000000000001';
  exception
    when insufficient_privilege then
      if position(
        'Companies must be archived instead of permanently deleted'
        in sqlerrm
      ) = 0 then
        raise;
      end if;
      blocked := true;
  end;
  if not blocked then
    raise exception 'service_role bypassed the Company hard-delete guard';
  end if;
end;
$$;
reset role;
revoke delete on public.companies from service_role;
revoke usage on schema public from service_role;

do $$
begin
  if not exists (
    select 1 from public.companies
    where id = '83000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Company disappeared after service-role DELETE attempt';
  end if;
end;
$$;

-- Representative and inactive management cannot archive before the supported
-- CEO/Admin path is exercised.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000004',
  false
);
do $$
begin
  begin
    update public.companies
    set deleted_at = statement_timestamp()
    where id = '83000000-0000-4000-8000-000000000001';
    raise exception 'Sales Representative archived a Company';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000005',
  false
);
do $$
declare
  affected_rows integer;
begin
  update public.companies
  set deleted_at = statement_timestamp()
  where id = '83000000-0000-4000-8000-000000000001';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'Inactive management archived a Company';
  end if;
end;
$$;

-- Active management can still archive through UPDATE deleted_at.
select set_config(
  'request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000001',
  false
);
do $$
declare
  affected_rows integer;
begin
  update public.companies
  set deleted_at = statement_timestamp()
  where id = '83000000-0000-4000-8000-000000000001'
    and deleted_at is null;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'CEO/Admin Company archive path did not update exactly one row';
  end if;
end;
$$;

-- Management can retrieve the archived Company itself, while ordinary Lead
-- reads correctly isolate descendants hidden by the archived parent.
do $$
begin
  if not exists (
    select 1 from public.companies
    where id = '83000000-0000-4000-8000-000000000001'
      and deleted_at is not null
  ) then
    raise exception 'Archived Company is not retained for management';
  end if;

  if exists (
    select 1 from public.leads
    where id = '83000000-0000-4000-8000-000000000004'
  ) then
    raise exception 'Archived Company descendant leaked through ordinary Lead read';
  end if;

  if not exists (
    select 1 from public.list_archived_leads()
    where id = '83000000-0000-4000-8000-000000000004'
  ) then
    raise exception 'Management archived Lead view lost Company descendant history';
  end if;
end;
$$;

reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000004',
  false
);
do $$
begin
  if exists (
    select 1 from public.companies
    where id = '83000000-0000-4000-8000-000000000001'
  ) or exists (
    select 1 from public.contacts
    where id = '83000000-0000-4000-8000-000000000003'
  ) or exists (
    select 1 from public.leads
    where id = '83000000-0000-4000-8000-000000000004'
  ) or exists (
    select 1 from public.opportunities
    where lead_id = '83000000-0000-4000-8000-000000000004'
  ) or exists (
    select 1 from public.lead_activities
    where id = '83000000-0000-4000-8000-000000000010'
  ) then
    raise exception 'Archived Company or descendants leaked to Representative';
  end if;
end;
$$;
reset role;

-- Compare exact stored state after archive. Only Company deleted_at and its
-- updated_at trigger are permitted to differ from the pre-archive snapshot.
do $$
begin
  if exists (
    with current_state (record_type, state) as (
      select
        'company',
        to_jsonb(company) - 'deleted_at' - 'updated_at'
      from public.companies as company
      where company.id = '83000000-0000-4000-8000-000000000001'
      union all
      select 'lead_source', to_jsonb(source)
      from public.lead_sources as source
      where source.id = '83000000-0000-4000-8000-000000000002'
      union all
      select 'contact', to_jsonb(contact)
      from public.contacts as contact
      where contact.id = '83000000-0000-4000-8000-000000000003'
      union all
      select 'lead', to_jsonb(lead)
      from public.leads as lead
      where lead.id = '83000000-0000-4000-8000-000000000004'
      union all
      select 'lead_signal', to_jsonb(signal)
      from public.lead_signals as signal
      where signal.id = '83000000-0000-4000-8000-000000000005'
      union all
      select 'company_confirmation', to_jsonb(confirmation)
      from public.company_mutation_confirmations as confirmation
      where confirmation.confirmation_id =
        '83000000-0000-4000-8000-000000000006'
      union all
      select 'contact_confirmation', to_jsonb(confirmation)
      from public.contact_mutation_confirmations as confirmation
      where confirmation.confirmation_id =
        '83000000-0000-4000-8000-000000000007'
      union all
      select 'lead_confirmation', to_jsonb(confirmation)
      from public.lead_mutation_confirmations as confirmation
      where confirmation.confirmation_id =
        '83000000-0000-4000-8000-000000000008'
      union all
      select 'sales_task', to_jsonb(task)
      from public.sales_tasks as task
      where task.id = '83000000-0000-4000-8000-000000000009'
      union all
      select 'lead_activity', to_jsonb(activity)
      from public.lead_activities as activity
      where activity.id = '83000000-0000-4000-8000-000000000010'
      union all
      select 'conversion', to_jsonb(conversion)
      from public.lead_conversions as conversion
      where conversion.lead_id = '83000000-0000-4000-8000-000000000004'
      union all
      select 'opportunity', to_jsonb(opportunity)
      from public.opportunities as opportunity
      join public.lead_conversions as conversion
        on conversion.opportunity_id = opportunity.id
       and conversion.lead_id = opportunity.lead_id
      where conversion.lead_id = '83000000-0000-4000-8000-000000000004'
    )
    select 1
    from h2_company_history_snapshot as snapshot
    full join current_state using (record_type)
    where snapshot.state is distinct from current_state.state
  ) then
    raise exception 'Company archive changed or removed descendant CRM history';
  end if;
end;
$$;

-- Final PostgreSQL metadata assertions.
do $$
declare
  company_relation oid := 'public.companies'::regclass;
  guard_function oid :=
    'public.prevent_company_hard_delete()'::regprocedure;
begin
  if exists (
    select 1
    from pg_catalog.pg_policy
    where polrelid = company_relation
      and polcmd = 'd'
  ) then
    raise exception 'A Company DELETE policy remains';
  end if;

  if pg_catalog.has_table_privilege(
    'authenticated',
    'public.companies',
    'DELETE'
  ) then
    raise exception 'authenticated retains Company DELETE privilege';
  end if;

  if pg_catalog.has_table_privilege('anon', 'public.companies', 'DELETE') then
    raise exception 'anon retains Company DELETE privilege';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class as relation
    cross join lateral pg_catalog.aclexplode(
      coalesce(relation.relacl, pg_catalog.acldefault('r', relation.relowner))
    ) as privilege
    where relation.oid = company_relation
      and privilege.grantee = 0
      and privilege.privilege_type = 'DELETE'
  ) then
    raise exception 'PUBLIC retains Company DELETE privilege';
  end if;

  if not pg_catalog.has_table_privilege(
    'authenticated',
    'public.companies',
    'SELECT'
  ) or not pg_catalog.has_table_privilege(
    'authenticated',
    'public.companies',
    'INSERT'
  ) or not pg_catalog.has_table_privilege(
    'authenticated',
    'public.companies',
    'UPDATE'
  ) then
    raise exception 'Supported Company table privileges regressed';
  end if;

  if not (
    select relation.relrowsecurity
    from pg_catalog.pg_class as relation
    where relation.oid = company_relation
  ) then
    raise exception 'Company RLS is not enabled';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policy as policy
    where policy.polrelid = company_relation
      and policy.polname = 'users update permitted active companies'
      and policy.polcmd = 'w'
      and (
        select role.oid
        from pg_catalog.pg_roles as role
        where role.rolname = 'authenticated'
      ) = any(policy.polroles)
  ) then
    raise exception 'Company soft-delete UPDATE policy is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger
    where trigger.tgrelid = company_relation
      and trigger.tgname = 'companies_prevent_hard_delete'
      and not trigger.tgisinternal
      and trigger.tgenabled = 'O'
      and trigger.tgfoid = guard_function
  ) then
    raise exception 'Company hard-delete guard trigger is missing';
  end if;

  if (
    select function.prosecdef
    from pg_catalog.pg_proc as function
    where function.oid = guard_function
  ) then
    raise exception 'Company hard-delete guard is not SECURITY INVOKER';
  end if;

  if not (
    select coalesce(
      function.proconfig @> array['search_path=""']::text[],
      false
    )
    from pg_catalog.pg_proc as function
    where function.oid = guard_function
  ) then
    raise exception 'Company hard-delete guard search_path is not empty';
  end if;

  if pg_catalog.has_function_privilege(
    'authenticated',
    guard_function,
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'anon',
    guard_function,
    'EXECUTE'
  ) then
    raise exception 'Application role can execute Company delete guard directly';
  end if;
end;
$$;

-- Exact final direct and transitive FK actions used in the delivery map.
do $$
declare
  company_relation oid := 'public.companies'::regclass;
begin
  if (
    select count(*)
    from pg_catalog.pg_constraint
    where contype = 'f'
      and confrelid = company_relation
  ) <> 4 then
    raise exception 'Unexpected number of direct Company foreign keys';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'contacts_company_id_fk'
      and confrelid = company_relation
      and confdeltype = 'r'
  ) or not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'leads_company_id_fk'
      and confrelid = company_relation
      and confdeltype = 'r'
  ) or not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'company_mutation_confirmations_company_id_fkey'
      and confrelid = company_relation
      and confdeltype = 'r'
  ) or not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'lead_sources_company_id_fkey'
      and confrelid = company_relation
      and confdeltype = 'c'
  ) then
    raise exception 'Final direct Company FK actions differ from the audited map';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'opportunities_lead_id_fk'
      and confdeltype = 'r'
  ) or not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'lead_activities_lead_id_fk'
      and confdeltype = 'r'
  ) or not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'lead_conversions_lead_id_fkey'
      and confdeltype = 'r'
  ) or not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'lead_conversions_opportunity_lead_fk'
      and confdeltype = 'r'
  ) or not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'lead_activities_opportunity_lead_fk'
      and confdeltype = 'n'
  ) then
    raise exception 'Final transitive CRM FK actions differ from the audited map';
  end if;
end;
$$;
