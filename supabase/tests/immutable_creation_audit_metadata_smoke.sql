\set ON_ERROR_STOP on

reset role;

insert into auth.users (id, email, raw_user_meta_data) values
  (
    '84000000-0000-4000-8000-000000000001',
    'h3-admin@laparpo.test',
    '{"full_name":"H3 Admin"}'
  ),
  (
    '84000000-0000-4000-8000-000000000002',
    'h3-manager@laparpo.test',
    '{"full_name":"H3 Manager"}'
  ),
  (
    '84000000-0000-4000-8000-000000000003',
    'h3-representative@laparpo.test',
    '{"full_name":"H3 Representative"}'
  ),
  (
    '84000000-0000-4000-8000-000000000004',
    'h3-alternate@laparpo.test',
    '{"full_name":"H3 Alternate Actor"}'
  ),
  (
    '84000000-0000-4000-8000-000000000005',
    'h3-inactive@laparpo.test',
    '{"full_name":"H3 Inactive Manager"}'
  );

update public.profiles
set
  role = case id
    when '84000000-0000-4000-8000-000000000001'
      then 'ceo_admin'::public.app_role
    when '84000000-0000-4000-8000-000000000002'
      then 'sales_manager'::public.app_role
    when '84000000-0000-4000-8000-000000000005'
      then 'sales_manager'::public.app_role
    else 'sales_representative'::public.app_role
  end,
  is_active = id <> '84000000-0000-4000-8000-000000000005'
where id::text like '84000000-0000-4000-8000-%';

insert into public.companies (
  id,
  legal_name,
  display_name,
  company_type,
  city,
  country,
  source_url,
  source_type,
  discovered_at,
  created_by
) values (
  '84100000-0000-4000-8000-000000000001',
  'H3 Immutable Metadata Sdn Bhd',
  'H3 Immutable Metadata',
  'other',
  'Butterworth',
  'MY',
  'https://h3-immutable.test/about',
  'company_website',
  now(),
  '84000000-0000-4000-8000-000000000003'
);

insert into public.contacts (
  id,
  company_id,
  full_name,
  work_email,
  source_url,
  source_type,
  discovered_at,
  notes,
  created_by,
  assigned_to
) values (
  '84100000-0000-4000-8000-000000000002',
  '84100000-0000-4000-8000-000000000001',
  'H3 Contact',
  'contact@h3-immutable.test',
  'https://h3-immutable.test/team',
  'company_website',
  now(),
  'Original contact note',
  '84000000-0000-4000-8000-000000000003',
  '84000000-0000-4000-8000-000000000003'
);

insert into public.leads (
  id,
  title,
  company_id,
  primary_contact_id,
  stage,
  lead_status,
  qualification_status,
  created_by,
  assigned_to,
  source_type,
  source_url,
  discovered_at,
  notes
) values (
  '84100000-0000-4000-8000-000000000003',
  'H3 mutable-audit regression Lead',
  '84100000-0000-4000-8000-000000000001',
  '84100000-0000-4000-8000-000000000002',
  'qualified',
  'active',
  'qualified',
  '84000000-0000-4000-8000-000000000003',
  '84000000-0000-4000-8000-000000000003',
  'company_website',
  'https://h3-immutable.test/about',
  now(),
  'Original Lead note'
);

insert into public.opportunities (
  id,
  lead_id,
  service,
  estimated_value_myr
) values (
  '84100000-0000-4000-8000-000000000004',
  '84100000-0000-4000-8000-000000000003',
  'food_review',
  3500
);

insert into public.lead_activities (
  id,
  lead_id,
  opportunity_id,
  activity_type,
  subject,
  activity_at,
  created_by,
  assigned_to
) values (
  '84100000-0000-4000-8000-000000000005',
  '84100000-0000-4000-8000-000000000003',
  '84100000-0000-4000-8000-000000000004',
  'meeting',
  'H3 metadata review',
  now(),
  '84000000-0000-4000-8000-000000000003',
  '84000000-0000-4000-8000-000000000003'
);

