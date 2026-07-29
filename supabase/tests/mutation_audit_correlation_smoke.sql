\set ON_ERROR_STOP on

-- H7 uses isolated actors and resources so its security proofs do not depend
-- on another smoke suite's fixture order.
insert into auth.users (id, email, raw_user_meta_data) values
  (
    '93000000-0000-4000-8000-000000000001',
    'h7-admin@laparpo.test',
    '{"full_name":"H7 Admin"}'
  ),
  (
    '93000000-0000-4000-8000-000000000002',
    'h7-representative@laparpo.test',
    '{"full_name":"H7 Representative"}'
  );

update public.profiles
set role = 'ceo_admin'
where id = '93000000-0000-4000-8000-000000000001';

grant usage on schema public to authenticated;
grant select, insert, update on table
  public.profiles,
  public.companies,
  public.contacts,
  public.leads,
  public.lead_activities,
  public.opportunities
to authenticated;
grant select on table public.lead_conversions to authenticated;
grant usage, select on all sequences in schema public to authenticated;

do $$
declare
  application_role name;
  table_privilege text;
begin
  if not exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'mutation_audit_events'
      and relation.relkind = 'r'
      and relation.relrowsecurity
  ) then
    raise exception 'H7 audit table or RLS is missing';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_trigger as trigger
    join pg_catalog.pg_class as relation on relation.oid = trigger.tgrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'profiles',
        'companies',
        'contacts',
        'leads',
        'lead_activities',
        'lead_conversions',
        'opportunities'
      )
      and trigger.tgname like '%record_mutation_audit'
      and not trigger.tgisinternal
  ) <> 7 then
    raise exception 'H7 audit trigger coverage is incomplete';
  end if;

  if pg_catalog.has_table_privilege(
    'authenticated',
    'public.mutation_audit_events',
    'SELECT'
  )
    or pg_catalog.has_table_privilege(
      'authenticated',
      'public.mutation_audit_events',
      'INSERT'
    )
    or pg_catalog.has_table_privilege(
      'authenticated',
      'public.mutation_audit_events',
      'UPDATE'
    )
    or pg_catalog.has_table_privilege(
      'authenticated',
      'public.mutation_audit_events',
      'DELETE'
    )
    or pg_catalog.has_table_privilege(
      'authenticated',
      'public.mutation_audit_events',
      'TRUNCATE'
    )
    or pg_catalog.has_table_privilege(
      'service_role',
      'public.mutation_audit_events',
      'SELECT'
    )
    or pg_catalog.has_table_privilege(
      'service_role',
      'public.mutation_audit_events',
      'INSERT'
    )
    or pg_catalog.has_table_privilege(
      'service_role',
      'public.mutation_audit_events',
      'UPDATE'
    )
    or pg_catalog.has_table_privilege(
      'service_role',
      'public.mutation_audit_events',
      'DELETE'
    )
    or pg_catalog.has_table_privilege(
      'service_role',
      'public.mutation_audit_events',
      'TRUNCATE'
    )
  then
    raise exception 'Application roles retained direct audit-table privileges';
  end if;

  if pg_catalog.has_function_privilege(
    'authenticated',
    'mutation_audit_private.mutation_audit_hmac(text,text)',
    'EXECUTE'
  )
    or pg_catalog.has_function_privilege(
      'authenticated',
      'mutation_audit_private.fixed_length_mac_equal(bytea,bytea)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'authenticated',
      'public.verified_mutation_request_context()',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'service_role',
      'mutation_audit_private.mutation_audit_hmac(text,text)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'service_role',
      'mutation_audit_private.fixed_length_mac_equal(bytea,bytea)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'service_role',
      'public.verified_mutation_request_context()',
      'EXECUTE'
    )
  then
    raise exception 'Application roles can forge mutation correlation';
  end if;

  foreach application_role in array array[
    'anon'::name,
    'authenticated'::name,
    'service_role'::name
  ] loop
    if pg_catalog.has_schema_privilege(
      application_role,
      'mutation_audit_private',
      'USAGE'
    )
      or pg_catalog.has_schema_privilege(
        application_role,
        'mutation_audit_private',
        'CREATE'
      )
    then
      raise exception 'Application role retained private-schema access';
    end if;

    if pg_catalog.has_function_privilege(
      application_role,
      'mutation_audit_private.mutation_audit_hmac(text,text)',
      'EXECUTE'
    )
      or pg_catalog.has_function_privilege(
        application_role,
        'mutation_audit_private.fixed_length_mac_equal(bytea,bytea)',
        'EXECUTE'
      )
      or pg_catalog.has_function_privilege(
        application_role,
        'public.verified_mutation_request_context()',
        'EXECUTE'
      )
    then
      raise exception 'Application role retained private-helper access';
    end if;

    foreach table_privilege in array array[
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER'
    ] loop
      if pg_catalog.has_table_privilege(
        application_role,
        'mutation_audit_private.mutation_correlation_secret',
        table_privilege
      ) then
        raise exception 'Application role retained private-secret access';
      end if;
    end loop;
  end loop;

  if exists (
    select 1
    from pg_catalog.pg_namespace as namespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        namespace.nspacl,
        pg_catalog.acldefault('n', namespace.nspowner)
      )
    ) as privilege
    where namespace.nspname = 'mutation_audit_private'
      and privilege.grantee = 0
  )
    or exists (
      select 1
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      cross join lateral pg_catalog.aclexplode(
        coalesce(
          relation.relacl,
          pg_catalog.acldefault('r', relation.relowner)
        )
      ) as privilege
      where namespace.nspname = 'mutation_audit_private'
        and relation.relname = 'mutation_correlation_secret'
        and privilege.grantee = 0
    )
  then
    raise exception 'PUBLIC retained private-secret privileges';
  end if;

  if (
    select count(*)
    from mutation_audit_private.mutation_correlation_secret
  ) <> 1 then
    raise exception 'Private mutation-correlation secret was not provisioned';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    join pg_catalog.pg_roles as owner
      on owner.oid = procedure.proowner
    where (
      namespace.nspname = 'mutation_audit_private'
      or (
        namespace.nspname = 'public'
        and procedure.proname in (
          'verified_mutation_request_context',
          'record_mutation_audit_event'
        )
      )
    )
      and owner.rolname in ('anon', 'authenticated', 'service_role')
  ) then
    raise exception 'Application role owns an H7 privileged function';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_namespace as namespace
    join pg_catalog.pg_roles as owner
      on owner.oid = namespace.nspowner
    where namespace.nspname = 'mutation_audit_private'
      and owner.rolname in ('anon', 'authenticated', 'service_role')
  )
    or exists (
      select 1
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      join pg_catalog.pg_roles as owner
        on owner.oid = relation.relowner
      where namespace.nspname = 'mutation_audit_private'
        and relation.relname = 'mutation_correlation_secret'
        and owner.rolname in ('anon', 'authenticated', 'service_role')
    )
  then
    raise exception 'Application role owns the private verifier store';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_db_role_setting as role_setting
    cross join lateral unnest(role_setting.setconfig) as setting(value)
    where setting.value like
      'app.settings.mutation_audit_correlation_secret=%'
      or exists (
        select 1
        from mutation_audit_private.mutation_correlation_secret as private_secret
        where pg_catalog.strpos(
          setting.value,
          private_secret.secret
        ) > 0
      )
  ) then
    raise exception 'H7 verifier material persisted in role/database settings';
  end if;

  if not mutation_audit_private.fixed_length_mac_equal(
    pg_catalog.decode(repeat('00', 32), 'hex'),
    pg_catalog.decode(repeat('00', 32), 'hex')
  )
    or mutation_audit_private.fixed_length_mac_equal(
      pg_catalog.decode('01' || repeat('00', 31), 'hex'),
      pg_catalog.decode(repeat('00', 32), 'hex')
    )
    or mutation_audit_private.fixed_length_mac_equal(
      pg_catalog.decode(repeat('00', 31) || '01', 'hex'),
      pg_catalog.decode(repeat('00', 32), 'hex')
    )
    or mutation_audit_private.fixed_length_mac_equal(
      pg_catalog.decode(repeat('00', 31), 'hex'),
      pg_catalog.decode(repeat('00', 32), 'hex')
    )
  then
    raise exception 'Fixed-length MAC comparison is incorrect';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mutation_audit_events'
      and data_type in ('json', 'jsonb')
  ) then
    raise exception 'Audit table introduced an unrestricted JSON payload';
  end if;
