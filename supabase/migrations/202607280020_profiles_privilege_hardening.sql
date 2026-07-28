begin;

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_role public.app_role;
  actor_is_active boolean;
begin
  if new.id is distinct from old.id then
    raise exception 'profile id cannot be changed' using errcode = '42501';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'profile created_at cannot be changed' using errcode = '42501';
  end if;

  -- The table owner is already a trusted database authority and must remain
  -- able to maintain fixtures and perform break-glass operations. Application
  -- actors always execute as `authenticated` and are authorized from their
  -- persisted profile, never from client input.
  if current_user = (
    select pg_catalog.pg_get_userbyid(class.relowner)
    from pg_catalog.pg_class as class
    where class.oid = tg_relid
  ) then
    return new;
  end if;

  if current_user <> 'authenticated' then
    raise exception 'only authenticated profiles may update profiles'
      using errcode = '42501';
  end if;

  select profile.role, profile.is_active
  into actor_role, actor_is_active
  from public.profiles as profile
  where profile.id = auth.uid();

  if not coalesce(actor_is_active, false) then
    raise exception 'inactive profiles cannot update profiles'
      using errcode = '42501';
  end if;

  if (
    new.role is distinct from old.role
    or new.is_active is distinct from old.is_active
  ) and actor_role is distinct from 'ceo_admin'::public.app_role then
    raise exception 'only CEO/Admin may change profile role or active status'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_privileged_fields() from public;
grant execute on function public.protect_profile_privileged_fields() to authenticated;

drop trigger if exists profiles_protect_privileged_fields on public.profiles;
create trigger profiles_protect_privileged_fields
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_fields();

commit;
