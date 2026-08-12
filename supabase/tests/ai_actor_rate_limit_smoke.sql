\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  (
    '8c000000-0000-4000-8000-000000000001',
    'ai-rate-active-a@laparpo.test',
    '{"full_name":"AI Rate Active A"}'
  ),
  (
    '8c000000-0000-4000-8000-000000000002',
    'ai-rate-active-b@laparpo.test',
    '{"full_name":"AI Rate Active B"}'
  ),
  (
    '8c000000-0000-4000-8000-000000000003',
    'ai-rate-inactive@laparpo.test',
    '{"full_name":"AI Rate Inactive"}'
  );

update public.profiles
set is_active = false
where id = '8c000000-0000-4000-8000-000000000003';

do $$
begin
  if has_schema_privilege('anon', 'ai_rate_limit_private', 'usage')
    or has_schema_privilege('authenticated', 'ai_rate_limit_private', 'usage')
    or has_schema_privilege('service_role', 'ai_rate_limit_private', 'usage')
  then
    raise exception 'AI limiter private schema is exposed';
  end if;

  if has_table_privilege(
      'anon', 'ai_rate_limit_private.actor_windows', 'select,insert,update,delete'
    ) or has_table_privilege(
      'authenticated', 'ai_rate_limit_private.actor_windows', 'select,insert,update,delete'
    ) or has_table_privilege(
      'service_role', 'ai_rate_limit_private.actor_windows', 'select,insert,update,delete'
    )
  then
    raise exception 'AI limiter state table is exposed';
  end if;

  if exists (
      select 1
      from pg_catalog.pg_proc as procedure
      cross join lateral pg_catalog.aclexplode(
        coalesce(
          procedure.proacl,
          pg_catalog.acldefault('f', procedure.proowner)
        )
      ) as privilege
      where procedure.oid = 'public.consume_ai_actor_rate_limit()'::regprocedure
        and privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    )
    or has_function_privilege('anon', 'public.consume_ai_actor_rate_limit()', 'execute')
    or has_function_privilege('service_role', 'public.consume_ai_actor_rate_limit()', 'execute')
    or not has_function_privilege(
      'authenticated', 'public.consume_ai_actor_rate_limit()', 'execute'
    )
  then
    raise exception 'AI limiter RPC grants are invalid';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'consume_ai_actor_rate_limit'
      and procedure.prosecdef
      and procedure.proconfig @> array['search_path=""']::text[]
      and procedure.pronargs = 0
  ) then
    raise exception 'AI limiter RPC is not a hardened zero-argument SECURITY DEFINER';
  end if;
end;
$$;

-- Anonymous and inactive actors fail before any state row is created.
do $$
begin
  begin
    perform public.consume_ai_actor_rate_limit();
    raise exception 'Anonymous actor consumed AI capacity';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '8c000000-0000-4000-8000-000000000003',
  false
);
do $$
begin
  begin
    perform public.consume_ai_actor_rate_limit();
    raise exception 'Inactive actor consumed AI capacity';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;
reset role;

select 1 / (count(*) = 0)::integer
from ai_rate_limit_private.actor_windows;

-- Direct state reads and writes remain unavailable to ordinary callers.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '8c000000-0000-4000-8000-000000000001',
  false
);
do $$
begin
  begin
    perform accepted_at from ai_rate_limit_private.actor_windows;
    raise exception 'Authenticated actor read AI limiter state';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into ai_rate_limit_private.actor_windows (
      actor_id, accepted_at, updated_at
    ) values (
      '8c000000-0000-4000-8000-000000000001',
      array[pg_catalog.clock_timestamp()],
      pg_catalog.clock_timestamp()
    );
    raise exception 'Authenticated actor wrote AI limiter state';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- A/B/H: first active request is accepted, immediate second is denied, and a
-- different actor receives an independent budget.
select 1 / ((public.consume_ai_actor_rate_limit() ->> 'allowed')::boolean)::integer;
select 1 / (not (public.consume_ai_actor_rate_limit() ->> 'allowed')::boolean)::integer;
select set_config(
  'request.jwt.claim.sub',
  '8c000000-0000-4000-8000-000000000002',
  false
);
select 1 / ((public.consume_ai_actor_rate_limit() ->> 'allowed')::boolean)::integer;
reset role;

-- C: a timestamp at the five-second boundary is eligible; just inside it is not.
update ai_rate_limit_private.actor_windows
set accepted_at = array[pg_catalog.clock_timestamp() - interval '5 seconds'],
    updated_at = pg_catalog.clock_timestamp()
