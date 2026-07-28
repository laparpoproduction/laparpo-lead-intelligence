begin;

-- Companies are archived through deleted_at. Remove every RLS path that could
-- authorize a physical DELETE, including any historical policy name that may
-- still exist on an upgraded database.
do $$
declare
  policy_name text;
begin
  for policy_name in
    select policy.polname
    from pg_catalog.pg_policy as policy
    join pg_catalog.pg_class as relation
      on relation.oid = policy.polrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'companies'
      and policy.polcmd = 'd'
    order by policy.polname
  loop
    execute format(
      'drop policy %I on public.companies',
      policy_name
    );
  end loop;
end;
$$;

revoke delete on table public.companies from authenticated;
revoke delete on table public.companies from public;

-- Supabase provides anon in deployed environments. Keep the migration usable
-- in plain PostgreSQL validation databases that may not define that role.
do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'anon'
  ) then
    execute 'revoke delete on table public.companies from anon';
  end if;
end;
$$;

-- RLS and table grants are both necessary boundaries, but neither protects
-- against a future grant/policy regression or a BYPASSRLS application role.
-- The exact table owner retains intentional offline break-glass authority.
create or replace function public.prevent_company_hard_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  table_owner name;
begin
  select pg_catalog.pg_get_userbyid(relation.relowner)
  into table_owner
  from pg_catalog.pg_class as relation
  where relation.oid = tg_relid;

  if current_user = table_owner then
    return old;
  end if;

  raise exception 'Companies must be archived instead of permanently deleted'
    using errcode = '42501';
end;
$$;

revoke all on function public.prevent_company_hard_delete() from public;
revoke all on function public.prevent_company_hard_delete() from authenticated;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'anon'
  ) then
    execute
      'revoke all on function public.prevent_company_hard_delete() from anon';
  end if;
end;
$$;

drop trigger if exists companies_prevent_hard_delete on public.companies;
create trigger companies_prevent_hard_delete
  before delete on public.companies
  for each row execute function public.prevent_company_hard_delete();

comment on function public.prevent_company_hard_delete() is
  'Rejects physical Company deletion outside exact table-owner break-glass maintenance. Normal lifecycle uses companies.deleted_at.';

-- Fail the migration atomically if role inheritance or an unexpected ACL
-- still leaves an application-facing role with DELETE authority.
do $$
begin
  if pg_catalog.has_table_privilege(
    'authenticated',
    'public.companies',
    'DELETE'
  ) then
    raise exception 'authenticated retains DELETE privilege on public.companies'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'anon'
  ) and pg_catalog.has_table_privilege(
    'anon',
    'public.companies',
    'DELETE'
  ) then
    raise exception 'anon retains DELETE privilege on public.companies'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(relation.relacl, pg_catalog.acldefault('r', relation.relowner))
    ) as privilege
    where namespace.nspname = 'public'
      and relation.relname = 'companies'
      and privilege.grantee = 0
      and privilege.privilege_type = 'DELETE'
  ) then
    raise exception 'PUBLIC retains DELETE privilege on public.companies'
      using errcode = '42501';
  end if;
end;
$$;

commit;
