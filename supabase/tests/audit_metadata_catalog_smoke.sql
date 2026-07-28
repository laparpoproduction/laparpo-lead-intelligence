\set ON_ERROR_STOP on

create temp table h3_audit_metadata_coverage (
  table_name text primary key,
  audit_columns text[] not null,
  protection text not null,
  trigger_name text
);

insert into h3_audit_metadata_coverage (
  table_name,
  audit_columns,
  protection,
  trigger_name
) values
  (
    'profiles',
    array['created_at'],
    'existing_trigger',
    'profiles_protect_privileged_fields'
  ),
  (
    'companies',
    array['created_at', 'created_by'],
    'h3_trigger',
    'companies_protect_creation_audit_metadata'
  ),
  (
    'contacts',
    array['created_at', 'created_by'],
    'h3_trigger',
    'contacts_protect_creation_audit_metadata'
  ),
  (
    'lead_sources',
    array['created_at'],
    'h3_trigger',
    'lead_sources_protect_creation_audit_metadata'
  ),
  (
    'leads',
    array['created_at', 'created_by'],
    'h3_trigger',
    'leads_05_protect_creation_audit_metadata'
  ),
  (
    'lead_signals',
    array['created_at'],
    'h3_trigger',
    'lead_signals_protect_creation_audit_metadata'
  ),
  (
    'lead_activities',
    array['created_at', 'created_by'],
    'h3_trigger',
    'lead_activities_05_protect_creation_audit_metadata'
  ),
  (
    'opportunities',
    array['created_at'],
    'h3_trigger',
    'opportunities_20_protect_creation_audit_metadata'
  ),
  (
    'sales_tasks',
    array['created_at'],
    'h3_trigger',
    'sales_tasks_protect_creation_audit_metadata'
  ),
  (
    'company_mutation_confirmations',
    array['actor_id', 'created_at'],
    'h3_trigger',
    'company_mutation_confirmations_protect_creation_audit_metadata'
  ),
  (
    'contact_mutation_confirmations',
    array['actor_id', 'created_at'],
    'existing_trigger',
    'contact_mutation_confirmations_protect_fields'
  ),
  (
    'lead_mutation_confirmations',
    array['actor_id', 'created_at'],
    'no_update_ledger',
    null
  ),
  (
    'lead_conversions',
    array['created_at', 'created_by'],
    'no_update_ledger',
    null
  );

do $$
declare
  unclassified_tables text[];
  stale_classifications text[];
  inventory_mismatches text[];
begin
  select pg_catalog.array_agg(
    relation.relname::text order by relation.relname
  )
  into unclassified_tables
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p')
    and exists (
      select 1
      from pg_catalog.pg_attribute as attribute
      where attribute.attrelid = relation.oid
        and attribute.attname in ('created_at', 'created_by')
        and attribute.attnum > 0
        and not attribute.attisdropped
    )
    and not exists (
      select 1
      from h3_audit_metadata_coverage as coverage
      where coverage.table_name = relation.relname
    );

  if unclassified_tables is not null then
    raise exception 'Unclassified creation audit metadata tables'
      using
        errcode = '23514',
        detail = pg_catalog.array_to_string(unclassified_tables, ',');
  end if;

  select pg_catalog.array_agg(coverage.table_name order by coverage.table_name)
  into stale_classifications
  from h3_audit_metadata_coverage as coverage
  where pg_catalog.to_regclass(
    pg_catalog.format('public.%I', coverage.table_name)
  ) is null;

  if stale_classifications is not null then
    raise exception 'Audit metadata coverage contains missing tables'
      using
        errcode = '23514',
        detail = pg_catalog.array_to_string(stale_classifications, ',');
  end if;

  select pg_catalog.array_agg(coverage.table_name order by coverage.table_name)
  into inventory_mismatches
  from h3_audit_metadata_coverage as coverage
  where coverage.audit_columns is distinct from (
    select pg_catalog.array_agg(
      attribute.attname::text order by attribute.attname
    )
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = pg_catalog.to_regclass(
      pg_catalog.format('public.%I', coverage.table_name)
    )
      and attribute.attnum > 0
      and not attribute.attisdropped
      and (
        attribute.attname in ('created_at', 'created_by')
        or (
          coverage.table_name like '%_mutation_confirmations'
          and attribute.attname = 'actor_id'
        )
      )
  );

  if inventory_mismatches is not null then
    raise exception 'Creation audit metadata inventory mismatch'
      using
        errcode = '23514',
        detail = pg_catalog.array_to_string(inventory_mismatches, ',');
  end if;
end;
$$;

do $$
declare
  guard_function oid :=
    'public.reject_creation_audit_metadata_update()'::regprocedure;
  coverage h3_audit_metadata_coverage%rowtype;
  target_relation oid;
  protected_columns text[];
