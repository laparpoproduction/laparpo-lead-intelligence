\set ON_ERROR_STOP on

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  false
);

do $$
declare
  first_result jsonb;
  replay_result jsonb;
  created_contact_id uuid;
begin
  first_result := public.create_confirmed_duplicate_contact(
    '90000000-0000-4000-8000-000000000001',
    repeat('a', 64),
    jsonb_build_object(
      'company_id', '10000000-0000-0000-0000-000000000020',
      'full_name', 'Confirmed Duplicate Contact',
      'work_email', 'confirmed-duplicate@contacts-sample.test',
      'source_url', 'https://contacts-sample.test/team/confirmed-duplicate',
      'source_type', 'company_website',
      'discovered_at', now(),
      'is_primary_contact', false,
      'contact_status', 'discovered'
    )
  );
  created_contact_id := (first_result ->> 'contact_id')::uuid;

  replay_result := public.create_confirmed_duplicate_contact(
    '90000000-0000-4000-8000-000000000001',
    repeat('a', 64),
    jsonb_build_object(
      'company_id', '10000000-0000-0000-0000-000000000020',
      'full_name', 'Confirmed Duplicate Contact',
      'work_email', 'confirmed-duplicate@contacts-sample.test',
      'source_url', 'https://contacts-sample.test/team/confirmed-duplicate',
      'source_type', 'company_website',
      'discovered_at', now(),
      'is_primary_contact', false,
      'contact_status', 'discovered'
    )
  );

  if (first_result ->> 'already_processed')::boolean
    or not (replay_result ->> 'already_processed')::boolean
    or (replay_result ->> 'contact_id')::uuid <> created_contact_id then
    raise exception 'Confirmed Contact create replay did not return its original result';
  end if;

  if (
    select count(*)
    from public.contacts
    where work_email = 'confirmed-duplicate@contacts-sample.test'
  ) <> 1 then
    raise exception 'Confirmed Contact create produced multiple records';
  end if;

  if not exists (
    select 1
    from public.contact_mutation_confirmations
    where confirmation_id = '90000000-0000-4000-8000-000000000001'
      and actor_id = '00000000-0000-0000-0000-000000000001'
      and operation = 'create'
      and contact_id = created_contact_id
      and submission_hash = repeat('a', 64)
      and consumed_at is not null
  ) then
    raise exception 'Confirmed Contact result was not persisted in the ledger';
  end if;

  first_result := public.update_confirmed_duplicate_contact(
    '90000000-0000-4000-8000-000000000002',
    repeat('b', 64),
    created_contact_id,
    '{"notes":"Applied once"}'::jsonb
  );
  replay_result := public.update_confirmed_duplicate_contact(
    '90000000-0000-4000-8000-000000000002',
    repeat('b', 64),
    created_contact_id,
    '{"notes":"Must not be applied on replay"}'::jsonb
  );

  if (first_result ->> 'already_processed')::boolean
    or not (replay_result ->> 'already_processed')::boolean
    or not exists (
      select 1 from public.contacts
      where id = created_contact_id and notes = 'Applied once'
    ) then
    raise exception 'Confirmed Contact update was reapplied during replay';
  end if;

  begin
    perform public.create_confirmed_duplicate_contact(
      '90000000-0000-4000-8000-000000000001',
      repeat('c', 64),
      '{}'::jsonb
    );
    raise exception 'Submission-hash isolation was bypassed';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    perform public.update_confirmed_duplicate_contact(
      '90000000-0000-4000-8000-000000000001',
      repeat('a', 64),
      created_contact_id,
      '{"notes":"Cross-operation"}'::jsonb
    );
    raise exception 'Operation isolation was bypassed';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    perform public.update_confirmed_duplicate_contact(
      '90000000-0000-4000-8000-000000000003',
      repeat('d', 64),
      '99999999-9999-4999-8999-999999999999',
      '{"notes":"Missing"}'::jsonb
    );
    raise exception 'Missing Contact update unexpectedly succeeded';
  exception
    when no_data_found then null;
  end;

  if exists (
    select 1 from public.contact_mutation_confirmations
    where confirmation_id = '90000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'Failed mutation consumed its idempotency record';
  end if;
end;
$$;

reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000002',
  false
);

do $$
begin
  if exists (
    select 1
    from public.contact_mutation_confirmations
    where confirmation_id in (
      '90000000-0000-4000-8000-000000000001',
      '90000000-0000-4000-8000-000000000002'
    )
  ) then
    raise exception 'Another actor read Contact confirmation records';
  end if;

  begin
    perform public.create_confirmed_duplicate_contact(
      '90000000-0000-4000-8000-000000000001',
      repeat('a', 64),
      '{}'::jsonb
    );
    raise exception 'Another actor replayed a Contact confirmation';
  exception
    when invalid_parameter_value then null;
  end;
end;
$$;

reset role;