insert into public.company_mutation_confirmations (
  confirmation_id,
  actor_id,
  operation,
  submission_hash
) values (
  '84100000-0000-4000-8000-000000000006',
  '84000000-0000-4000-8000-000000000003',
  'create',
  repeat('d', 64)
);

insert into public.lead_sources (
  id,
  company_id,
  source_url,
  source_type,
  discovered_at,
  source_notes
) values (
  '84100000-0000-4000-8000-000000000007',
  '84100000-0000-4000-8000-000000000001',
  'https://h3-immutable.test/source',
  'company_website',
  now(),
  'Original source note'
);

insert into public.lead_signals (
  id,
  lead_id,
  signal_type,
  signal_description,
  confidence,
  source_url,
  observed_at
) values (
  '84100000-0000-4000-8000-000000000008',
  '84100000-0000-4000-8000-000000000003',
  'public_campaign',
  'Original H3 signal',
  0.90,
  'https://h3-immutable.test/source',
  now()
);

insert into public.sales_tasks (
  id,
  lead_id,
  assigned_to,
  title
) values (
  '84100000-0000-4000-8000-000000000009',
  '84100000-0000-4000-8000-000000000003',
  '84000000-0000-4000-8000-000000000003',
  'Original H3 sales task'
);

create temp table h3_core_targets (
  table_name text primary key,
  row_id uuid not null,
  business_column text not null,
  has_created_by boolean not null
);

insert into h3_core_targets (
  table_name,
  row_id,
  business_column,
  has_created_by
) values
  (
    'companies',
    '84100000-0000-4000-8000-000000000001',
    'city',
    true
  ),
  (
    'contacts',
    '84100000-0000-4000-8000-000000000002',
    'notes',
    true
  ),
  (
    'leads',
    '84100000-0000-4000-8000-000000000003',
    'notes',
    true
  ),
  (
    'lead_activities',
    '84100000-0000-4000-8000-000000000005',
    'subject',
    true
  ),
  (
    'opportunities',
    '84100000-0000-4000-8000-000000000004',
    'estimated_value_myr',
    false
  ),
  (
    'lead_sources',
    '84100000-0000-4000-8000-000000000007',
    'source_notes',
    false
  ),
  (
    'lead_signals',
    '84100000-0000-4000-8000-000000000008',
    'signal_description',
    false
  ),
  (
    'sales_tasks',
    '84100000-0000-4000-8000-000000000009',
    'title',
    false
  );

create temp table h3_creation_metadata_snapshot (
  table_name text primary key,
  audit_state jsonb not null
);

insert into h3_creation_metadata_snapshot (table_name, audit_state)
select
  'companies',
  pg_catalog.jsonb_build_object(
    'created_by',
    company.created_by,
    'created_at',
    company.created_at
  )
from public.companies as company
where company.id = '84100000-0000-4000-8000-000000000001'
union all
select
  'contacts',
  pg_catalog.jsonb_build_object(
    'created_by',
    contact.created_by,
    'created_at',
    contact.created_at
  )
from public.contacts as contact
where contact.id = '84100000-0000-4000-8000-000000000002'
union all
select
  'leads',
  pg_catalog.jsonb_build_object(
    'created_by',
    lead.created_by,
    'created_at',
    lead.created_at
  )
from public.leads as lead
where lead.id = '84100000-0000-4000-8000-000000000003'
union all
select
  'lead_activities',
  pg_catalog.jsonb_build_object(
    'created_by',
    activity.created_by,
    'created_at',
    activity.created_at
  )
from public.lead_activities as activity
where activity.id = '84100000-0000-4000-8000-000000000005'
union all
select
  'opportunities',
  pg_catalog.jsonb_build_object(
    'created_at',
    opportunity.created_at
  )
from public.opportunities as opportunity
where opportunity.id = '84100000-0000-4000-8000-000000000004'
union all
select
  'lead_sources',
  pg_catalog.jsonb_build_object(
    'created_at',
    source.created_at
  )
from public.lead_sources as source
where source.id = '84100000-0000-4000-8000-000000000007'
union all
select
  'lead_signals',
  pg_catalog.jsonb_build_object(
    'created_at',
    signal.created_at
  )