where actor_id = '8c000000-0000-4000-8000-000000000001';
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '8c000000-0000-4000-8000-000000000001',
  false
);
select 1 / ((public.consume_ai_actor_rate_limit() ->> 'allowed')::boolean)::integer;
reset role;

update ai_rate_limit_private.actor_windows
set accepted_at = array[pg_catalog.clock_timestamp() - interval '4.9 seconds'],
    updated_at = pg_catalog.clock_timestamp()
where actor_id = '8c000000-0000-4000-8000-000000000001';
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '8c000000-0000-4000-8000-000000000001',
  false
);
select 1 / (not (public.consume_ai_actor_rate_limit() ->> 'allowed')::boolean)::integer;
reset role;

-- D/E: four cooled-down accepted timestamps permit the fifth; the immediate
-- sixth candidate is denied and stored state remains bounded to five.
update ai_rate_limit_private.actor_windows
set accepted_at = array[
      pg_catalog.clock_timestamp() - interval '25 seconds',
      pg_catalog.clock_timestamp() - interval '20 seconds',
      pg_catalog.clock_timestamp() - interval '15 seconds',
      pg_catalog.clock_timestamp() - interval '10 seconds'
    ],
    updated_at = pg_catalog.clock_timestamp()
where actor_id = '8c000000-0000-4000-8000-000000000001';
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '8c000000-0000-4000-8000-000000000001',
  false
);
select 1 / ((public.consume_ai_actor_rate_limit() ->> 'allowed')::boolean)::integer;
select 1 / (not (public.consume_ai_actor_rate_limit() ->> 'allowed')::boolean)::integer;
reset role;
select 1 / (pg_catalog.cardinality(accepted_at) = 5)::integer
from ai_rate_limit_private.actor_windows
where actor_id = '8c000000-0000-4000-8000-000000000001';

-- F/G: an oldest timestamp just inside 60 seconds still occupies capacity;
-- at the exact boundary it is pruned and capacity becomes available.
update ai_rate_limit_private.actor_windows
set accepted_at = array[
      pg_catalog.clock_timestamp() - interval '59.9 seconds',
      pg_catalog.clock_timestamp() - interval '45 seconds',
      pg_catalog.clock_timestamp() - interval '35 seconds',
      pg_catalog.clock_timestamp() - interval '25 seconds',
      pg_catalog.clock_timestamp() - interval '5 seconds'
    ],
    updated_at = pg_catalog.clock_timestamp()
where actor_id = '8c000000-0000-4000-8000-000000000001';
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '8c000000-0000-4000-8000-000000000001',
  false
);
select 1 / (not (public.consume_ai_actor_rate_limit() ->> 'allowed')::boolean)::integer;
reset role;

update ai_rate_limit_private.actor_windows
set accepted_at = array[
      pg_catalog.clock_timestamp() - interval '60 seconds',
      pg_catalog.clock_timestamp() - interval '45 seconds',
      pg_catalog.clock_timestamp() - interval '35 seconds',
      pg_catalog.clock_timestamp() - interval '25 seconds',
      pg_catalog.clock_timestamp() - interval '5 seconds'
    ],
    updated_at = pg_catalog.clock_timestamp()
where actor_id = '8c000000-0000-4000-8000-000000000001';
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '8c000000-0000-4000-8000-000000000001',
  false
);
select 1 / ((public.consume_ai_actor_rate_limit() ->> 'allowed')::boolean)::integer;
reset role;

-- Operational limiter consumption creates no H7 event and changes no CRM row.
select 1 / (count(*) = 0)::integer
from public.mutation_audit_events
where actor_id in (
  '8c000000-0000-4000-8000-000000000001',
  '8c000000-0000-4000-8000-000000000002'
);

select 1 / (count(*) = 0)::integer
from public.companies
where created_by in (
  '8c000000-0000-4000-8000-000000000001',
  '8c000000-0000-4000-8000-000000000002'
);

select 1 / (count(*) = 0)::integer
from public.leads
where created_by in (
  '8c000000-0000-4000-8000-000000000001',
  '8c000000-0000-4000-8000-000000000002'
);

select 1 / (count(*) = 0)::integer
from public.opportunities
where owner_id in (
  '8c000000-0000-4000-8000-000000000001',
  '8c000000-0000-4000-8000-000000000002'
);

delete from ai_rate_limit_private.actor_windows
where actor_id in (
  '8c000000-0000-4000-8000-000000000001',
  '8c000000-0000-4000-8000-000000000002'
);
delete from auth.users
where id in (
  '8c000000-0000-4000-8000-000000000001',
  '8c000000-0000-4000-8000-000000000002',
  '8c000000-0000-4000-8000-000000000003'
);