end;
$$;

set role anon;
do $$
declare
  blocked boolean := false;
begin
  begin
    perform secret
    from mutation_audit_private.mutation_correlation_secret;
  exception when insufficient_privilege then
    blocked := true;
  end;

  if not blocked then
    raise exception 'Anon read private verifier secret';
  end if;
end;
$$;
reset role;

set role authenticated;
do $$
declare
  blocked boolean := false;
begin
  begin
    perform secret
    from mutation_audit_private.mutation_correlation_secret;
  exception when insufficient_privilege then
    blocked := true;
  end;

  if not blocked then
    raise exception 'Authenticated read private verifier secret';
  end if;
end;
$$;
reset role;

set role service_role;
do $$
declare
  blocked boolean := false;
begin
  begin
    perform secret
    from mutation_audit_private.mutation_correlation_secret;
  exception when insufficient_privilege then
    blocked := true;
  end;

  if not blocked then
    raise exception 'Service role read private verifier secret';
  end if;
end;
$$;
reset role;

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '93000000-0000-4000-8000-000000000001',
  false
);
select set_config('request.headers', '{}'::jsonb::text, false);

insert into public.companies (
  id,
  legal_name,
  display_name,
  company_type,
  source_url,
  source_type,
  discovered_at,
  created_by
) values (
  '93000000-0000-4000-8000-000000000101',
  'H7 Audit Company Sdn Bhd',
  'H7 Audit Company',
  'fnb',
  'https://h7-audit-company.test/about',
  'company_website',
  now(),
  '93000000-0000-4000-8000-000000000001'
);

