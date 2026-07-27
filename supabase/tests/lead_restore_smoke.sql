\set ON_ERROR_STOP on

-- Active management can archive and restore an ordinary Lead through the same
-- authenticated RPC boundary used by the application.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000002',
  false
);
insert into public.leads (
  id, title, stage, lead_status, created_by, assigned_to, source_type,
  discovered_at, service_interest, estimated_value, currency
) values (
  '78000000-0000-4000-8000-000000000001',
  'Authenticated restore fixture',
  'qualified',
  'active',
  '71000000-0000-4000-8000-000000000002',
  null,
  'manual',
  now(),
  'food_review',
  3500,
  'MYR'
);
update public.leads
set deleted_at = now()
where id = '78000000-0000-4000-8000-000000000001';

do $$
declare restored_lead_id uuid;
begin
  if exists (
    select 1 from public.leads
    where id = '78000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Ordinary SELECT exposed an archived Lead';
  end if;

  select public.restore_archived_lead(
    '78000000-0000-4000-8000-000000000001'
  ) into restored_lead_id;
  if restored_lead_id is distinct from
    '78000000-0000-4000-8000-000000000001'::uuid
  then
    raise exception 'Authenticated management ordinary-Lead restore failed';
  end if;

  if not exists (
    select 1 from public.leads
    where id = '78000000-0000-4000-8000-000000000001'
      and deleted_at is null
  ) then
    raise exception 'Restored ordinary Lead did not become visible';
  end if;
end;
$$;

-- Re-archive the fixture so representative and inactive-management denial can
-- be proven against a real archived row.
update public.leads
set deleted_at = now()
where id = '78000000-0000-4000-8000-000000000001';

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000003',
  false
);
do $$
declare blocked boolean := false;
begin
  begin
    perform public.restore_archived_lead(
      '78000000-0000-4000-8000-000000000001'
    );
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then
    raise exception 'Representative restored an archived Lead';
  end if;
end;
$$;

-- Give the existing inactive fixture a management role to prove active status,
-- rather than role alone, is mandatory.
reset role;
update public.profiles
set role = 'sales_manager'
where id = '71000000-0000-4000-8000-000000000007';
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000007',
  false
);
do $$
declare blocked boolean := false;
begin
  begin
    perform public.restore_archived_lead(
      '78000000-0000-4000-8000-000000000001'
    );
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then
    raise exception 'Inactive management restored an archived Lead';
  end if;
end;
$$;

-- Restore again as active management and prove a ledger-backed converted Lead
-- preserves every non-archive Lead value plus the exact ledger and Opportunity.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000002',
  false
);
select public.restore_archived_lead(
  '78000000-0000-4000-8000-000000000001'
);

reset role;
create temporary table restore_snapshot as
select
  to_jsonb(lead) - 'deleted_at' - 'updated_at' as lead_state,
  to_jsonb(conversion) as conversion_state,
  to_jsonb(opportunity) as opportunity_state
from public.leads as lead
join public.lead_conversions as conversion
  on conversion.lead_id = lead.id
join public.opportunities as opportunity
  on opportunity.id = conversion.opportunity_id
where lead.id = '77000000-0000-4000-8000-000000000001';

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000002',
  false
);
update public.leads
set deleted_at = now()
where id = '77000000-0000-4000-8000-000000000001';

do $$
declare restored_lead_id uuid;
begin
  if exists (
    select 1 from public.leads
    where id = '77000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Ordinary SELECT exposed an archived converted Lead';
  end if;

  select public.restore_archived_lead(
    '77000000-0000-4000-8000-000000000001'
  ) into restored_lead_id;
  if restored_lead_id is distinct from
    '77000000-0000-4000-8000-000000000001'::uuid
  then
    raise exception 'Authenticated management converted-Lead restore failed';
  end if;
end;
$$;

reset role;
do $$
declare
  before_state restore_snapshot%rowtype;
  after_lead jsonb;
  after_conversion jsonb;
  after_opportunity jsonb;
begin
  select * into before_state from restore_snapshot;
  select
    to_jsonb(lead) - 'deleted_at' - 'updated_at',
    to_jsonb(conversion),
    to_jsonb(opportunity)
  into after_lead, after_conversion, after_opportunity
  from public.leads as lead
  join public.lead_conversions as conversion
    on conversion.lead_id = lead.id
  join public.opportunities as opportunity
    on opportunity.id = conversion.opportunity_id
  where lead.id = '77000000-0000-4000-8000-000000000001';

  if after_lead is distinct from before_state.lead_state
    or after_conversion is distinct from before_state.conversion_state
    or after_opportunity is distinct from before_state.opportunity_state
  then
    raise exception 'Converted Lead restore changed sales, ledger, or Opportunity data';
  end if;

  if not (
    (after_lead ->> 'stage') = 'converted'
    and (after_lead ->> 'lead_status') = 'closed'
    and (after_lead ->> 'converted_at') is not null
  ) then
    raise exception 'Converted Lead historical state was not preserved';
  end if;
end;
$$;

-- The restored converted Lead remains read-only, while the unchanged
-- Opportunity authorization remains usable by active management.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000002',
  false
);
do $$
declare
  blocked boolean := false;
  affected integer;
begin
  begin
    update public.leads
    set title = 'Forbidden restored rewrite'
    where id = '77000000-0000-4000-8000-000000000001';
  exception when check_violation then
    blocked := true;
  end;
  if not blocked then
    raise exception 'Restored converted Lead accepted a sales-data mutation';
  end if;

  update public.opportunities
  set estimated_value_myr = estimated_value_myr
  where id = (
    select opportunity_id
    from public.lead_conversions
    where lead_id = '77000000-0000-4000-8000-000000000001'
  );
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Opportunity authorization regressed after Lead restore';
  end if;
end;
$$;

-- A relationship that became invalid while the Lead was archived is not
-- blindly restored. The null result is deterministic for repository not-found
-- handling and the archived row remains hidden.
reset role;
insert into public.companies (
  id, legal_name, display_name, company_type, country, source_url,
  source_type, discovered_at, created_by
) values (
  '78000000-0000-4000-8000-000000000101',
  'Archived Restore Company Sdn Bhd',
  'Archived Restore Company',
  'other',
  'MY',
  'https://restore-company.test',
  'company_website',
  now(),
  '71000000-0000-4000-8000-000000000002'
);
insert into public.leads (
  id, company_id, title, created_by, source_type, discovered_at, deleted_at
) values (
  '78000000-0000-4000-8000-000000000002',
  '78000000-0000-4000-8000-000000000101',
  'Invalid relationship restore fixture',
  '71000000-0000-4000-8000-000000000002',
  'manual',
  now(),
  now()
);
update public.companies
set deleted_at = now()
where id = '78000000-0000-4000-8000-000000000101';

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000002',
  false
);
do $$
begin
  if public.restore_archived_lead(
    '78000000-0000-4000-8000-000000000002'
  ) is not null then
    raise exception 'Lead with archived Company relationship was restored';
  end if;
end;
$$;

reset role;
do $$
begin
  if not exists (
    select 1 from public.leads
    where id = '78000000-0000-4000-8000-000000000002'
      and deleted_at is not null
  ) then
    raise exception 'Invalid relationship restore changed archive state';
  end if;
end;
$$;

reset role;
