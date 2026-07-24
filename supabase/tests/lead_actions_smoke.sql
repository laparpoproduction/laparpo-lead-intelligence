\set ON_ERROR_STOP on

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000002',
  false
);

do $$
begin
  begin
    insert into public.lead_mutation_confirmations (
      confirmation_id, actor_id, operation, submission_hash
    ) values (
      '79000000-0000-4000-8000-000000000090',
      '71000000-0000-4000-8000-000000000002',
      'create',
      repeat('9', 64)
    );
    raise exception 'Authenticated user inserted a Lead confirmation directly';
  exception
    when insufficient_privilege then null;
  end;

  if has_function_privilege(
    current_user,
    'public.claim_lead_mutation_confirmation()',
    'execute'
  ) or has_function_privilege(
    current_user,
    'public.finalize_lead_mutation_confirmation()',
    'execute'
  ) then
    raise exception 'Authenticated user can execute an internal Lead ledger helper';
  end if;

  begin
    update public.lead_mutation_confirmations
    set consumed_at = clock_timestamp(),
        lead_id = '74000000-0000-4000-8000-000000000001',
        actor_id = '71000000-0000-4000-8000-000000000003',
        operation = 'update',
        submission_hash = repeat('8', 64)
    where confirmation_id = '79000000-0000-4000-8000-000000000090';
    raise exception 'Authenticated user updated a Lead confirmation directly';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

do $$
declare
  first_result jsonb;
  replay_result jsonb;
  retry_result jsonb;
  created_lead_id uuid;
begin
  first_result := public.create_confirmed_duplicate_lead(
    '79000000-0000-4000-8000-000000000001',
    repeat('a', 64),
    jsonb_build_object(
      'title', 'Confirmed duplicate Lead',
      'stage', 'new',
      'lead_status', 'active',
      'qualification_status', 'unreviewed',
      'priority', 'normal',
      'currency', 'MYR',
      'source_type', 'manual',
      'discovered_at', now()
    )
  );
  created_lead_id := (first_result ->> 'lead_id')::uuid;

  replay_result := public.create_confirmed_duplicate_lead(
    '79000000-0000-4000-8000-000000000001',
    repeat('a', 64),
    jsonb_build_object(
      'title', 'This replay must not create a second Lead',
      'stage', 'new',
      'lead_status', 'active',
      'qualification_status', 'unreviewed',
      'priority', 'normal',
      'currency', 'MYR',
      'source_type', 'manual',
      'discovered_at', now()
    )
  );

  if (first_result ->> 'already_processed')::boolean
    or not (replay_result ->> 'already_processed')::boolean
    or (replay_result ->> 'lead_id')::uuid <> created_lead_id then
    raise exception 'Confirmed Lead create replay did not return its original result';
  end if;

  if (
    select count(*)
    from public.leads
    where id = created_lead_id
  ) <> 1 then
    raise exception 'Confirmed Lead create did not persist exactly one Lead';
  end if;

  if not exists (
    select 1
    from public.lead_mutation_confirmations
    where confirmation_id = '79000000-0000-4000-8000-000000000001'
      and actor_id = '71000000-0000-4000-8000-000000000002'
      and operation = 'create'
      and lead_id = created_lead_id
      and submission_hash = repeat('a', 64)
      and consumed_at is not null
  ) then
    raise exception 'Confirmed Lead result was not persisted in the ledger';
  end if;

  first_result := public.update_confirmed_duplicate_lead(
    '79000000-0000-4000-8000-000000000002',
    repeat('b', 64),
    created_lead_id,
    '{"notes":"Applied once"}'::jsonb
  );
  replay_result := public.update_confirmed_duplicate_lead(
    '79000000-0000-4000-8000-000000000002',
    repeat('b', 64),
    created_lead_id,
    '{"notes":"Must not be applied on replay"}'::jsonb
  );

  if (first_result ->> 'already_processed')::boolean
    or not (replay_result ->> 'already_processed')::boolean
    or not exists (
      select 1 from public.leads
      where id = created_lead_id and notes = 'Applied once'
    ) then
    raise exception 'Confirmed Lead update was reapplied during replay';
  end if;

  begin
    perform public.update_confirmed_duplicate_lead(
      '79000000-0000-4000-8000-000000000001',
      repeat('a', 64),
      created_lead_id,
      '{"notes":"Cross operation"}'::jsonb
    );
    raise exception 'Create confirmation was reused for update';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    perform public.update_confirmed_duplicate_lead(
      '79000000-0000-4000-8000-000000000002',
      repeat('b', 64),
      '74000000-0000-4000-8000-000000000002',
      '{"notes":"Wrong target"}'::jsonb
    );
    raise exception 'Update confirmation was reused for another Lead';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    perform public.create_confirmed_duplicate_lead(
      '79000000-0000-4000-8000-000000000003',
      repeat('c', 64),
      jsonb_build_object(
        'stage', 'new',
        'lead_status', 'active',
        'qualification_status', 'unreviewed',
        'priority', 'normal',
        'currency', 'MYR',
        'source_type', 'manual',
        'discovered_at', now()
      )
    );
    raise exception 'Invalid Lead create unexpectedly succeeded';
  exception
    when check_violation then null;
  end;

  if exists (
    select 1 from public.lead_mutation_confirmations
    where confirmation_id = '79000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'Failed Lead create left a ledger claim';
  end if;

  retry_result := public.create_confirmed_duplicate_lead(
    '79000000-0000-4000-8000-000000000003',
    repeat('c', 64),
    jsonb_build_object(
      'title', 'Retry-safe confirmed Lead',
      'stage', 'new',
      'lead_status', 'active',
      'qualification_status', 'unreviewed',
      'priority', 'normal',
      'currency', 'MYR',
      'source_type', 'manual',
      'discovered_at', now()
    )
  );

  if (retry_result ->> 'already_processed')::boolean then
    raise exception 'Failed confirmed Lead mutation was not safely retryable';
  end if;
end;
$$;

-- A different actor cannot reuse the manager's confirmation binding.
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000003',
  false
);
do $$
begin
  begin
    perform public.create_confirmed_duplicate_lead(
      '79000000-0000-4000-8000-000000000001',
      repeat('a', 64),
      jsonb_build_object(
        'title', 'Cross-actor replay',
        'stage', 'new',
        'lead_status', 'active',
        'qualification_status', 'unreviewed',
        'priority', 'normal',
        'currency', 'MYR',
        'source_type', 'manual',
        'discovered_at', now()
      )
    );
    raise exception 'Another actor reused a Lead confirmation';
  exception
    when invalid_parameter_value then null;
  end;
end;
$$;

reset role;
