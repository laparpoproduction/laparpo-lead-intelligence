begin;

create type public.app_role as enum (
  'ceo_admin',
  'sales_manager',
  'sales_representative'
);

alter table public.profiles
  add column email text,
  add column is_active boolean not null default true;

update public.profiles as profile
set email = auth_user.email
from auth.users as auth_user
where auth_user.id = profile.id;

alter table public.profiles alter column role drop default;
alter table public.profiles
  alter column role type public.app_role
  using (
    case role::text
      when 'admin' then 'ceo_admin'
      when 'sales' then 'sales_representative'
      when 'viewer' then 'sales_representative'
    end
  )::public.app_role;
alter table public.profiles
  alter column role set default 'sales_representative'::public.app_role;
drop type public.team_role;

alter table public.companies rename column name to display_name;
alter table public.companies rename column category to company_type;
alter table public.companies rename column country_code to country;

alter table public.companies
  add column legal_name text,
  add column industry text,
  add column description text,
  add column facebook_url text,
  add column instagram_url text,
  add column tiktok_url text,
  add column youtube_url text,
  add column google_maps_url text,
  add column estimated_branch_count integer,
  add column source_url text,
  add column source_type text not null default 'manual',
  add column discovered_at timestamptz not null default now(),
  add column last_verified_at timestamptz;

update public.companies set legal_name = display_name where legal_name is null;
alter table public.companies alter column legal_name set not null;
alter table public.companies
  add constraint companies_branch_count_check
    check (estimated_branch_count is null or estimated_branch_count >= 0),
  add constraint companies_source_url_format_check
    check (source_url is null or source_url ~ '^https?://'),
  add constraint companies_source_url_required_check
    check (source_url is not null) not valid;

alter table public.companies
  drop constraint if exists companies_name_key_country_code_key;