begin
  if (
    select function.prosecdef
    from pg_catalog.pg_proc as function
    where function.oid = guard_function
  ) then
    raise exception 'H3 guard must use SECURITY INVOKER';
  end if;

  if not (
    select coalesce(
      function.proconfig @> array['search_path=""']::text[],
      false
    )
    from pg_catalog.pg_proc as function
    where function.oid = guard_function
  ) then
    raise exception 'H3 guard search_path is not empty';
  end if;

  if pg_catalog.has_function_privilege(
    'authenticated',
    guard_function,
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'anon',
    guard_function,
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'service_role',
    guard_function,
    'EXECUTE'
  ) then
    raise exception 'Application role can execute the H3 guard directly';
  end if;

  for coverage in
    select *
    from h3_audit_metadata_coverage
    where protection = 'h3_trigger'
    order by table_name
  loop
    target_relation := pg_catalog.to_regclass(
      pg_catalog.format('public.%I', coverage.table_name)
    );

    if not exists (
      select 1
      from pg_catalog.pg_trigger as trigger
      where trigger.tgrelid = target_relation
        and trigger.tgname = coverage.trigger_name
        and not trigger.tgisinternal
        and trigger.tgenabled = 'O'
        and trigger.tgfoid = guard_function
        and (trigger.tgtype & 1) = 1
        and (trigger.tgtype & 2) = 2
        and (trigger.tgtype & 16) = 16
        and (trigger.tgtype & (4 | 8 | 32)) = 0
    ) then
      raise exception 'H3 trigger metadata mismatch'
        using
          errcode = '23514',
          detail = pg_catalog.format(
            'immutable_creation_audit_metadata:%s',
            coverage.table_name
          );
    end if;

    select pg_catalog.array_agg(
      attribute.attname::text order by attribute.attname
    )
    into protected_columns
    from pg_catalog.pg_trigger as trigger
    join pg_catalog.pg_attribute as attribute
      on attribute.attrelid = trigger.tgrelid
      and attribute.attnum = any(trigger.tgattr::smallint[])
    where trigger.tgrelid = target_relation
      and trigger.tgname = coverage.trigger_name;

    if protected_columns is distinct from coverage.audit_columns then
      raise exception 'H3 trigger column coverage mismatch'
        using
          errcode = '23514',
          detail = pg_catalog.format(
            'immutable_creation_audit_metadata:%s',
            coverage.table_name
          );
    end if;
  end loop;

  if (
    select count(*)
    from pg_catalog.pg_trigger as trigger
    where trigger.tgfoid = guard_function
      and not trigger.tgisinternal
  ) <> 9 then
    raise exception 'Unexpected H3 trigger count';
  end if;
end;
$$;

do $$
declare
  profile_relation oid := 'public.profiles'::regclass;
  contact_confirmation_relation oid :=
    'public.contact_mutation_confirmations'::regclass;
begin
  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger
    where trigger.tgrelid = profile_relation
      and trigger.tgname = 'profiles_protect_privileged_fields'
      and not trigger.tgisinternal
      and (trigger.tgtype & 1) = 1
      and (trigger.tgtype & 2) = 2
      and (trigger.tgtype & 16) = 16
      and trigger.tgfoid =
        'public.protect_profile_privileged_fields()'::regprocedure
  ) then
    raise exception 'H1 profile creation-time protection is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger
    where trigger.tgrelid = contact_confirmation_relation
      and trigger.tgname = 'contact_mutation_confirmations_protect_fields'
      and not trigger.tgisinternal
      and (trigger.tgtype & 1) = 1
      and (trigger.tgtype & 2) = 2
      and (trigger.tgtype & 16) = 16
      and trigger.tgfoid =
        'public.protect_contact_confirmation_fields()'::regprocedure
  ) then
    raise exception 'Contact confirmation binding protection is missing';
  end if;
end;
$$;

do $$
declare
  ledger_table text;
begin
  foreach ledger_table in array array[
    'lead_mutation_confirmations',
    'lead_conversions'
  ]
  loop
    if pg_catalog.has_table_privilege(
      'authenticated',
      pg_catalog.format('public.%I', ledger_table),
      'UPDATE'
    ) then
      raise exception 'Authenticated retains UPDATE on immutable ledger'
        using
          errcode = '23514',
          detail = ledger_table;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_policy as policy
      where policy.polrelid = pg_catalog.to_regclass(
        pg_catalog.format('public.%I', ledger_table)
      )
        and policy.polcmd in ('*', 'w')
        and (
          select role.oid
          from pg_catalog.pg_roles as role
          where role.rolname = 'authenticated'
        ) = any(policy.polroles)
    ) then
      raise exception 'Authenticated UPDATE policy exists on immutable ledger'
        using
          errcode = '23514',
          detail = ledger_table;
    end if;
  end loop;
end;
$$;

set role authenticated;
do $$
begin
  begin
    update public.lead_mutation_confirmations
    set created_at = created_at
    where false;
    raise exception 'Authenticated updated Lead confirmation ledger';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.lead_conversions
    set created_at = created_at
    where false;
    raise exception 'Authenticated updated conversion ledger';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;
reset role;

select
  coverage.table_name,
  pg_catalog.array_to_string(coverage.audit_columns, ',') as audit_columns,
  coverage.protection,
  coverage.trigger_name,
  (
    select count(*)
    from pg_catalog.pg_policy as policy
    where policy.polrelid = pg_catalog.to_regclass(
      pg_catalog.format('public.%I', coverage.table_name)
    )
      and policy.polcmd in ('*', 'w')
  ) as update_policy_count,
  pg_catalog.has_table_privilege(
    'authenticated',
    pg_catalog.format('public.%I', coverage.table_name),
    'UPDATE'
  ) as authenticated_can_update
from h3_audit_metadata_coverage as coverage
order by coverage.table_name;