insert into public.contacts (
  id,
  company_id,
  full_name,
  personal_email,
  mobile_phone,
  notes,
  source_url,
  source_type,
  discovered_at,
  created_by
) values (
  '93000000-0000-4000-8000-000000000201',
  '93000000-0000-4000-8000-000000000101',
  'H7 Audit Contact',
  'private-h7@example.test',
  '012-333 4444',
  'H7 private contact notes must never enter audit evidence',
  'https://h7-audit-company.test/team',
  'company_website',
  now(),
  '93000000-0000-4000-8000-000000000001'
);

insert into public.leads (
  id,
  company_id,
  primary_contact_id,
  title,
  stage,
  created_by,
  source_type,
  source_url,
  discovered_at,
  service_interest,
  notes
) values (
  '93000000-0000-4000-8000-000000000301',
  '93000000-0000-4000-8000-000000000101',
  '93000000-0000-4000-8000-000000000201',
  'H7 audit conversion lead',
  'qualified',
  '93000000-0000-4000-8000-000000000001',
  'company_website',
  'https://h7-audit-company.test/brief',
  now(),
  'food_review',
  'H7 private lead notes must never enter audit evidence'
);

insert into public.leads (
  id,
  company_id,
  primary_contact_id,
  title,
  stage,
  created_by,
  source_type,
  source_url,
  discovered_at,
  service_interest,
  notes
) values (
  '93000000-0000-4000-8000-000000000302',
  '93000000-0000-4000-8000-000000000101',
  '93000000-0000-4000-8000-000000000201',
  'H7 audit lifecycle lead',
  'qualified',
  '93000000-0000-4000-8000-000000000001',
  'company_website',
  'https://h7-audit-company.test/lifecycle-brief',
  now(),
  'food_review',
  'H7 private lifecycle notes must never enter audit evidence'
);

insert into public.lead_activities (
  id,
  lead_id,
  activity_type,
  subject,
  description,
  activity_at,
  created_by
) values (
  '93000000-0000-4000-8000-000000000401',
  '93000000-0000-4000-8000-000000000301',
  'note',
  'H7 audit activity',
  'H7 private activity body must never enter audit evidence',
  now(),
  '93000000-0000-4000-8000-000000000001'
);

update public.companies
set description = 'H7 database-authoritative update'
where id = '93000000-0000-4000-8000-000000000101';

reset role;