create or replace function public.normalise_company_name(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select trim(
    regexp_replace(
      regexp_replace(
        lower(replace(value, '&', ' and ')),
        '(sendirian[[:space:]]+berhad|sdn\.?[[:space:]]*bhd\.?|berhad|bhd\.?|limited|ltd\.?|llc|plc)[[:space:]]*$',
        '',
        'g'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

create or replace function public.normalise_website_domain(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(trim(value), '') = '' then ''
    else lower(
      split_part(
        regexp_replace(trim(value), '^https?://(www\.)?', '', 'i'),
        '/',
        1
      )
    )
  end;
$$;

create or replace function public.normalise_public_phone(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when regexp_replace(coalesce(value, ''), '\D', '', 'g') like '0060%'
      then substring(regexp_replace(value, '\D', '', 'g') from 3)
    when regexp_replace(coalesce(value, ''), '\D', '', 'g') like '60%'
      then regexp_replace(value, '\D', '', 'g')
    when regexp_replace(coalesce(value, ''), '\D', '', 'g') like '0%'
      then '60' || substring(regexp_replace(value, '\D', '', 'g') from 2)
    else regexp_replace(coalesce(value, ''), '\D', '', 'g')
  end;
$$;

create or replace function public.company_fingerprint(
  company_name text,
  company_website text,
  company_phone text,
  company_city text,
  company_state text,
  company_country text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select md5(
    public.normalise_company_name(company_name) || '|' ||
    public.normalise_website_domain(company_website) || '|' ||
    public.normalise_public_phone(company_phone) || '|' ||
    lower(regexp_replace(
      concat_ws('|', company_city, company_state, company_country),
      '[^a-zA-Z0-9|]+',
      ' ',
      'g'
    ))
  );
$$;

alter table public.companies
  add column fingerprint text generated always as (
    public.company_fingerprint(
      display_name,
      website_url,
      public_phone,
      city,
      state,
      country
    )
  ) stored;

create unique index companies_fingerprint_unique on public.companies (fingerprint);
create index companies_company_type_idx on public.companies (company_type);
create index companies_location_idx on public.companies (state, city);

alter table public.contacts rename column source_url to contact_source_url;
alter table public.contacts add column verified_at timestamptz;

alter table public.leads rename column score to lead_score;
alter table public.leads rename column next_action_at to next_follow_up_at;
alter table public.leads
  add column category public.company_category not null default 'other',
  add column score_confidence numeric(3,2) not null default 0,
  add column estimated_deal_value numeric(12,2),
  add column recommended_service public.service_type,
  add column reason_selected text,
  add constraint leads_score_confidence_check check (score_confidence between 0 and 1),
  add constraint leads_estimated_value_check
    check (estimated_deal_value is null or estimated_deal_value >= 0);

drop index if exists public.leads_next_action_idx;
create index leads_next_follow_up_idx
  on public.leads (next_follow_up_at)
  where next_follow_up_at is not null;
create index leads_priority_score_idx on public.leads (priority, lead_score desc);

alter table public.lead_signals rename column description to signal_description;
alter table public.lead_signals rename column evidence_url to source_url;
alter table public.lead_signals
  add column signal_value jsonb,
  add column expires_at timestamptz,
  add constraint lead_signals_expiry_check
    check (expires_at is null or expires_at > observed_at);

alter table public.activities rename to lead_activities;
alter table public.lead_activities rename column actor_id to user_id;
alter table public.lead_activities rename column summary to notes;
alter table public.lead_activities rename column happened_at to activity_at;

create type public.task_status as enum ('pending', 'in_progress', 'completed', 'cancelled');

create table public.sales_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  assigned_to uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 200),
  status public.task_status not null default 'pending',
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sales_tasks_completion_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed')
  )
);

create index contacts_company_idx on public.contacts (company_id);
create index lead_signals_observed_idx on public.lead_signals (observed_at desc);
create index lead_activities_user_date_idx on public.lead_activities (user_id, activity_at desc);
create index sales_tasks_assignee_status_due_idx
  on public.sales_tasks (assigned_to, status, due_at);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email);
  return new;
end;
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = auth.uid() and is_active = true;
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active = true
  );
$$;

create or replace function public.is_sales_management()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.current_app_role() in ('ceo_admin', 'sales_manager'),
    false
  );
$$;

create or replace function public.can_access_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_sales_management()
    or exists (
      select 1 from public.companies
      where id = target_company_id and created_by = auth.uid()
    )
    or exists (
      select 1 from public.leads
      where company_id = target_company_id and owner_id = auth.uid()
    );
$$;

create or replace function public.can_access_lead(target_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_sales_management()
    or exists (
      select 1 from public.leads
      where id = target_lead_id and owner_id = auth.uid()
    );
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.is_active_user() from public;
revoke all on function public.is_sales_management() from public;
revoke all on function public.can_access_company(uuid) from public;
revoke all on function public.can_access_lead(uuid) from public;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_sales_management() to authenticated;
grant execute on function public.can_access_company(uuid) to authenticated;
grant execute on function public.can_access_lead(uuid) to authenticated;

drop policy if exists "authenticated users read profiles" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "team reads companies" on public.companies;
drop policy if exists "team creates companies" on public.companies;
drop policy if exists "team updates companies" on public.companies;
drop policy if exists "team manages contacts" on public.contacts;
drop policy if exists "team manages lead sources" on public.lead_sources;
drop policy if exists "team manages leads" on public.leads;
drop policy if exists "team manages lead signals" on public.lead_signals;
drop policy if exists "team manages opportunities" on public.opportunities;
drop policy if exists "team manages activities" on public.lead_activities;

create policy "users read permitted profiles"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_sales_management());
create policy "management updates profiles"
  on public.profiles for update to authenticated
  using (public.is_sales_management())
  with check (public.is_sales_management());

create policy "users read permitted companies"
  on public.companies for select to authenticated
  using (public.can_access_company(id));
create policy "active users create sourced companies"
  on public.companies for insert to authenticated
  with check (public.is_active_user() and created_by = (select auth.uid()));
create policy "users update permitted companies"
  on public.companies for update to authenticated
  using (public.can_access_company(id))
  with check (public.can_access_company(id));
create policy "users delete permitted companies"
  on public.companies for delete to authenticated
  using (public.is_sales_management() or created_by = (select auth.uid()));

create policy "users read permitted contacts"
  on public.contacts for select to authenticated
  using (public.can_access_company(company_id));
create policy "users create permitted contacts"
  on public.contacts for insert to authenticated
  with check (public.can_access_company(company_id));
create policy "users update permitted contacts"
  on public.contacts for update to authenticated
  using (public.can_access_company(company_id))
  with check (public.can_access_company(company_id));
create policy "users delete permitted contacts"
  on public.contacts for delete to authenticated
  using (public.can_access_company(company_id));

create policy "users manage permitted lead sources"
  on public.lead_sources for all to authenticated
  using (public.can_access_company(company_id))
  with check (public.can_access_company(company_id));

create policy "users read permitted leads"
  on public.leads for select to authenticated
  using (public.can_access_lead(id));
create policy "users create assigned leads"
  on public.leads for insert to authenticated
  with check (
    public.is_active_user()
    and (owner_id = (select auth.uid()) or public.is_sales_management())
  );
create policy "users update permitted leads"
  on public.leads for update to authenticated
  using (public.can_access_lead(id))
  with check (public.can_access_lead(id));
create policy "management deletes leads"
  on public.leads for delete to authenticated
  using (public.is_sales_management());

create policy "users manage permitted signals"
  on public.lead_signals for all to authenticated
  using (public.can_access_lead(lead_id))
  with check (public.can_access_lead(lead_id));
create policy "users manage permitted opportunities"
  on public.opportunities for all to authenticated
  using (public.can_access_lead(lead_id))
  with check (public.can_access_lead(lead_id));
create policy "users manage permitted activities"
  on public.lead_activities for all to authenticated
  using (public.can_access_lead(lead_id))
  with check (
    public.can_access_lead(lead_id)
    and (user_id = (select auth.uid()) or public.is_sales_management())
  );

alter table public.sales_tasks enable row level security;
create policy "users read permitted tasks"
  on public.sales_tasks for select to authenticated
  using (
    assigned_to = (select auth.uid())
    or public.can_access_lead(lead_id)
  );
create policy "users create permitted tasks"
  on public.sales_tasks for insert to authenticated
  with check (
    assigned_to = (select auth.uid())
    or public.is_sales_management()
  );
create policy "users update permitted tasks"
  on public.sales_tasks for update to authenticated
  using (
    assigned_to = (select auth.uid())
    or public.is_sales_management()
  )
  with check (
    assigned_to = (select auth.uid())
    or public.is_sales_management()
  );
create policy "management deletes tasks"
  on public.sales_tasks for delete to authenticated
  using (public.is_sales_management());

commit;
