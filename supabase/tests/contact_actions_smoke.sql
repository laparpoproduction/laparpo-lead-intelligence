\set ON_ERROR_STOP on

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  false
);

do $$
begin
  begin
    insert into public.contact_mutation_confirmations (
      confirmation_id,
      actor_id,
      operation,
      submission_hash
    ) values (
      '91000000-0000-4000-8000-000000000001',
      '00000000-0000-0000-0000-000000000001',
      'create',
      repeat('1', 64)
    );
    raise exception 'Authenticated user inserted a Contact confirmation directly';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.contact_mutation_confirmations (
      confirmation_id,
      actor_id,
      operation,
      contact_id,
      submission_hash,
      consumed_at
    ) values (
      '91000000-0000-4000-8000-000000000002',
      '00000000-0000-0000-0000-000000000001',
      'update',
      '20000000-0000-0000-0000-000000000026',
      repeat('2', 64),
      now()
    );
    raise exception 'Authenticated user pre-consumed an update confirmation';
  exception
    when insufficient_privilege then null;
  end;

  if has_function_privilege(
    current_user,
    'public.claim_contact_mutation_confirmation()',
    'execute'
  ) or has_function_privilege(
    current_user,
    'public.finalize_contact_mutation_confirmation()',
    'execute'
  ) then
    raise exception 'Authenticated user can execute an internal Contact ledger helper';
  end if;
end;
$$;

do $$
declare
  first_result jsonb;
  replay_result jsonb;
  retry_result jsonb;
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

  begin
    perform public.create_confirmed_duplicate_contact(
      '90000000-0000-4000-8000-000000000004',
      repeat('e', 64),
      jsonb_build_object(
        'full_name', 'Failed then retried Contact',
        'source_type', 'public_directory',
        'discovered_at', now(),
        'is_primary_contact', false,
        'contact_status', 'discovered'
      )
    );
    raise exception 'Invalid Contact create unexpectedly succeeded';
  exception
    when not_null_violation then null;
  end;

  if exists (
    select 1 from public.contact_mutation_confirmations
    where confirmation_id = '90000000-0000-4000-8000-000000000004'
  ) then
    raise exception 'Failed Contact create left a ledger claim';
  end if;

  retry_result := public.create_confirmed_duplicate_contact(
    '90000000-0000-4000-8000-000000000004',
    repeat('e', 64),
    jsonb_build_object(
      'full_name', 'Failed then retried Contact',
      'source_url', 'https://contacts-sample.test/team/retry-safe',
      'source_type', 'public_directory',
      'discovered_at', now(),
      'is_primary_contact', false,
      'contact_status', 'discovered'
    )
  );

  if (retry_result ->> 'already_processed')::boolean
    or not exists (
      select 1 from public.contact_mutation_confirmations
      where confirmation_id = '90000000-0000-4000-8000-000000000004'
        and contact_id = (retry_result ->> 'contact_id')::uuid
        and consumed_at is not null
    ) then
    raise exception 'Failed Contact create was not safely retryable';
  end if;
end;
$$;

do $$
declare
  affected_rows integer;
begin
  begin
    update public.contact_mutation_confirmations
    set consumed_at = clock_timestamp()
    where confirmation_id = '90000000-0000-4000-8000-000000000001';
    get diagnostics affected_rows = row_count;
    if affected_rows <> 0 then
      raise exception 'Authenticated user changed Contact confirmation consumption state';
    end if;
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.contact_mutation_confirmations
    set contact_id = '20000000-0000-0000-0000-000000000026'
    where confirmation_id = '90000000-0000-4000-8000-000000000001';
    get diagnostics affected_rows = row_count;
    if affected_rows <> 0 then
      raise exception 'Authenticated user changed a confirmed create result';
    end if;
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.contact_mutation_confirmations
    set contact_id = '20000000-0000-0000-0000-000000000026'
    where confirmation_id = '90000000-0000-4000-8000-000000000002';
    get diagnostics affected_rows = row_count;
    if affected_rows <> 0 then
      raise exception 'Authenticated user changed an update target binding';
    end if;
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.contact_mutation_confirmations
    set actor_id = '00000000-0000-0000-0000-000000000002',
        operation = 'update',
        submission_hash = repeat('f', 64),
        contact_id = '20000000-0000-0000-0000-000000000026'
    where confirmation_id = '90000000-0000-4000-8000-000000000001';
    get diagnostics affected_rows = row_count;
    if affected_rows <> 0 then
      raise exception 'Authenticated user changed Contact confirmation bindings';
    end if;
  exception
    when insufficient_privilege then null;
  end;
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