do $$
begin
  if not exists (
    select 1
    from public.mutation_audit_events
    where resource_type = 'company'
      and resource_id = '93000000-0000-4000-8000-000000000101'
      and operation = 'create'
      and source = 'database'
      and request_id is null
      and actor_id = '93000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Direct Company create bypassed authoritative audit';
  end if;

  if not exists (
    select 1
    from public.mutation_audit_events
    where resource_type = 'contact'
      and resource_id = '93000000-0000-4000-8000-000000000201'
      and operation = 'create'
      and actor_id = '93000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Contact mutation was not audited';
  end if;

  if not exists (
    select 1
    from public.mutation_audit_events
    where resource_type = 'lead'
      and resource_id = '93000000-0000-4000-8000-000000000301'
      and operation = 'create'
  ) then
    raise exception 'Lead mutation was not audited';
  end if;

  if not exists (
    select 1
    from public.mutation_audit_events
    where resource_type = 'lead_activity'
      and resource_id = '93000000-0000-4000-8000-000000000401'
      and operation = 'create'
  ) then
    raise exception 'Lead Activity mutation was not audited';
  end if;

  if not exists (
    select 1
    from public.mutation_audit_events as event
    join public.companies as company
      on company.id = event.resource_id
    where event.resource_type = 'company'
      and event.resource_id = '93000000-0000-4000-8000-000000000101'
      and event.operation = 'update'
      and event.changed_fields @> array['description', 'updated_at']
      and not event.changed_fields @> array['legal_name']
      and event.resource_version_before < event.resource_version_after
      and event.resource_version_after = company.updated_at
  ) then
    raise exception 'Actual changed fields or resource versions are incorrect';
  end if;

  if exists (
    select 1
    from public.mutation_audit_events
    where array_to_string(changed_fields, ',') ilike
      '%private-h7@example.test%'
      or array_to_string(changed_fields, ',') ilike
        '%private activity body%'
      or array_to_string(changed_fields, ',') ilike
        '%private lead notes%'
  ) then
    raise exception 'Sensitive CRM values entered the audit trail';
  end if;
end;
$$;

-- A signed server context correlates every row in one atomic conversion.
do $$
declare
  request_id_text constant text :=
    '93000000-0000-4000-8000-000000000501';
  operation_text constant text := 'convert_lead';
  issued_at_text text :=
    extract(epoch from pg_catalog.clock_timestamp())::bigint::text;
  correlation_secret text;
  signature_text text;
begin
  select secret
  into strict correlation_secret
  from mutation_audit_private.mutation_correlation_secret;

  signature_text := pg_catalog.encode(
    mutation_audit_private.mutation_audit_hmac(
      request_id_text || ':' || issued_at_text || ':' || operation_text,
      correlation_secret
    ),
    'hex'
  );
  perform pg_catalog.set_config(
    'request.headers',
    pg_catalog.jsonb_build_object(
      'x-laparpo-request-id', request_id_text,
      'x-laparpo-request-operation', operation_text,
      'x-laparpo-request-issued-at', issued_at_text,
      'x-laparpo-request-signature', signature_text
    )::text,
    false
  );
end;
$$;

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '93000000-0000-4000-8000-000000000001',
  false
);
select *
from public.convert_lead_to_opportunity(
  '93000000-0000-4000-8000-000000000301',
  null,
  null
);
reset role;

do $$
begin
  if (
    select count(*)
    from public.mutation_audit_events
    where request_id = '93000000-0000-4000-8000-000000000501'
      and source = 'application'
      and application_operation = 'convert_lead'
      and actor_id = '93000000-0000-4000-8000-000000000001'
      and actor_role = 'ceo_admin'
      and resource_type in ('lead', 'lead_conversion', 'opportunity')
  ) <> 3 then
    raise exception 'Atomic conversion events did not share correlation';
  end if;

  if not exists (
    select 1
    from public.lead_conversions
    where lead_id = '93000000-0000-4000-8000-000000000301'
  ) then
    raise exception 'H7 changed conversion ledger semantics';
  end if;
end;
$$;

-- Reset the emulated PostgREST transaction context before direct calls.
select set_config('request.headers', '{}'::jsonb::text, false);
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '93000000-0000-4000-8000-000000000001',
  false
);

update public.opportunities
set pipeline_stage = 'discussion'
where lead_id = '93000000-0000-4000-8000-000000000301';

select public.archive_lead_activity(
  '93000000-0000-4000-8000-000000000401'
);
select public.restore_lead_activity(
  '93000000-0000-4000-8000-000000000401'
);

update public.leads
set deleted_at = now()
where id = '93000000-0000-4000-8000-000000000302';
select public.restore_archived_lead(
  '93000000-0000-4000-8000-000000000302'
);

update public.contacts
set deleted_at = now()
where id = '93000000-0000-4000-8000-000000000201';

update public.companies
set deleted_at = now()
where id = '93000000-0000-4000-8000-000000000101';

reset role;

