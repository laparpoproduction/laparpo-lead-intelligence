\set ON_ERROR_STOP on

create extension if not exists dblink;

-- Fresh conversion fixtures deliberately include every current Lead service,
-- non-MYR money, terminal states, read-only visibility, and archive state.
reset role;
insert into public.leads (
  id, title, stage, lead_status, created_by, assigned_to, source_type,
  discovered_at, service_interest, estimated_value, currency
) values
(
  '77000000-0000-4000-8000-000000000001', 'Conversion food review',
  'qualified', 'active', '71000000-0000-4000-8000-000000000001', null,
  'manual', now(), 'food_review', 1200, 'MYR'
),
(
  '77000000-0000-4000-8000-000000000002', 'Conversion hard selling',
  'quotation_sent', 'active', '71000000-0000-4000-8000-000000000001', null,
  'manual', now(), 'hard_selling_video', 5000, 'MYR'
),
(
  '77000000-0000-4000-8000-000000000003', 'Conversion corporate',
  'negotiation', 'paused', '71000000-0000-4000-8000-000000000001', null,
  'manual', now(), 'corporate_video', 8000, 'MYR'
),
(
  '77000000-0000-4000-8000-000000000004', 'Conversion storyline',
  'replied', 'active', '71000000-0000-4000-8000-000000000001', null,
  'manual', now(), 'storyline_celebrity', 14000, 'MYR'
),
(
  '77000000-0000-4000-8000-000000000005', 'Conversion social campaign',
  'new', 'active', '71000000-0000-4000-8000-000000000001', null,
  'manual', now(), 'social_media_campaign', 3500, 'MYR'
),
(
  '77000000-0000-4000-8000-000000000006', 'Conversion event coverage',
  'meeting_scheduled', 'active', '71000000-0000-4000-8000-000000000001', null,
  'manual', now(), 'event_coverage', 9000, 'MYR'
),
(
  '77000000-0000-4000-8000-000000000007', 'Conversion other',
  'researching', 'active', '71000000-0000-4000-8000-000000000001', null,
  'manual', now(), 'other', 1000, 'MYR'
),
(
  '77000000-0000-4000-8000-000000000008', 'Representative conversion',
  'qualified', 'active', '71000000-0000-4000-8000-000000000003',
  '71000000-0000-4000-8000-000000000003',
  'manual', now(), 'food_review', 1500, 'MYR'
),
(
  '77000000-0000-4000-8000-000000000009', 'Read-only company conversion',
  'qualified', 'active', '71000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000008',
  'manual', now(), 'corporate_video', 8000, 'MYR'
),
(
  '77000000-0000-4000-8000-000000000010', 'Non MYR conversion',
  'qualified', 'active', '71000000-0000-4000-8000-000000000001', null,
  'manual', now(), 'corporate_video', 2500, 'USD'
),
(
  '77000000-0000-4000-8000-000000000011', 'Rollback conversion',
  'qualified', 'active', '71000000-0000-4000-8000-000000000001', null,
  'manual', now(), 'food_review', 1200, 'MYR'
),
(
  '77000000-0000-4000-8000-000000000012', 'Concurrent conversion',
  'qualified', 'active', '71000000-0000-4000-8000-000000000001', null,
  'manual', now(), 'event_coverage', 6000, 'MYR'
),
(
  '77000000-0000-4000-8000-000000000016', 'Unmapped conversion',
  'qualified', 'active', '71000000-0000-4000-8000-000000000001', null,
  'manual', now(), null, 1000, 'MYR'
);

insert into public.leads (
  id, title, stage, lead_status, created_by, source_type, discovered_at,
  lost_at, lost_reason
) values (
  '77000000-0000-4000-8000-000000000013', 'Terminal lost conversion',
  'lost', 'closed', '71000000-0000-4000-8000-000000000001',
  'manual', now(), now(), 'Prospect declined'
);

insert into public.leads (
  id, title, stage, lead_status, qualification_status, created_by,
  source_type, discovered_at, disqualified_at, disqualified_reason
) values (
  '77000000-0000-4000-8000-000000000014', 'Terminal disqualified conversion',
  'disqualified', 'closed', 'unqualified',
  '71000000-0000-4000-8000-000000000001',
  'manual', now(), now(), 'Outside supported scope'
);

insert into public.leads (
  id, title, created_by, source_type, discovered_at, service_interest,
  deleted_at
) values (
  '77000000-0000-4000-8000-000000000015', 'Archived conversion',
  '71000000-0000-4000-8000-000000000001', 'manual', now(),
  'food_review', now()
);

-- Management conversion and every explicit Lead-service mapping are atomic.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000002',
  false
);

