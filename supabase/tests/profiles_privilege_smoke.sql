\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  (
    '82000000-0000-4000-8000-000000000001',
    'profile-admin@laparpo.test',
    '{"full_name":"Profile Admin"}'
  ),
  (
    '82000000-0000-4000-8000-000000000002',
    'profile-manager@laparpo.test',
    '{"full_name":"Profile Manager"}'
  ),
  (
    '82000000-0000-4000-8000-000000000003',
    'profile-other-manager@laparpo.test',
    '{"full_name":"Other Profile Manager"}'
  ),
  (
    '82000000-0000-4000-8000-000000000004',
    'profile-representative@laparpo.test',
    '{"full_name":"Profile Representative"}'
  ),
  (
    '82000000-0000-4000-8000-000000000005',
    'profile-inactive@laparpo.test',
    '{"full_name":"Inactive Profile"}'
  ),
  (
    '82000000-0000-4000-8000-000000000006',
    'profile-other-admin@laparpo.test',
    '{"full_name":"Other Profile Admin"}'
  );

update public.profiles
set role = case id
  when '82000000-0000-4000-8000-000000000001' then 'ceo_admin'::public.app_role
  when '82000000-0000-4000-8000-000000000002' then 'sales_manager'::public.app_role
  when '82000000-0000-4000-8000-000000000003' then 'sales_manager'::public.app_role
  when '82000000-0000-4000-8000-000000000006' then 'ceo_admin'::public.app_role
  else 'sales_representative'::public.app_role
end
where id::text like '82000000-0000-4000-8000-%';

update public.profiles
set is_active = false
where id = '82000000-0000-4000-8000-000000000005';

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke delete on public.companies from authenticated;

-- CEO/Admin may manage role and active status.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000001',
  false
);

update public.profiles
set role = 'sales_manager'
where id = '82000000-0000-4000-8000-000000000004';

update public.profiles
set role = 'sales_representative'
where id = '82000000-0000-4000-8000-000000000004';

update public.profiles
set is_active = false
where id = '82000000-0000-4000-8000-000000000004';

update public.profiles
set is_active = true
where id = '82000000-0000-4000-8000-000000000004';

update public.profiles
set is_active = true
where id = '82000000-0000-4000-8000-000000000005';

update public.profiles
set is_active = false
where id = '82000000-0000-4000-8000-000000000005';

do $$
declare
  original_created_at timestamptz;
begin
  select created_at into strict original_created_at
  from public.profiles
  where id = '82000000-0000-4000-8000-000000000004';

  begin
    update public.profiles
    set created_at = original_created_at - interval '1 day'
    where id = '82000000-0000-4000-8000-000000000004';

    raise exception 'CEO/Admin changed immutable profile created_at';
  exception
    when insufficient_privilege then null;
  end;

  if exists (
    select 1
    from public.profiles
    where id = '82000000-0000-4000-8000-000000000004'
      and created_at is distinct from original_created_at
  ) then
    raise exception 'profile created_at changed despite immutability guard';
  end if;
end;
$$;

-- Sales Manager cannot escalate self, change another role, demote an
-- administrator, or change any active status.
select set_config(
  'request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000002',
  false
);

do $$
begin
  begin
    update public.profiles
    set role = 'ceo_admin'
    where id = '82000000-0000-4000-8000-000000000002';
    raise exception 'Sales Manager promoted self';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.profiles
    set role = 'ceo_admin'
    where id = '82000000-0000-4000-8000-000000000004';
    raise exception 'Sales Manager promoted another profile';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.profiles
    set role = 'sales_representative'
    where id = '82000000-0000-4000-8000-000000000006';
    raise exception 'Sales Manager demoted CEO/Admin';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.profiles
    set is_active = false
    where id = '82000000-0000-4000-8000-000000000006';
    raise exception 'Sales Manager deactivated CEO/Admin';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.profiles
    set is_active = false
    where id = '82000000-0000-4000-8000-000000000003';
    raise exception 'Sales Manager deactivated another manager';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.profiles
    set is_active = false
    where id = '82000000-0000-4000-8000-000000000004';
    raise exception 'Sales Manager deactivated a representative';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.profiles
    set is_active = true
    where id = '82000000-0000-4000-8000-000000000005';
    raise exception 'Sales Manager activated an inactive profile';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

do $$
begin
  if not exists (
    select 1 from public.profiles
    where id = '82000000-0000-4000-8000-000000000002'
      and role = 'sales_manager'
      and is_active
  ) then
    raise exception 'Sales Manager self-escalation changed persisted state';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = '82000000-0000-4000-8000-000000000003'
      and role = 'sales_manager'
      and is_active
  ) then
    raise exception 'Sales Manager changed another manager';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = '82000000-0000-4000-8000-000000000004'
      and role = 'sales_representative'
      and is_active
  ) then
    raise exception 'Sales Manager changed representative privileges';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = '82000000-0000-4000-8000-000000000006'
      and role = 'ceo_admin'
      and is_active
  ) then
    raise exception 'Sales Manager changed CEO/Admin privileges';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = '82000000-0000-4000-8000-000000000005'
      and role = 'sales_representative'
      and not is_active
  ) then
    raise exception 'Sales Manager activated an inactive profile';
  end if;
end;
$$;

-- Representatives have no profile UPDATE policy and therefore cannot perform
-- privileged mutations even when they submit direct authenticated SQL.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000004',
  false
);

do $$
declare
  affected_rows integer;
begin
  update public.profiles
  set role = 'ceo_admin'
  where id = '82000000-0000-4000-8000-000000000004';
  get diagnostics affected_rows = row_count;

  if affected_rows <> 0 then
    raise exception 'Representative changed role';
  end if;

  update public.profiles
  set is_active = false
  where id = '82000000-0000-4000-8000-000000000003';
  get diagnostics affected_rows = row_count;

  if affected_rows <> 0 then
    raise exception 'Representative changed active status';
  end if;
end;
$$;

-- Inactive actors cannot mutate profiles.
reset role;
update public.profiles
set is_active = false
where id = '82000000-0000-4000-8000-000000000005';

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000005',
  false
);

do $$
declare
  affected_rows integer;
begin
  update public.profiles
  set role = 'ceo_admin'
  where id = '82000000-0000-4000-8000-000000000005';
  get diagnostics affected_rows = row_count;

  if affected_rows <> 0 then
    raise exception 'Inactive profile changed role';
  end if;
end;
$$;

-- An authenticated database role without a user identity cannot mutate.
select set_config('request.jwt.claim.sub', '', false);

do $$
declare
  affected_rows integer;
begin
  update public.profiles
  set is_active = false
  where id = '82000000-0000-4000-8000-000000000006';
  get diagnostics affected_rows = row_count;

  if affected_rows <> 0 then
    raise exception 'Unauthenticated actor changed active status';
  end if;
end;
$$;

reset role;

do $$
begin
  if not exists (
    select 1 from public.profiles
    where id = '82000000-0000-4000-8000-000000000005'
      and role = 'sales_representative'
      and not is_active
  ) then
    raise exception 'Inactive profile mutation changed persisted state';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = '82000000-0000-4000-8000-000000000006'
      and role = 'ceo_admin'
      and is_active
  ) then
    raise exception 'Unauthenticated mutation changed persisted state';
  end if;
end;
$$;