do $$
begin
  if not exists (
    select 1
    from public.mutation_audit_events
    where resource_type = 'opportunity'
      and operation = 'change_stage'
      and resource_id = (
        select opportunity_id
        from public.lead_conversions
        where lead_id = '93000000-0000-4000-8000-000000000301'
      )
  ) then
    raise exception 'Opportunity pipeline mutation was not audited';
  end if;

  if not exists (
    select 1
    from public.mutation_audit_events
    where resource_type = 'lead_activity'
      and resource_id = '93000000-0000-4000-8000-000000000401'
      and operation = 'archive'
  ) or not exists (
    select 1
    from public.mutation_audit_events
    where resource_type = 'lead_activity'
      and resource_id = '93000000-0000-4000-8000-000000000401'
      and operation = 'restore'
  ) then
    raise exception 'Lead Activity archive/restore was not audited';
  end if;

  if not exists (
    select 1
    from public.mutation_audit_events
    where resource_type = 'lead'
      and resource_id = '93000000-0000-4000-8000-000000000302'
      and operation = 'archive'
  ) or not exists (
    select 1
    from public.mutation_audit_events
    where resource_type = 'lead'
      and resource_id = '93000000-0000-4000-8000-000000000302'
      and operation = 'restore'
  ) then
    raise exception 'Lead archive/restore was not audited';
  end if;

  if not exists (
    select 1
    from public.mutation_audit_events
    where resource_type = 'contact'
      and resource_id = '93000000-0000-4000-8000-000000000201'
      and operation = 'archive'
  ) or not exists (
    select 1
    from public.mutation_audit_events
    where resource_type = 'company'
      and resource_id = '93000000-0000-4000-8000-000000000101'
      and operation = 'archive'
  ) then
    raise exception 'Contact or Company archive was not audited';
  end if;
end;
$$;

-- Each malformed or untrusted context is exercised separately. The helper
-- catches only H7's fail-closed SQLSTATE; the failed UPDATE remains rolled back
-- by the PL/pgSQL subtransaction.
create function pg_temp.expect_h7_context_rejected(
  test_name text,
  request_headers jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  rejected boolean := false;
begin
  perform pg_catalog.set_config(
    'request.headers',
    request_headers::text,
    false
  );

  begin
    update public.profiles
    set full_name = 'H7 rejected context: ' || test_name
    where id = '93000000-0000-4000-8000-000000000002';
  exception
    when invalid_parameter_value then rejected := true;
  end;

  if not rejected then
    raise exception 'H7 context case was not rejected: %', test_name;
  end if;
end;
$$;

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '93000000-0000-4000-8000-000000000001',
  false
);

select pg_temp.expect_h7_context_rejected(
  'partial headers',
  pg_catalog.jsonb_build_object(
    'x-laparpo-request-id',
    '93000000-0000-4000-8000-000000000561'
  )
);

select pg_temp.expect_h7_context_rejected(
  'malformed request UUID',
  pg_catalog.jsonb_build_object(
    'x-laparpo-request-id', 'not-a-uuid',
    'x-laparpo-request-operation', 'update_company',
    'x-laparpo-request-issued-at',
    extract(epoch from pg_catalog.clock_timestamp())::bigint::text,
    'x-laparpo-request-signature', repeat('0', 64)
  )
);

select pg_temp.expect_h7_context_rejected(
  'malformed issued-at',
  pg_catalog.jsonb_build_object(
    'x-laparpo-request-id',
    '93000000-0000-4000-8000-000000000562',
    'x-laparpo-request-operation', 'update_company',
    'x-laparpo-request-issued-at', 'not-an-epoch',
    'x-laparpo-request-signature', repeat('0', 64)
  )
);

select pg_temp.expect_h7_context_rejected(
  'issued-at overflow',
  pg_catalog.jsonb_build_object(
    'x-laparpo-request-id',
    '93000000-0000-4000-8000-000000000563',
    'x-laparpo-request-operation', 'update_company',
    'x-laparpo-request-issued-at', repeat('9', 32),
    'x-laparpo-request-signature', repeat('0', 64)
  )
);

select pg_temp.expect_h7_context_rejected(
  'expired issued-at',
  pg_catalog.jsonb_build_object(
    'x-laparpo-request-id',
    '93000000-0000-4000-8000-000000000564',
    'x-laparpo-request-operation', 'update_company',
    'x-laparpo-request-issued-at', '1000000000',
    'x-laparpo-request-signature', repeat('0', 64)
  )
);

