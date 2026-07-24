begin;

alter type public.activity_type add value if not exists 'follow_up';

alter table public.lead_activities rename column user_id to created_by;
alter table public.lead_activities rename column notes to description;
alter table public.lead_activities rename column follow_up_at to next_follow_up_at;

alter table public.lead_activities
  add column subject text,
  add column outcome text,
  add column assigned_to uuid,
  add column updated_at timestamptz not null default now(),
  add column deleted_at timestamptz;

alter table public.lead_activities
  alter column description drop not null;

update public.lead_activities as activity
set created_by = lead.created_by
from public.leads as lead
where activity.lead_id = lead.id
  and activity.created_by is null;

alter table public.lead_activities
  drop constraint if exists activities_actor_id_fkey,
  drop constraint if exists lead_activities_user_id_fkey,
  drop constraint if exists lead_activities_created_by_fkey,
  alter column created_by set not null,
  add constraint lead_activities_created_by_fk
    foreign key (created_by) references public.profiles(id) on delete restrict,
  add constraint lead_activities_assigned_to_fk
    foreign key (assigned_to) references public.profiles(id) on delete set null,
  add constraint lead_activities_subject_length_check
    check (subject is null or char_length(btrim(subject)) between 1 and 240),
  add constraint lead_activities_description_length_check
    check (description is null or char_length(btrim(description)) between 1 and 10000),
  add constraint lead_activities_outcome_length_check
    check (outcome is null or char_length(btrim(outcome)) between 1 and 2000);

create or replace function public.normalise_lead_activity_record()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.subject := public.normalise_lead_text(new.subject);
  new.description := public.normalise_lead_text(new.description);
  new.outcome := public.normalise_lead_text(new.outcome);
  return new;
end;
$$;

create or replace function public.protect_lead_activity_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if not public.is_active_user() then
    raise exception 'Inactive users cannot update Lead activities' using errcode = '42501';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by cannot be changed' using errcode = '42501';
  end if;
  if new.lead_id is distinct from old.lead_id then
    raise exception 'lead_id cannot be changed' using errcode = '42501';
  end if;
  if new.deleted_at is distinct from old.deleted_at
    and not (
      public.is_sales_management()
      or old.created_by = auth.uid()
      or old.assigned_to = auth.uid()
    )
  then
    raise exception 'Only activity owners or management can archive Lead activities'
      using errcode = '42501';
  end if;
  if not public.is_sales_management()
    and new.assigned_to is distinct from old.assigned_to
    and not (
      old.assigned_to is null
      and old.created_by = auth.uid()
      and new.assigned_to = auth.uid()
    )
  then
    raise exception 'Representatives cannot change this activity assignment'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger lead_activities_10_normalise_record
  before insert or update of subject, description, outcome
  on public.lead_activities
  for each row execute function public.normalise_lead_activity_record();

create trigger lead_activities_20_protect_fields
  before update on public.lead_activities
  for each row execute function public.protect_lead_activity_fields();

create trigger lead_activities_set_updated_at
  before update on public.lead_activities
  for each row execute function public.set_updated_at();

drop index if exists public.activities_lead_happened_idx;
drop index if exists public.lead_activities_user_date_idx;

create index lead_activities_lead_timeline_idx
  on public.lead_activities (lead_id, deleted_at, activity_at desc, id);
create index lead_activities_next_follow_up_idx
  on public.lead_activities (next_follow_up_at)
  where next_follow_up_at is not null and deleted_at is null;
create index lead_activities_assigned_to_idx
  on public.lead_activities (assigned_to, activity_at desc)
  where assigned_to is not null and deleted_at is null;
create index lead_activities_deleted_at_idx
  on public.lead_activities (deleted_at, activity_at desc)
  where deleted_at is not null;

create or replace function public.list_archived_lead_activities()
returns setof public.lead_activities
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_active_user() or not public.is_sales_management() then
    raise exception 'Management access is required' using errcode = '42501';
  end if;

  return query
  select activity.*
  from public.lead_activities as activity
  join public.leads as lead on lead.id = activity.lead_id
  left join public.companies as company on company.id = lead.company_id
  where activity.deleted_at is not null
    or lead.deleted_at is not null
    or (lead.company_id is not null and company.deleted_at is not null)
  order by activity.activity_at desc, activity.id;