select * from public.convert_lead_to_opportunity(
  '77000000-0000-4000-8000-000000000001',
  null,
  null
);
select * from public.convert_lead_to_opportunity(
  '77000000-0000-4000-8000-000000000002', null, null
);
select * from public.convert_lead_to_opportunity(
  '77000000-0000-4000-8000-000000000003', null, null
);
select * from public.convert_lead_to_opportunity(
  '77000000-0000-4000-8000-000000000004', null, null
);
select * from public.convert_lead_to_opportunity(
  '77000000-0000-4000-8000-000000000005', null, null
);
select * from public.convert_lead_to_opportunity(
  '77000000-0000-4000-8000-000000000006', null, null
);
select * from public.convert_lead_to_opportunity(
  '77000000-0000-4000-8000-000000000007', null, null
);

reset role;
do $$
declare
  expected_service public.service_type;
  actual_service public.service_type;
  fixture_id uuid;
begin
  for fixture_id, expected_service in
    values
      ('77000000-0000-4000-8000-000000000001'::uuid, 'food_review'::public.service_type),
      ('77000000-0000-4000-8000-000000000002'::uuid, 'hard_selling'::public.service_type),
      ('77000000-0000-4000-8000-000000000003'::uuid, 'corporate'::public.service_type),
      ('77000000-0000-4000-8000-000000000004'::uuid, 'storyline_celebrity'::public.service_type),
      ('77000000-0000-4000-8000-000000000005'::uuid, 'social_media_campaign'::public.service_type),
      ('77000000-0000-4000-8000-000000000006'::uuid, 'event_coverage'::public.service_type),
      ('77000000-0000-4000-8000-000000000007'::uuid, 'other'::public.service_type)
  loop
    select opportunity.service
    into actual_service
    from public.lead_conversions as conversion
    join public.opportunities as opportunity
      on opportunity.id = conversion.opportunity_id
     and opportunity.lead_id = conversion.lead_id
    where conversion.lead_id = fixture_id;

    if actual_service is distinct from expected_service then
      raise exception 'Lead service mapping failed for %: expected %, got %',
        fixture_id, expected_service, actual_service;
    end if;
  end loop;

  if exists (
    select 1
    from public.leads as lead
    left join public.lead_conversions as conversion
      on conversion.lead_id = lead.id
    where lead.id between
        '77000000-0000-4000-8000-000000000001'::uuid
        and '77000000-0000-4000-8000-000000000007'::uuid
      and (
        lead.stage <> 'converted'
        or lead.lead_status <> 'closed'
        or lead.converted_at is null
        or conversion.opportunity_id is null
        or conversion.converted_at <> lead.converted_at
      )
  ) then
    raise exception 'Atomic conversion did not persist a complete consistent state';
  end if;
end;
$$;

-- A representative may convert only their directly modifiable Lead.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000003',
  false
);
select * from public.convert_lead_to_opportunity(
  '77000000-0000-4000-8000-000000000008',
  null,
  null
);

-- Company-derived read access is not conversion permission.
reset role;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000001',
  false
);
update public.leads
set company_id = '72000000-0000-4000-8000-000000000001'
where id = '77000000-0000-4000-8000-000000000009';
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000005',
  false
);
do $$
declare blocked boolean := false;
begin
  if not exists (
    select 1 from public.leads
    where id = '77000000-0000-4000-8000-000000000009'
  ) then
    raise exception 'Read-only conversion fixture is not visible';
  end if;
  begin
    perform public.convert_lead_to_opportunity(
      '77000000-0000-4000-8000-000000000009',
      null,
      null
    );
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then
    raise exception 'Read-only Company access converted a Lead';
  end if;
end;
$$;

-- Guessed IDs, inactive users, terminal Leads, deleted Leads, and ambiguous
-- historical conversions fail without creating an Opportunity or ledger row.
reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000006',
  false
);
do $$
declare blocked boolean := false;
begin
  begin
    perform public.convert_lead_to_opportunity(
      '77000000-0000-4000-8000-000000000008',
      'food_review',
      null
    );
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then
    raise exception 'Guessed Lead UUID bypassed conversion authorization';
  end if;
end;
$$;

reset role;
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
    perform public.convert_lead_to_opportunity(
      '77000000-0000-4000-8000-000000000008',
      'food_review',
      null
    );
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Inactive actor converted a Lead'; end if;
end;
$$;

reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000001',
  false
);
do $$
declare
  fixture_id uuid;
  blocked boolean;