from public.lead_signals as signal
where signal.id = '84100000-0000-4000-8000-000000000008'
union all
select
  'sales_tasks',
  pg_catalog.jsonb_build_object(
    'created_at',
    task.created_at
  )
from public.sales_tasks as task
where task.id = '84100000-0000-4000-8000-000000000009';

do $$
begin
  if (
    select count(*)
    from h3_creation_metadata_snapshot
  ) <> 8 then
    raise exception 'H3 creation metadata snapshot is incomplete';
  end if;
end;
$$;

create or replace function pg_temp.expect_h3_rewrite_rejected(
  statement text,
  expected_detail text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  error_detail text;
begin
  begin
    execute statement;
    raise exception 'Audit metadata rewrite unexpectedly succeeded';
  exception
    when insufficient_privilege then
      get stacked diagnostics error_detail = pg_exception_detail;
      if error_detail is distinct from expected_detail then
        raise exception 'Unexpected H3 error detail'
          using
            errcode = '23514',
            detail = pg_catalog.format(
              'expected=%s actual=%s',
              expected_detail,
              coalesce(error_detail, '<null>')
            );
      end if;
  end;
end;
$$;

grant usage on schema public to authenticated;
grant select, insert, update
  on public.companies,
     public.contacts,
     public.leads,
     public.lead_activities,
     public.opportunities,
     public.lead_sources,
     public.lead_signals,
     public.sales_tasks,
     public.company_mutation_confirmations
  to authenticated;
grant select on h3_core_targets to authenticated;
revoke delete on public.companies from authenticated;

-- Every active actor first performs a permitted UPDATE on every target. This
-- proves subsequent failures are column immutability, not row authorization.
set role authenticated;
do $$
declare
  actor_id uuid;
  target h3_core_targets%rowtype;
  affected_rows bigint;
begin
  foreach actor_id in array array[
    '84000000-0000-4000-8000-000000000001'::uuid,
    '84000000-0000-4000-8000-000000000002'::uuid,
    '84000000-0000-4000-8000-000000000003'::uuid
  ]
  loop
    perform pg_catalog.set_config(
      'request.jwt.claim.sub',
      actor_id::text,
      false
    );

    for target in
      select *
      from h3_core_targets
      order by table_name
    loop
      execute pg_catalog.format(
        'update public.%I set %I = %I where id = %L::uuid',
        target.table_name,
        target.business_column,
        target.business_column,
        target.row_id
      );
      get diagnostics affected_rows = row_count;

      if affected_rows <> 1 then
        raise exception 'Actor lacks expected legitimate row UPDATE access'
          using
            errcode = '23514',
            detail = pg_catalog.format(
              'actor=%s table=%s rows=%s',
              actor_id,
              target.table_name,
              affected_rows
            );
      end if;

      if target.has_created_by then
        perform pg_temp.expect_h3_rewrite_rejected(
          pg_catalog.format(
            'update public.%I set created_by = %L::uuid where id = %L::uuid',
            target.table_name,
            '84000000-0000-4000-8000-000000000004',
            target.row_id
          ),
          pg_catalog.format(
            'immutable_creation_audit_metadata:public.%s:created_by',
            target.table_name
          )
        );
      end if;

      perform pg_temp.expect_h3_rewrite_rejected(
        pg_catalog.format(
          'update public.%I set created_at = created_at - interval ''1 day'' where id = %L::uuid',
          target.table_name,
          target.row_id
        ),
        pg_catalog.format(
          'immutable_creation_audit_metadata:public.%s:created_at',
          target.table_name
        )
      );
    end loop;
  end loop;
end;
$$;

-- A valid business-field mutation cannot partially commit beside a forbidden
-- audit rewrite.
select pg_temp.expect_h3_rewrite_rejected(
  $statement$
    update public.companies
    set
      city = 'Tampered city',
      created_by = '84000000-0000-4000-8000-000000000004'
    where id = '84100000-0000-4000-8000-000000000001'
  $statement$,
  'immutable_creation_audit_metadata:public.companies:created_by'
);

select pg_temp.expect_h3_rewrite_rejected(
  $statement$
    update public.opportunities
    set
      estimated_value_myr = 999999,
      created_at = created_at - interval '1 day'
    where id = '84100000-0000-4000-8000-000000000004'
  $statement$,
  'immutable_creation_audit_metadata:public.opportunities:created_at'
);

-- The representative may consume their own Company confirmation, but cannot
-- rewrite its original actor binding or creation time.
select pg_temp.expect_h3_rewrite_rejected(
  $statement$
    update public.company_mutation_confirmations
    set actor_id = '84000000-0000-4000-8000-000000000004'
    where confirmation_id = '84100000-0000-4000-8000-000000000006'
  $statement$,
  'immutable_creation_audit_metadata:public.company_mutation_confirmations:actor_id'
);

select pg_temp.expect_h3_rewrite_rejected(
  $statement$
    update public.company_mutation_confirmations
    set created_at = created_at - interval '1 day'
    where confirmation_id = '84100000-0000-4000-8000-000000000006'
  $statement$,
  'immutable_creation_audit_metadata:public.company_mutation_confirmations:created_at'
);

update public.company_mutation_confirmations
set
  company_id = '84100000-0000-4000-8000-000000000001',
  consumed_at = now()
where confirmation_id = '84100000-0000-4000-8000-000000000006';

reset role;

do $$
declare
  mismatched_tables text[];
begin
  select pg_catalog.array_agg(snapshot.table_name order by snapshot.table_name)
  into mismatched_tables
  from h3_creation_metadata_snapshot as snapshot
  join (
    select
      'companies'::text as table_name,
      pg_catalog.jsonb_build_object(
        'created_by',
        company.created_by,
        'created_at',
        company.created_at
      ) as audit_state
    from public.companies as company
    where company.id = '84100000-0000-4000-8000-000000000001'
    union all
    select
      'contacts',
      pg_catalog.jsonb_build_object(
        'created_by',
        contact.created_by,
        'created_at',
        contact.created_at
      )
    from public.contacts as contact
    where contact.id = '84100000-0000-4000-8000-000000000002'
    union all
    select
      'leads',
      pg_catalog.jsonb_build_object(
        'created_by',
        lead.created_by,
        'created_at',
        lead.created_at
      )
    from public.leads as lead
    where lead.id = '84100000-0000-4000-8000-000000000003'
    union all
    select
      'lead_activities',
      pg_catalog.jsonb_build_object(
        'created_by',
        activity.created_by,
        'created_at',
        activity.created_at
      )
    from public.lead_activities as activity
    where activity.id = '84100000-0000-4000-8000-000000000005'
    union all
    select
      'opportunities',
      pg_catalog.jsonb_build_object('created_at', opportunity.created_at)
    from public.opportunities as opportunity
    where opportunity.id = '84100000-0000-4000-8000-000000000004'
    union all
    select
      'lead_sources',
      pg_catalog.jsonb_build_object('created_at', source.created_at)
    from public.lead_sources as source
    where source.id = '84100000-0000-4000-8000-000000000007'
    union all
    select
      'lead_signals',
      pg_catalog.jsonb_build_object('created_at', signal.created_at)
    from public.lead_signals as signal
    where signal.id = '84100000-0000-4000-8000-000000000008'
    union all
    select
      'sales_tasks',
      pg_catalog.jsonb_build_object('created_at', task.created_at)
    from public.sales_tasks as task
    where task.id = '84100000-0000-4000-8000-000000000009'
  ) as current_state using (table_name)
  where current_state.audit_state is distinct from snapshot.audit_state;

  if mismatched_tables is not null then
    raise exception 'Audit metadata changed after rejected rewrite'
      using
        errcode = '23514',
        detail = pg_catalog.array_to_string(mismatched_tables, ',');
  end if;

  if (
    select city
    from public.companies
    where id = '84100000-0000-4000-8000-000000000001'
  ) <> 'Butterworth' then
    raise exception 'Combined Company UPDATE partially committed';
  end if;

  if (
    select estimated_value_myr
    from public.opportunities
    where id = '84100000-0000-4000-8000-000000000004'
  ) <> 3500 then
    raise exception 'Combined Opportunity UPDATE partially committed';
  end if;

  if not exists (
    select 1
    from public.company_mutation_confirmations
    where confirmation_id = '84100000-0000-4000-8000-000000000006'
      and actor_id = '84000000-0000-4000-8000-000000000003'
      and company_id = '84100000-0000-4000-8000-000000000001'
      and consumed_at is not null
  ) then
    raise exception 'Company confirmation normal consumption regressed';
  end if;
end;
$$;

-- Inactive, unidentified authenticated, and anonymous actors cannot change
-- creation metadata. RLS may reject the statement or make it affect zero rows.
set role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '84000000-0000-4000-8000-000000000005',
  false
);
do $$
begin
  begin
    update public.companies
    set created_at = created_at - interval '1 day'
    where id = '84100000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select pg_catalog.set_config('request.jwt.claim.sub', '', false);