end;
$$;

create or replace function public.restore_lead_activity(
  target_activity_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  restored_id uuid;
begin
  if not public.is_active_user() or not public.is_sales_management() then
    raise exception 'Management access is required' using errcode = '42501';
  end if;

  update public.lead_activities as activity
  set deleted_at = null
  where activity.id = target_activity_id
    and activity.deleted_at is not null
    and public.can_modify_lead(activity.lead_id)
  returning activity.id into restored_id;

  return restored_id;
end;
$$;

create or replace function public.archive_lead_activity(
  target_activity_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  archived_id uuid;
begin
  if not public.is_active_user() then
    raise exception 'Active authenticated access is required' using errcode = '42501';
  end if;

  update public.lead_activities as activity
  set deleted_at = now()
  where activity.id = target_activity_id
    and activity.deleted_at is null
    and public.can_modify_lead(activity.lead_id)
    and (
      public.is_sales_management()
      or activity.created_by = auth.uid()
      or activity.assigned_to = auth.uid()
    )
  returning activity.id into archived_id;

  return archived_id;
end;
$$;

revoke all on function public.list_archived_lead_activities() from public;
revoke all on function public.restore_lead_activity(uuid) from public;
revoke all on function public.archive_lead_activity(uuid) from public;
grant execute on function public.list_archived_lead_activities() to authenticated;
grant execute on function public.restore_lead_activity(uuid) to authenticated;
grant execute on function public.archive_lead_activity(uuid) to authenticated;

drop policy if exists "users read permitted lead activities" on public.lead_activities;
drop policy if exists "users create permitted lead activities" on public.lead_activities;
drop policy if exists "users update permitted lead activities" on public.lead_activities;

create policy "users read permitted active lead activities"
  on public.lead_activities for select to authenticated
  using (
    deleted_at is null
    and public.can_access_lead(lead_id)
  );

create policy "users create permitted active lead activities"
  on public.lead_activities for insert to authenticated
  with check (
    public.can_modify_lead(lead_id)
    and created_by = (select auth.uid())
    and deleted_at is null
    and public.lead_assignee_is_active(assigned_to)
    and (
      assigned_to is null
      or assigned_to = (select auth.uid())
      or public.is_sales_management()
    )
  );

create policy "owners update permitted active lead activities"
  on public.lead_activities for update to authenticated
  using (
    deleted_at is null
    and public.can_modify_lead(lead_id)
    and (
      public.is_sales_management()
      or created_by = (select auth.uid())
      or assigned_to = (select auth.uid())
    )
  )
  with check (
    public.can_modify_lead(lead_id)
    and public.lead_assignee_is_active(assigned_to)
    and (
      public.is_sales_management()
      or created_by = (select auth.uid())
      or assigned_to = (select auth.uid())
    )
  );

create policy "management restores archived lead activities"
  on public.lead_activities for update to authenticated
  using (
    deleted_at is not null
    and public.is_sales_management()
  )
  with check (
    deleted_at is null
    and public.can_modify_lead(lead_id)
    and public.lead_assignee_is_active(assigned_to)
  );

comment on table public.lead_activities is
  'Chronological sales interactions and follow-up metadata. lead_id is the authoritative parent relationship.';
comment on column public.lead_activities.next_follow_up_at is
  'Timeline metadata only; it does not schedule notifications, jobs, or provider integrations.';
comment on function public.list_archived_lead_activities() is
  'Explicit management-only access to archived activities and activities hidden by archived Leads or Companies.';
comment on function public.restore_lead_activity(uuid) is
  'Management-only restore path for activity rows intentionally hidden by ordinary SELECT RLS.';
comment on function public.archive_lead_activity(uuid) is
  'Owner-or-management soft-delete transition for activity rows that become hidden by ordinary SELECT RLS.';

commit;