begin
  foreach fixture_id in array array[
    '77000000-0000-4000-8000-000000000013'::uuid,
    '77000000-0000-4000-8000-000000000014'::uuid,
    '77000000-0000-4000-8000-000000000015'::uuid,
    '74000000-0000-4000-8000-000000000010'::uuid
  ]
  loop
    blocked := false;
    begin
      perform public.convert_lead_to_opportunity(
        fixture_id,
        'food_review',
        null
      );
    exception when others then blocked := true;
    end;
    if not blocked then
      raise exception 'Ineligible Lead % was converted', fixture_id;
    end if;
  end loop;

  blocked := false;
  begin
    perform public.convert_lead_to_opportunity(
      '88000000-0000-4000-8000-000000000099',
      'food_review',
      null
    );
  exception when no_data_found then blocked := true;
  end;
  if not blocked then raise exception 'Missing Lead was converted'; end if;

  blocked := false;
  begin
    perform public.convert_lead_to_opportunity(
      '77000000-0000-4000-8000-000000000016',
      null,
      null
    );
  exception when invalid_parameter_value then blocked := true;
  end;
  if not blocked then
    raise exception 'Unsupported empty Lead service was silently coerced';
  end if;

  blocked := false;
  begin
    perform public.convert_lead_to_opportunity(
      '77000000-0000-4000-8000-000000000016',
      'food_review',
      -1
    );
  exception when numeric_value_out_of_range then blocked := true;
  end;
  if not blocked then raise exception 'Negative MYR value was accepted'; end if;
end;
$$;

-- A non-MYR Lead value is never copied into estimated_value_myr.
select * from public.convert_lead_to_opportunity(
  '77000000-0000-4000-8000-000000000010',
  null,
  null
);
reset role;
do $$
begin
  if exists (
    select 1
    from public.lead_conversions as conversion
    join public.opportunities as opportunity
      on opportunity.id = conversion.opportunity_id
    where conversion.lead_id = '77000000-0000-4000-8000-000000000010'
      and opportunity.estimated_value_myr is not null
  ) then
    raise exception 'Non-MYR Lead value was silently stored as MYR';
  end if;
end;
$$;

-- Retry returns the original Opportunity and creates no duplicate.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000002',
  false
);
do $$
declare
  first_opportunity uuid;
  retry_opportunity uuid;
  retry_status text;
begin
  select opportunity_id
  into first_opportunity
  from public.lead_conversions
  where lead_id = '77000000-0000-4000-8000-000000000001';

  select result.opportunity_id, result.conversion_status
  into retry_opportunity, retry_status
  from public.convert_lead_to_opportunity(
    '77000000-0000-4000-8000-000000000001',
    'event_coverage',
    9999
  ) as result;

  if retry_opportunity <> first_opportunity
    or retry_status <> 'already_converted'
  then
    raise exception 'Conversion retry did not resolve the stable result';
  end if;
end;
$$;

reset role;
do $$
begin
  if (
    select count(*)
    from public.opportunities
    where lead_id = '77000000-0000-4000-8000-000000000001'
  ) <> 1 then
    raise exception 'Conversion retry created a duplicate Opportunity';
  end if;
end;
$$;

-- Direct Lead updates cannot bypass the immutable conversion ledger.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000001',
  false
);
do $$
declare
  blocked boolean := false;
  affected integer;
begin
  begin
    update public.leads
    set
      stage = 'converted',
      lead_status = 'closed',
      converted_at = now()
    where id = '77000000-0000-4000-8000-000000000011';
  exception when check_violation then blocked := true;
  end;
  if not blocked then
    raise exception 'Direct Lead update bypassed atomic conversion';
  end if;

  blocked := false;
  begin
    insert into public.leads (
      id, title, stage, lead_status, converted_at, created_by,
      source_type, discovered_at
    ) values (
      '77000000-0000-4000-8000-000000000099',
      'Direct converted insert',
      'converted',
      'closed',
      now(),
      '71000000-0000-4000-8000-000000000001',
      'manual',
      now()
    );
  exception when check_violation then blocked := true;
  end;
  if not blocked then
    raise exception 'Direct converted Lead insert bypassed atomic conversion';
  end if;

  blocked := false;
  begin
    insert into public.lead_conversions (
      lead_id, opportunity_id, converted_at, created_by
    ) values (
      '77000000-0000-4000-8000-000000000011',
      gen_random_uuid(),
      now(),
      '71000000-0000-4000-8000-000000000001'
    );
    get diagnostics affected = row_count;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked or affected <> 0 then
    raise exception 'Authenticated client wrote directly to conversion ledger';
  end if;
end;
$$;

-- Force a failure after Opportunity and ledger inserts. The statement-level
-- transaction must roll every mutation back.
reset role;
create or replace function public.test_fail_conversion_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id = '77000000-0000-4000-8000-000000000011'::uuid
    and new.stage = 'converted'::public.lead_stage
  then
    raise exception 'forced conversion rollback';
  end if;
  return new;