do $$
begin
  begin
    update public.companies
    set created_at = created_at - interval '1 day'
    where id = '84100000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

grant usage on schema public to anon;
grant select, update on public.companies to anon;
grant usage on schema auth to anon;
grant execute on function auth.uid() to anon;
set role anon;
do $$
begin
  begin
    update public.companies
    set created_at = created_at - interval '1 day'
    where id = '84100000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
revoke select, update on public.companies from anon;
revoke execute on function auth.uid() from anon;
revoke usage on schema auth from anon;
revoke usage on schema public from anon;

-- BYPASSRLS/service_role reaches the row but still cannot bypass the trigger.
grant usage on schema public to service_role;
grant select, update on public.companies to service_role;
set role service_role;
select pg_temp.expect_h3_rewrite_rejected(
  $statement$
    update public.companies
    set created_at = created_at - interval '1 day'
    where id = '84100000-0000-4000-8000-000000000001'
  $statement$,
  'immutable_creation_audit_metadata:public.companies:created_at'
);
reset role;
revoke select, update on public.companies from service_role;
revoke usage on schema public from service_role;

-- A callable SECURITY DEFINER function executes as the table owner. The H3
-- trigger deliberately has no owner exception, so this path is rejected too.
create function public.h3_test_security_definer_rewrite()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.companies
  set created_at = created_at - interval '1 day'
  where id = '84100000-0000-4000-8000-000000000001';