select pg_temp.expect_h7_context_rejected(
  'excessively future issued-at',
  pg_catalog.jsonb_build_object(
    'x-laparpo-request-id',
    '93000000-0000-4000-8000-000000000565',
    'x-laparpo-request-operation', 'update_company',
    'x-laparpo-request-issued-at', '9999999999',
    'x-laparpo-request-signature', repeat('0', 64)
  )
);

select pg_temp.expect_h7_context_rejected(
  'malformed signature',
  pg_catalog.jsonb_build_object(
    'x-laparpo-request-id',
    '93000000-0000-4000-8000-000000000566',
    'x-laparpo-request-operation', 'update_company',
    'x-laparpo-request-issued-at',
    extract(epoch from pg_catalog.clock_timestamp())::bigint::text,
    'x-laparpo-request-signature', 'ABC'
  )
);

select pg_temp.expect_h7_context_rejected(
  'wrong signature',
  pg_catalog.jsonb_build_object(
    'x-laparpo-request-id',
    '93000000-0000-4000-8000-000000000599',
    'x-laparpo-request-operation', 'update_company',
    'x-laparpo-request-issued-at',
    extract(epoch from pg_catalog.clock_timestamp())::bigint::text,
    'x-laparpo-request-signature', repeat('0', 64)
  )
);

select pg_temp.expect_h7_context_rejected(
  'unknown operation',
  pg_catalog.jsonb_build_object(
    'x-laparpo-request-id',
    '93000000-0000-4000-8000-000000000567',
    'x-laparpo-request-operation', 'generic_update',
    'x-laparpo-request-issued-at',
    extract(epoch from pg_catalog.clock_timestamp())::bigint::text,
    'x-laparpo-request-signature', repeat('0', 64)
  )
);

-- Exact release-blocker proof: an SQL-capable authenticated actor can still
-- set the obsolete custom GUC and self-sign with attacker secret B, but the
-- verifier reads private secret A and rejects the claimed application context.
select pg_catalog.set_config(
  'app.settings.mutation_audit_correlation_secret',
  'attacker-controlled-session-secret-2026',
  false
);
select pg_temp.expect_h7_context_rejected(
  'attacker GUC self-sign',
  pg_catalog.jsonb_build_object(
    'x-laparpo-request-id',
    '93000000-0000-4000-8000-000000000598',
    'x-laparpo-request-operation', 'update_company',
    'x-laparpo-request-issued-at', issued_at.value,
    'x-laparpo-request-signature',
    pg_catalog.encode(
      public.hmac(
        '93000000-0000-4000-8000-000000000598:'
          || issued_at.value
          || ':update_company',
        'attacker-controlled-session-secret-2026',
        'sha256'
      ),
      'hex'
    )
  )
)
from (
  select extract(
    epoch from pg_catalog.clock_timestamp()
  )::bigint::text as value
) as issued_at;
select pg_catalog.set_config(
  'app.settings.mutation_audit_correlation_secret',
  '',
  false
);
reset role;

-- A missing private verifier secret fails a claimed application context
-- closed. It never downgrades the event to source=database.
delete from mutation_audit_private.mutation_correlation_secret;
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '93000000-0000-4000-8000-000000000001',
  false
);
select set_config('request.headers', '{}'::jsonb::text, false);
update public.profiles
set full_name = 'H7 direct mutation without verifier secret'
where id = '93000000-0000-4000-8000-000000000002';

select pg_temp.expect_h7_context_rejected(
  'missing private secret',
  pg_catalog.jsonb_build_object(
    'x-laparpo-request-id',
    '93000000-0000-4000-8000-000000000568',
    'x-laparpo-request-operation', 'update_company',
    'x-laparpo-request-issued-at',
    extract(epoch from pg_catalog.clock_timestamp())::bigint::text,
    'x-laparpo-request-signature', repeat('0', 64)
  )
);
reset role;
insert into mutation_audit_private.mutation_correlation_secret (
  singleton,
  secret
) values (
  true,
  :'correlation_secret'
);