end;
$$;
create trigger zz_test_fail_conversion_update
before update on public.leads
for each row execute function public.test_fail_conversion_update();

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000002',
  false
);
do $$
declare blocked boolean := false;
begin
  begin
    perform public.convert_lead_to_opportunity(
      '77000000-0000-4000-8000-000000000011',
      null,
      null
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Forced conversion failure succeeded'; end if;
end;
$$;

reset role;
drop trigger zz_test_fail_conversion_update on public.leads;
drop function public.test_fail_conversion_update();
do $$
begin
  if exists (
    select 1 from public.opportunities
    where lead_id = '77000000-0000-4000-8000-000000000011'
  ) or exists (
    select 1 from public.lead_conversions
    where lead_id = '77000000-0000-4000-8000-000000000011'
  ) or exists (
    select 1 from public.leads
    where id = '77000000-0000-4000-8000-000000000011'
      and (stage = 'converted' or converted_at is not null)
  ) then
    raise exception 'Conversion failure left partial state';
  end if;
end;
$$;

-- Conversion Opportunity deletion and cross-Lead ledger references are
-- database-restricted even for a privileged maintenance actor.
do $$
declare
  conversion_opportunity uuid;
  other_opportunity uuid;
  blocked boolean := false;
begin
  select opportunity_id into conversion_opportunity
  from public.lead_conversions
  where lead_id = '77000000-0000-4000-8000-000000000001';

  begin
    delete from public.opportunities where id = conversion_opportunity;
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then
    raise exception 'Conversion Opportunity hard delete corrupted the ledger';
  end if;

  insert into public.opportunities (lead_id, service)
  values (
    '77000000-0000-4000-8000-000000000011',
    'food_review'
  ) returning id into other_opportunity;

  blocked := false;
  begin
    insert into public.lead_conversions (
      lead_id, opportunity_id, converted_at, created_by
    ) values (
      '77000000-0000-4000-8000-000000000009',
      other_opportunity,
      now(),
      '71000000-0000-4000-8000-000000000001'
    );
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then
    raise exception 'Cross-Lead conversion relationship bypassed integrity';
  end if;
end;
$$;

-- Two independent authenticated sessions race the same Lead. The row lock and
-- ledger primary key must yield one conversion and one safe retry result.
do $$
declare
  database_name text := current_database();
  result_a record;
  result_b record;
  statuses text[];
begin
  perform dblink_connect('conversion_a', 'dbname=' || quote_literal(database_name));
  perform dblink_connect('conversion_b', 'dbname=' || quote_literal(database_name));
  perform dblink_exec('conversion_a', 'set role authenticated');
  perform dblink_exec('conversion_b', 'set role authenticated');
  perform value from dblink(
    'conversion_a',
    $query$select set_config(
      'request.jwt.claim.sub',
      '71000000-0000-4000-8000-000000000002',
      false
    )$query$
  ) as configured(value text);
  perform value from dblink(
    'conversion_b',
    $query$select set_config(
      'request.jwt.claim.sub',
      '71000000-0000-4000-8000-000000000002',
      false
    )$query$
  ) as configured(value text);

  perform dblink_send_query(
    'conversion_a',
    $query$select * from public.convert_lead_to_opportunity(
      '77000000-0000-4000-8000-000000000012',
      null,
      null
    )$query$
  );
  perform dblink_send_query(
    'conversion_b',
    $query$select * from public.convert_lead_to_opportunity(
      '77000000-0000-4000-8000-000000000012',
      null,
      null
    )$query$
  );

  select * into result_a
  from dblink_get_result('conversion_a')
    as result(lead_id uuid, opportunity_id uuid, conversion_status text);
  select * into result_b
  from dblink_get_result('conversion_b')
    as result(lead_id uuid, opportunity_id uuid, conversion_status text);

  statuses := array[result_a.conversion_status, result_b.conversion_status];
  if not (
    'converted' = any(statuses)
    and 'already_converted' = any(statuses)
    and result_a.opportunity_id = result_b.opportunity_id
  ) then
    raise exception 'Concurrent conversion did not resolve deterministically: %, %',
      result_a, result_b;
  end if;

  perform dblink_disconnect('conversion_a');
  perform dblink_disconnect('conversion_b');
end;
$$;

do $$
begin
  if (
    select count(*)
    from public.opportunities
    where lead_id = '77000000-0000-4000-8000-000000000012'
  ) <> 1 then
    raise exception 'Concurrent conversion created duplicate Opportunities';
  end if;
end;
$$;

reset role;