$$;

revoke all on function public.h3_test_security_definer_rewrite() from public;
grant execute on function public.h3_test_security_definer_rewrite()
  to authenticated;

set role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '84000000-0000-4000-8000-000000000001',
  false
);
do $$
declare
  error_detail text;
begin
  begin
    perform public.h3_test_security_definer_rewrite();
    raise exception 'SECURITY DEFINER bypassed H3 immutability';
  exception
    when insufficient_privilege then
      get stacked diagnostics error_detail = pg_exception_detail;
      if error_detail is distinct from
        'immutable_creation_audit_metadata:public.companies:created_at'
      then
        raise exception 'Unexpected SECURITY DEFINER rejection detail';
      end if;
  end;
end;
$$;
reset role;

revoke all on function public.h3_test_security_definer_rewrite()
  from authenticated;
drop function public.h3_test_security_definer_rewrite();

-- Normal business updates remain supported and every existing updated_at
-- trigger must advance without changing creation provenance.
create temp table h3_update_snapshot (
  table_name text primary key,
  audit_state jsonb not null,
  updated_at timestamptz not null
);

insert into h3_update_snapshot (table_name, audit_state, updated_at)
select
  'companies',
  pg_catalog.jsonb_build_object(
    'created_by',
    company.created_by,
    'created_at',
    company.created_at
  ),
  company.updated_at
from public.companies as company
where company.id = '84100000-0000-4000-8000-000000000001'
union all
select
  'contacts',
  pg_catalog.jsonb_build_object(
    'created_by',
    contact.created_by,
    'created_at',
    contact.created_at
  ),
  contact.updated_at