-- Blank and short private values fail closed independently.
update mutation_audit_private.mutation_correlation_secret
set secret = '                                ';
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '93000000-0000-4000-8000-000000000001',
  false
);
select pg_temp.expect_h7_context_rejected(
  'blank private secret',
  pg_catalog.jsonb_build_object(
    'x-laparpo-request-id',
    '93000000-0000-4000-8000-000000000569',
    'x-laparpo-request-operation', 'update_company',
    'x-laparpo-request-issued-at',
    extract(epoch from pg_catalog.clock_timestamp())::bigint::text,
    'x-laparpo-request-signature', repeat('0', 64)
  )
);
reset role;

update mutation_audit_private.mutation_correlation_secret
set secret = 'too-short';
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '93000000-0000-4000-8000-000000000001',
  false
);
select pg_temp.expect_h7_context_rejected(
  'short private secret',
  pg_catalog.jsonb_build_object(
    'x-laparpo-request-id',
    '93000000-0000-4000-8000-000000000570',
    'x-laparpo-request-operation', 'update_company',
    'x-laparpo-request-issued-at',
    extract(epoch from pg_catalog.clock_timestamp())::bigint::text,
    'x-laparpo-request-signature', repeat('0', 64)
  )
);
reset role;

update mutation_audit_private.mutation_correlation_secret
set secret = :'correlation_secret';

-- The singleton key prevents ambiguous active verifier rows.
do $$
declare
  duplicate_blocked boolean := false;
begin
  begin
    insert into mutation_audit_private.mutation_correlation_secret (
      singleton,
      secret
    ) values (
      true,
      'not-a-real-secret'
    );
  exception when unique_violation then
    duplicate_blocked := true;
  end;

  if not duplicate_blocked then
    raise exception 'Private verifier store accepted ambiguous rows';
  end if;
end;
$$;

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '93000000-0000-4000-8000-000000000001',
  false
);

-- Ordinary actors cannot read, forge, rewrite, delete, or truncate audit
-- history even when they know a real resource identifier.
do $$
declare
  blocked boolean;
begin
  blocked := false;
  begin
    perform count(*) from public.mutation_audit_events;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Authenticated read audit history'; end if;

  blocked := false;
  begin
    insert into public.mutation_audit_events (
      actor_id,
      resource_type,
      resource_id,
      operation,
      source,
      changed_fields
    ) values (
      '93000000-0000-4000-8000-000000000002',
      'company',
      '93000000-0000-4000-8000-000000000101',
      'update',
      'database',
      array['description']
    );
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Authenticated forged audit event'; end if;

  blocked := false;
  begin
    update public.mutation_audit_events
    set operation = 'create';
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Authenticated updated audit history'; end if;

  blocked := false;
  begin
    delete from public.mutation_audit_events;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Authenticated deleted audit history'; end if;

  blocked := false;
  begin
    execute 'truncate table public.mutation_audit_events';
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Authenticated truncated audit history'; end if;
end;
$$;

reset role;
select set_config('request.headers', '{}'::jsonb::text, false);

do $$
begin
  if exists (
    select 1
    from public.profiles
    where id = '93000000-0000-4000-8000-000000000002'
      and full_name like 'H7 rejected context:%'
  ) then
    raise exception 'Rejected-context business update did not roll back';
  end if;

  if not exists (
    select 1
    from public.mutation_audit_events
    where resource_type = 'profile'
      and resource_id = '93000000-0000-4000-8000-000000000002'
      and source = 'database'
      and request_id is null
      and application_operation is null
      and actor_id = '93000000-0000-4000-8000-000000000001'
      and changed_fields @> array['full_name']
  ) then
    raise exception 'Direct mutation without verifier secret was not audited';
  end if;

  if exists (
    select 1
    from public.mutation_audit_events
    where request_id = any (array[
      '93000000-0000-4000-8000-000000000561'::uuid,
      '93000000-0000-4000-8000-000000000562'::uuid,
      '93000000-0000-4000-8000-000000000563'::uuid,
      '93000000-0000-4000-8000-000000000564'::uuid,
      '93000000-0000-4000-8000-000000000565'::uuid,
      '93000000-0000-4000-8000-000000000566'::uuid,
      '93000000-0000-4000-8000-000000000567'::uuid,
      '93000000-0000-4000-8000-000000000568'::uuid,
      '93000000-0000-4000-8000-000000000569'::uuid,
      '93000000-0000-4000-8000-000000000570'::uuid,
      '93000000-0000-4000-8000-000000000598'::uuid,
      '93000000-0000-4000-8000-000000000599'::uuid
    ])
  ) then
    raise exception 'Rejected application correlation created audit evidence';
  end if;
end;
$$;