from public.contacts as contact
where contact.id = '84100000-0000-4000-8000-000000000002'
union all
select
  'leads',
  pg_catalog.jsonb_build_object(
    'created_by',
    lead.created_by,
    'created_at',
    lead.created_at
  ),
  lead.updated_at
from public.leads as lead
where lead.id = '84100000-0000-4000-8000-000000000003'
union all
select
  'lead_activities',
  pg_catalog.jsonb_build_object(
    'created_by',
    activity.created_by,
    'created_at',
    activity.created_at
  ),
  activity.updated_at
from public.lead_activities as activity
where activity.id = '84100000-0000-4000-8000-000000000005'
union all
select
  'opportunities',
  pg_catalog.jsonb_build_object(
    'created_at',
    opportunity.created_at
  ),
  opportunity.updated_at
from public.opportunities as opportunity
where opportunity.id = '84100000-0000-4000-8000-000000000004';

set role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '84000000-0000-4000-8000-000000000003',
  false
);
update public.companies
set city = 'Seberang Perai'
where id = '84100000-0000-4000-8000-000000000001';
update public.contacts
set notes = 'Normal H3 contact update'
where id = '84100000-0000-4000-8000-000000000002';
update public.leads
set notes = 'Normal H3 Lead update'
where id = '84100000-0000-4000-8000-000000000003';
update public.lead_activities
set outcome = 'Normal H3 activity update'
where id = '84100000-0000-4000-8000-000000000005';
update public.opportunities
set estimated_value_myr = 3600
where id = '84100000-0000-4000-8000-000000000004';
reset role;

do $$
declare
  regression_count integer;
begin
  select count(*)
  into regression_count
  from h3_update_snapshot as snapshot
  join lateral (
    select
      pg_catalog.jsonb_build_object(
        'created_by',
        company.created_by,
        'created_at',
        company.created_at
      ) as audit_state,
      company.updated_at
    from public.companies as company
    where snapshot.table_name = 'companies'
      and company.id = '84100000-0000-4000-8000-000000000001'
    union all
    select
      pg_catalog.jsonb_build_object(
        'created_by',
        contact.created_by,
        'created_at',
        contact.created_at
      ),
      contact.updated_at
    from public.contacts as contact
    where snapshot.table_name = 'contacts'
      and contact.id = '84100000-0000-4000-8000-000000000002'
    union all
    select
      pg_catalog.jsonb_build_object(
        'created_by',
        lead.created_by,
        'created_at',
        lead.created_at
      ),
      lead.updated_at
    from public.leads as lead
    where snapshot.table_name = 'leads'
      and lead.id = '84100000-0000-4000-8000-000000000003'
    union all
    select
      pg_catalog.jsonb_build_object(
        'created_by',
        activity.created_by,
        'created_at',
        activity.created_at
      ),
      activity.updated_at
    from public.lead_activities as activity
    where snapshot.table_name = 'lead_activities'
      and activity.id = '84100000-0000-4000-8000-000000000005'
    union all
    select
      pg_catalog.jsonb_build_object(
        'created_at',
        opportunity.created_at
      ),
      opportunity.updated_at
    from public.opportunities as opportunity
    where snapshot.table_name = 'opportunities'
      and opportunity.id = '84100000-0000-4000-8000-000000000004'
  ) as current_state on true
  where current_state.audit_state is distinct from snapshot.audit_state
    or current_state.updated_at <= snapshot.updated_at;

  if regression_count <> 0 then
    raise exception 'Normal update changed creation audit or failed to advance updated_at'
      using errcode = '23514';
  end if;

  if (
    select count(*)
    from h3_update_snapshot
  ) <> 5 then
    raise exception 'H3 updated_at regression coverage is incomplete';
  end if;

  if (
    select pg_catalog.jsonb_build_object(
      'created_by',
      company.created_by,
      'created_at',
      company.created_at
    )
    from public.companies as company
    where company.id = '84100000-0000-4000-8000-000000000001'
  ) is distinct from (
    select audit_state
    from h3_creation_metadata_snapshot
    where table_name = 'companies'
  ) then
    raise exception 'Denied actor changed Company creation metadata';
  end if;
end;
$$;
