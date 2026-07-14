begin;

create type public.lead_stage as enum (
  'new',
  'researching',
  'ready_to_contact',
  'contacted',
  'replied',
  'qualified',
  'meeting_scheduled',
  'quotation_requested',
  'quotation_sent',
  'negotiation',
  'converted',
  'lost',
  'disqualified'
);

create type public.lead_operational_status as enum ('active', 'paused', 'closed');
create type public.lead_qualification_status as enum (
  'unreviewed',
  'researching',
  'potentially_qualified',
  'qualified',
  'unqualified'
);

alter type public.lead_priority rename value 'medium' to 'normal';
alter type public.lead_priority add value 'urgent';

drop index if exists public.leads_owner_status_idx;
drop index if exists public.leads_priority_score_idx;
drop index if exists public.leads_next_follow_up_idx;

alter table public.leads
  drop constraint if exists leads_company_id_key,
  drop constraint if exists leads_company_id_fkey,
  drop constraint if exists leads_owner_id_fkey,
  drop constraint if exists leads_source_company_fk,
  drop constraint if exists leads_score_check,
  drop constraint if exists leads_estimated_value_check;

alter table public.leads rename column owner_id to assigned_to;
alter table public.leads rename column status to stage;
alter table public.leads rename column next_action to next_step;
alter table public.leads rename column estimated_deal_value to estimated_value;
alter table public.leads rename column recommended_service to service_interest;

alter table public.leads alter column stage drop default;
alter table public.leads
  alter column stage type public.lead_stage
  using (
    case stage::text
      when 'new' then 'new'
      when 'qualified' then 'qualified'
      when 'contacted' then 'contacted'
      when 'meeting' then 'meeting_scheduled'
      when 'quotation' then 'quotation_sent'
      when 'deposit' then 'converted'
      when 'won' then 'converted'
      when 'lost' then 'lost'
    end
  )::public.lead_stage;
alter table public.leads
  alter column stage set default 'new'::public.lead_stage;
drop type public.lead_status;

alter table public.leads
  alter column priority set default 'normal'::public.lead_priority,
  alter column lead_score drop not null,
  alter column lead_score drop default,
  alter column company_id drop not null,
  alter column primary_source_id drop not null;

alter table public.leads
  alter column service_interest type text
  using (
    case service_interest::text
      when 'food_review' then 'food_review'
      when 'hard_selling' then 'hard_selling_video'
      when 'corporate' then 'corporate_video'
      when 'storyline_celebrity' then 'storyline_celebrity'
      when 'other' then 'other'
    end
  );

alter table public.leads
  add column title text,
  add column primary_contact_id uuid,
  add column lead_status public.lead_operational_status not null default 'active',
  add column qualification_status public.lead_qualification_status not null default 'unreviewed',
  add column currency text not null default 'MYR',
  add column created_by uuid,
  add column source_type text,
  add column source_url text,
  add column source_signal_id uuid,
  add column source_campaign text,
  add column referral_name text,
  add column discovered_at timestamptz,
  add column last_verified_at timestamptz,
  add column business_need text,
  add column budget_notes text,
  add column timeline_notes text,
  add column decision_maker_notes text,
  add column expected_close_date date,
  add column last_contacted_at timestamptz,
  add column converted_at timestamptz,
  add column lost_at timestamptz,
  add column lost_reason text,
  add column disqualified_at timestamptz,
  add column disqualified_reason text,
  add column deleted_at timestamptz;

update public.leads as lead
set
  title = concat('Lead · ', company.display_name),
  created_by = coalesce(lead.assigned_to, company.created_by)
from public.companies as company
where company.id = lead.company_id;

update public.leads as lead
set
  source_type = case lower(btrim(source.source_type))
    when 'manual' then 'manual'
    when 'company_website' then 'company_website'
    when 'social_media' then 'social_media'
    when 'referral' then 'referral'
    when 'inbound' then 'inbound'
    when 'event' then 'event'
    when 'campaign' then 'campaign'
    when 'public_directory' then 'public_directory'
    when 'signal' then 'signal'
    when 'other' then 'other'
    else 'other'
  end,
  source_url = source.source_url,
  discovered_at = source.discovered_at
from public.lead_sources as source
where source.id = lead.primary_source_id;

update public.leads
set
  title = coalesce(nullif(btrim(title), ''), concat('Legacy lead · ', left(id::text, 8))),
  source_type = coalesce(nullif(btrim(source_type), ''), 'manual'),
  discovered_at = coalesce(discovered_at, created_at),
  lead_status = case
    when stage in ('converted', 'lost', 'disqualified') then 'closed'::public.lead_operational_status
    else 'active'::public.lead_operational_status
  end,
  qualification_status = case
    when stage in (
      'qualified',
      'meeting_scheduled',
      'quotation_requested',
      'quotation_sent',
      'negotiation',
      'converted'
    ) then 'qualified'::public.lead_qualification_status
    when stage = 'researching' then 'researching'::public.lead_qualification_status
    else 'unreviewed'::public.lead_qualification_status
  end,
  converted_at = case when stage = 'converted' then created_at else null end,
  lost_at = case when stage = 'lost' then created_at else null end,
  lost_reason = case
    when stage = 'lost' then 'Migrated from the legacy lost stage'
    else null
  end;

alter table public.leads
  alter column title set not null,
  alter column source_type set not null,
  alter column source_type set default 'manual',
  alter column discovered_at set not null,
  alter column discovered_at set default now();

alter table public.leads
  add constraint leads_company_id_fk
    foreign key (company_id) references public.companies(id) on delete restrict,
  add constraint leads_primary_contact_id_fk
    foreign key (primary_contact_id) references public.contacts(id) on delete set null,
  add constraint leads_created_by_fk
    foreign key (created_by) references public.profiles(id) on delete restrict,
  add constraint leads_assigned_to_fk
    foreign key (assigned_to) references public.profiles(id) on delete set null,
  add constraint leads_primary_source_id_fk
    foreign key (primary_source_id) references public.lead_sources(id) on delete set null,
  add constraint leads_source_signal_id_fk
    foreign key (source_signal_id) references public.lead_signals(id) on delete set null;

alter table public.lead_signals
  drop constraint if exists lead_signals_lead_id_fkey,
  add constraint lead_signals_lead_id_fk
    foreign key (lead_id) references public.leads(id) on delete restrict;

alter table public.opportunities
  drop constraint if exists opportunities_lead_id_fkey,
  add constraint opportunities_lead_id_fk
    foreign key (lead_id) references public.leads(id) on delete restrict;

alter table public.lead_activities
  drop constraint if exists activities_lead_id_fkey,
  drop constraint if exists lead_activities_lead_id_fkey,
  add constraint lead_activities_lead_id_fk
    foreign key (lead_id) references public.leads(id) on delete restrict;

alter table public.sales_tasks
  drop constraint if exists sales_tasks_lead_id_fkey,
  add constraint sales_tasks_lead_id_fk
    foreign key (lead_id) references public.leads(id) on delete restrict;

create or replace function public.normalise_lead_text(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(regexp_replace(coalesce(value, ''), '[[:space:]]+', ' ', 'g')), '');
$$;

create or replace function public.normalise_lead_key(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    btrim(
      regexp_replace(
        lower(replace(coalesce(value, ''), '&', ' and ')),
        '[^[:alnum:]]+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;

create or replace function public.normalise_lead_source_url(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(lower(regexp_replace(btrim(coalesce(value, '')), '#.*$', '')), '');
$$;

create or replace function public.lead_fingerprint(
  lead_title text,
  lead_company_id uuid,
  lead_contact_id uuid,
  lead_service_interest text,
  lead_source_url text,
  lead_source_campaign text,
  lead_source_signal_id uuid
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when public.normalise_lead_key(lead_title) is null then null
    when lead_company_id is null
      and lead_contact_id is null
      and public.normalise_lead_key(lead_service_interest) is null
      and public.normalise_lead_source_url(lead_source_url) is null
      and public.normalise_lead_key(lead_source_campaign) is null
      and lead_source_signal_id is null
      then null
    else md5(
      public.normalise_lead_key(lead_title) || '|' ||
      coalesce(lead_company_id::text, '') || '|' ||
      coalesce(lead_contact_id::text, '') || '|' ||
      coalesce(public.normalise_lead_key(lead_service_interest), '') || '|' ||
      coalesce(public.normalise_lead_source_url(lead_source_url), '') || '|' ||
      coalesce(public.normalise_lead_key(lead_source_campaign), '') || '|' ||
      coalesce(lead_source_signal_id::text, '')
    )
  end;
$$;

create or replace function public.leads_are_likely_duplicates(
  left_title text,
  left_company_id uuid,
  left_contact_id uuid,
  left_service_interest text,
  left_source_url text,
  left_source_campaign text,
  left_source_signal_id uuid,
  right_title text,
  right_company_id uuid,
  right_contact_id uuid,
  right_service_interest text,
  right_source_url text,
  right_source_campaign text,
  right_source_signal_id uuid
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  with evidence as (
    select
      left_company_id is not null and left_company_id = right_company_id as same_company,
      left_contact_id is not null and left_contact_id = right_contact_id as same_contact,
      public.normalise_lead_key(left_title) is not null
        and public.normalise_lead_key(left_title) = public.normalise_lead_key(right_title)
        as same_title,
      public.normalise_lead_key(left_service_interest) is not null
        and public.normalise_lead_key(left_service_interest) = public.normalise_lead_key(right_service_interest)
        as same_service,
      public.normalise_lead_source_url(left_source_url) is not null
        and public.normalise_lead_source_url(left_source_url) = public.normalise_lead_source_url(right_source_url)
        as same_source,
      public.normalise_lead_key(left_source_campaign) is not null
        and public.normalise_lead_key(left_source_campaign) = public.normalise_lead_key(right_source_campaign)
        as same_campaign,
      public.normalise_lead_key(left_source_campaign) is not null
        and public.normalise_lead_key(right_source_campaign) is not null
        and public.normalise_lead_key(left_source_campaign) <> public.normalise_lead_key(right_source_campaign)
        as different_campaign,
      left_source_signal_id is not null and left_source_signal_id = right_source_signal_id
        as same_signal
  )
  select case
    when different_campaign and not (same_source or same_signal or same_contact) then false
    else
      same_signal
      or (same_source and (same_company or same_title))
      or (same_company and same_campaign)
      or (
        same_company
        and same_title
        and (same_service or same_campaign or same_contact)
      )
  end
  from evidence;
$$;

alter table public.leads
  add column fingerprint text generated always as (
    public.lead_fingerprint(
      title,
      company_id,
      primary_contact_id,
      service_interest,
      source_url,
      source_campaign,
      source_signal_id
    )
  ) stored,
  add constraint leads_title_length_check
    check (char_length(btrim(title)) between 2 and 240),
  add constraint leads_created_by_required_check
    check (created_by is not null) not valid,
  add constraint leads_lead_score_range_check
    check (lead_score is null or lead_score between 0 and 100),
  add constraint leads_estimated_value_nonnegative_check
    check (estimated_value is null or estimated_value >= 0),
  add constraint leads_currency_format_check
    check (currency ~ '^[A-Z]{3}$'),
  add constraint leads_service_interest_check check (
    service_interest is null
    or service_interest in (
      'food_review',
      'hard_selling_video',
      'corporate_video',
      'storyline_celebrity',
      'social_media_campaign',
      'event_coverage',
      'other'
    )
  ),
  add constraint leads_source_type_check check (
    source_type in (
      'manual',
      'company_website',
      'social_media',
      'referral',
      'inbound',
      'event',
      'campaign',
      'public_directory',
      'signal',
      'other'
    )
  ),
  add constraint leads_source_url_format_check
    check (source_url is null or source_url ~* '^https?://[^[:space:]]+$'),
  add constraint leads_source_evidence_check check (
    case source_type
      when 'company_website' then source_url is not null
      when 'social_media' then source_url is not null
      when 'public_directory' then source_url is not null
      when 'referral' then source_url is not null or referral_name is not null
      when 'campaign' then source_url is not null or source_campaign is not null
      when 'signal' then source_url is not null or source_signal_id is not null
      else true
    end
  ),
  add constraint leads_nonempty_context_check check (
    (business_need is null or char_length(btrim(business_need)) between 1 and 5000)
    and (budget_notes is null or char_length(btrim(budget_notes)) between 1 and 5000)
    and (timeline_notes is null or char_length(btrim(timeline_notes)) between 1 and 5000)
    and (decision_maker_notes is null or char_length(btrim(decision_maker_notes)) between 1 and 5000)
    and (next_step is null or char_length(btrim(next_step)) between 1 and 2000)
    and (notes is null or char_length(btrim(notes)) between 1 and 10000)
    and (lost_reason is null or char_length(btrim(lost_reason)) between 1 and 2000)
    and (disqualified_reason is null or char_length(btrim(disqualified_reason)) between 1 and 2000)
  ),
  add constraint leads_discovered_at_check
    check (discovered_at <= created_at + interval '1 day'),
  add constraint leads_last_verified_at_check
    check (last_verified_at is null or last_verified_at >= discovered_at),
  add constraint leads_next_follow_up_at_check
    check (next_follow_up_at is null or next_follow_up_at >= discovered_at),
  add constraint leads_expected_close_date_check
    check (expected_close_date is null or expected_close_date >= discovered_at::date),
  add constraint leads_last_contacted_at_check
    check (last_contacted_at is null or last_contacted_at >= discovered_at),
  add constraint leads_outcome_consistency_check check (
    (converted_at is null or converted_at >= discovered_at)
    and (lost_at is null or lost_at >= discovered_at)
    and (disqualified_at is null or disqualified_at >= discovered_at)
    and
    (stage = 'converted') = (converted_at is not null)
    and (stage = 'lost') = (lost_at is not null and lost_reason is not null)
    and (stage = 'disqualified') = (
      disqualified_at is not null and disqualified_reason is not null
    )
    and (stage = 'lost' or lost_reason is null)
    and (stage = 'disqualified' or disqualified_reason is null)
    and (
      (stage in ('converted', 'lost', 'disqualified') and lead_status = 'closed')
      or (stage not in ('converted', 'lost', 'disqualified') and lead_status <> 'closed')
    )
  ),
  add constraint leads_fingerprint_format_check
    check (fingerprint is null or fingerprint ~ '^[a-f0-9]{32}$');

create or replace function public.normalise_lead_record()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.title := coalesce(public.normalise_lead_text(new.title), '');
  new.currency := upper(btrim(new.currency));
  new.service_interest := public.normalise_lead_key(new.service_interest);
  if new.service_interest is not null then
    new.service_interest := replace(new.service_interest, ' ', '_');
  end if;
  new.source_type := replace(lower(btrim(new.source_type)), ' ', '_');
  new.source_url := public.normalise_lead_source_url(new.source_url);
  new.source_campaign := public.normalise_lead_text(new.source_campaign);
  new.referral_name := public.normalise_lead_text(new.referral_name);
  new.business_need := public.normalise_lead_text(new.business_need);
  new.budget_notes := public.normalise_lead_text(new.budget_notes);
  new.timeline_notes := public.normalise_lead_text(new.timeline_notes);
  new.decision_maker_notes := public.normalise_lead_text(new.decision_maker_notes);
  new.next_step := public.normalise_lead_text(new.next_step);
  new.notes := public.normalise_lead_text(new.notes);
  new.lost_reason := public.normalise_lead_text(new.lost_reason);
  new.disqualified_reason := public.normalise_lead_text(new.disqualified_reason);
  return new;
end;
$$;

create or replace function public.lead_company_is_active(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_company_id is null or exists (
    select 1
    from public.companies
    where id = target_company_id and deleted_at is null
  );
$$;

create or replace function public.lead_assignee_is_active(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_profile_id is null or exists (
    select 1
    from public.profiles
    where id = target_profile_id and is_active = true
  );
$$;

create or replace function public.lead_contact_is_linkable(
  target_contact_id uuid,
  target_company_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_contact_id is null or exists (
    select 1
    from public.contacts as contact
    where contact.id = target_contact_id
      and contact.deleted_at is null
      and contact.company_id is not distinct from target_company_id
      and public.contact_company_is_active(contact.company_id)
  );
$$;

create or replace function public.validate_lead_relationships()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  signal_lead_id uuid;
begin
  if not public.lead_company_is_active(new.company_id) then
    raise exception 'Lead company must be active' using errcode = '23514';
  end if;
  if not public.lead_contact_is_linkable(new.primary_contact_id, new.company_id) then
    raise exception 'Primary contact must be active and belong to the Lead company'
      using errcode = '23514';
  end if;
  if not public.lead_assignee_is_active(new.assigned_to) then
    raise exception 'Lead assignee must be active' using errcode = '23514';
  end if;
  if new.source_signal_id is not null then
    select signal.lead_id into signal_lead_id
    from public.lead_signals as signal
    where signal.id = new.source_signal_id;
    if signal_lead_id is distinct from new.id then
      raise exception 'Source signal must belong to the same Lead'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.protect_lead_fields()
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
    raise exception 'Inactive users cannot update Leads' using errcode = '42501';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by cannot be changed' using errcode = '42501';
  end if;
  if new.deleted_at is distinct from old.deleted_at and not public.is_sales_management() then
    raise exception 'Only management can archive Leads' using errcode = '42501';
  end if;
  if not public.is_sales_management() then
    if new.company_id is distinct from old.company_id then
      raise exception 'Representatives cannot change a Lead company'
        using errcode = '42501';
    end if;
    if new.assigned_to is distinct from old.assigned_to then
      if not (
        old.assigned_to is null
        and new.assigned_to = auth.uid()
        and old.created_by = auth.uid()
      ) then
        raise exception 'Representatives cannot change this Lead assignment'
          using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger leads_10_normalise_record
  before insert or update of
    title,
    currency,
    service_interest,
    source_type,
    source_url,
    source_campaign,
    referral_name,
    business_need,
    budget_notes,
    timeline_notes,
    decision_maker_notes,
    next_step,
    notes,
    lost_reason,
    disqualified_reason
  on public.leads
  for each row execute function public.normalise_lead_record();

create trigger leads_20_validate_relationships
  before insert or update of company_id, primary_contact_id, assigned_to, source_signal_id
  on public.leads
  for each row execute function public.validate_lead_relationships();

create trigger leads_30_protect_fields
  before update on public.leads
  for each row execute function public.protect_lead_fields();

create index leads_active_company_created_idx
  on public.leads (company_id, created_at desc)
  where company_id is not null and deleted_at is null;
create index leads_primary_contact_idx
  on public.leads (primary_contact_id)
  where primary_contact_id is not null and deleted_at is null;
create index leads_created_by_idx
  on public.leads (created_by)
  where created_by is not null;
create index leads_active_assignee_created_idx
  on public.leads (assigned_to, created_at desc)
  where assigned_to is not null and deleted_at is null;
create index leads_active_stage_created_idx
  on public.leads (stage, created_at desc)
  where deleted_at is null;
create index leads_active_status_idx
  on public.leads (lead_status)
  where deleted_at is null;
create index leads_active_qualification_idx
  on public.leads (qualification_status)
  where deleted_at is null;
create index leads_active_priority_score_idx
  on public.leads (priority, lead_score desc nulls last)
  where deleted_at is null;
create index leads_active_follow_up_idx
  on public.leads (next_follow_up_at)
  where next_follow_up_at is not null and deleted_at is null;
create index leads_active_expected_close_idx
  on public.leads (expected_close_date)
  where expected_close_date is not null and deleted_at is null;
create index leads_active_created_at_idx
  on public.leads (created_at desc)
  where deleted_at is null;
create index leads_active_source_type_idx
  on public.leads (source_type)
  where deleted_at is null;
create index leads_active_source_url_idx
  on public.leads (source_url)
  where source_url is not null and deleted_at is null;
create index leads_fingerprint_idx
  on public.leads (fingerprint)
  where fingerprint is not null;

create or replace function public.can_access_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and (
    public.is_sales_management()
    or exists (
      select 1 from public.companies
      where id = target_company_id and created_by = auth.uid()
    )
    or exists (
      select 1 from public.leads
      where company_id = target_company_id
        and deleted_at is null
        and (assigned_to = auth.uid() or created_by = auth.uid())
    )
  );
$$;

create or replace function public.can_link_lead_to_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user()
    and (
      target_company_id is null
      or (
        public.lead_company_is_active(target_company_id)
        and (
          public.is_sales_management()
          or public.can_access_company(target_company_id)
        )
      )
    );
$$;

create or replace function public.can_access_lead(target_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and exists (
    select 1
    from public.leads as lead
    where lead.id = target_lead_id
      and lead.deleted_at is null
      and public.lead_company_is_active(lead.company_id)
      and (
        public.is_sales_management()
        or lead.created_by = auth.uid()
        or lead.assigned_to = auth.uid()
        or (
          lead.company_id is not null
          and public.can_access_company(lead.company_id)
        )
      )
  );
$$;

-- Company-derived visibility is read-only. Representatives need direct creator
-- or assignee ownership before Lead or dependent-record mutation is permitted.
create or replace function public.can_modify_lead(target_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and exists (
    select 1
    from public.leads as lead
    where lead.id = target_lead_id
      and lead.deleted_at is null
      and public.lead_company_is_active(lead.company_id)
      and (
        public.is_sales_management()
        or lead.created_by = auth.uid()
        or lead.assigned_to = auth.uid()
      )
  );
$$;

-- Ordinary SELECT policies expose active Leads only. Management must opt in to
-- archived rows through this function, including Leads hidden by Company archive.
create or replace function public.list_archived_leads()
returns setof public.leads
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
  select lead.*
  from public.leads as lead
  left join public.companies as company on company.id = lead.company_id
  where lead.deleted_at is not null
    or (lead.company_id is not null and company.deleted_at is not null)
  order by lead.created_at desc, lead.id;
end;
$$;

revoke all on function public.lead_company_is_active(uuid) from public;
revoke all on function public.lead_assignee_is_active(uuid) from public;
revoke all on function public.lead_contact_is_linkable(uuid, uuid) from public;
revoke all on function public.can_link_lead_to_company(uuid) from public;
revoke all on function public.can_access_lead(uuid) from public;
revoke all on function public.can_modify_lead(uuid) from public;
revoke all on function public.list_archived_leads() from public;
grant execute on function public.lead_company_is_active(uuid) to authenticated;
grant execute on function public.lead_assignee_is_active(uuid) to authenticated;
grant execute on function public.lead_contact_is_linkable(uuid, uuid) to authenticated;
grant execute on function public.can_link_lead_to_company(uuid) to authenticated;
grant execute on function public.can_access_lead(uuid) to authenticated;
grant execute on function public.can_modify_lead(uuid) to authenticated;
grant execute on function public.list_archived_leads() to authenticated;

drop policy if exists "users read permitted leads" on public.leads;
drop policy if exists "users create assigned leads" on public.leads;
drop policy if exists "users update permitted leads" on public.leads;
drop policy if exists "management deletes leads" on public.leads;

create policy "users read permitted active leads"
  on public.leads for select to authenticated
  using (public.can_access_lead(id));

create policy "active users create sourced leads"
  on public.leads for insert to authenticated
  with check (
    public.is_active_user()
    and created_by = (select auth.uid())
    and deleted_at is null
    and public.can_link_lead_to_company(company_id)
    and public.lead_contact_is_linkable(primary_contact_id, company_id)
    and public.lead_assignee_is_active(assigned_to)
    and (
      assigned_to is null
      or assigned_to = (select auth.uid())
      or public.is_sales_management()
    )
  );

create policy "users update permitted active leads"
  on public.leads for update to authenticated
  using (public.can_modify_lead(id))
  with check (
    public.is_active_user()
    and public.can_link_lead_to_company(company_id)
    and public.lead_contact_is_linkable(primary_contact_id, company_id)
    and public.lead_assignee_is_active(assigned_to)
    and (
      public.is_sales_management()
      or (
        deleted_at is null
        and (created_by = (select auth.uid()) or assigned_to = (select auth.uid()))
      )
    )
  );

drop policy if exists "users manage permitted signals" on public.lead_signals;
create policy "users read permitted signals"
  on public.lead_signals for select to authenticated
  using (public.can_access_lead(lead_id));
create policy "users create permitted signals"
  on public.lead_signals for insert to authenticated
  with check (public.can_modify_lead(lead_id));
create policy "users update permitted signals"
  on public.lead_signals for update to authenticated
  using (public.can_modify_lead(lead_id))
  with check (public.can_modify_lead(lead_id));
create policy "users delete permitted signals"
  on public.lead_signals for delete to authenticated
  using (public.can_modify_lead(lead_id));

drop policy if exists "users manage permitted opportunities" on public.opportunities;
create policy "users read permitted opportunities"
  on public.opportunities for select to authenticated
  using (public.can_access_lead(lead_id));
create policy "users create permitted opportunities"
  on public.opportunities for insert to authenticated
  with check (public.can_modify_lead(lead_id));
create policy "users update permitted opportunities"
  on public.opportunities for update to authenticated
  using (public.can_modify_lead(lead_id))
  with check (public.can_modify_lead(lead_id));

drop policy if exists "users manage permitted activities" on public.lead_activities;
create policy "users read permitted lead activities"
  on public.lead_activities for select to authenticated
  using (public.can_access_lead(lead_id));
create policy "users create permitted lead activities"
  on public.lead_activities for insert to authenticated
  with check (
    public.can_modify_lead(lead_id)
    and (user_id = (select auth.uid()) or public.is_sales_management())
  );
create policy "users update permitted lead activities"
  on public.lead_activities for update to authenticated
  using (public.can_modify_lead(lead_id))
  with check (
    public.can_modify_lead(lead_id)
    and (user_id = (select auth.uid()) or public.is_sales_management())
  );

comment on column public.leads.stage is
  'Pre-Opportunity sales pipeline stage. converted means ready for Opportunity creation; post-sale production states do not belong here.';
comment on column public.leads.lead_status is
  'Operational availability: active, paused, or closed. This is separate from pipeline stage and deleted_at archive state.';
comment on column public.leads.company_id is
  'Nullable for legitimate independent referrals and inbound prospects. Linked Companies use ON DELETE RESTRICT and archived Companies hide ordinary Lead reads.';
comment on column public.leads.primary_contact_id is
  'Optional active Contact. When present, its company_id must exactly match the Lead company_id, including the independent/null case.';
comment on column public.leads.primary_source_id is
  'Legacy optional lead_sources relation retained for compatibility; new provenance is stored directly on the Lead.';
comment on column public.leads.fingerprint is
  'Non-unique exact duplicate signal. Duplicate decisions require title plus corroborating Company, Contact, service, source, campaign, or signal evidence.';
comment on constraint leads_outcome_consistency_check on public.leads is
  'Outcome timestamps cannot predate discovery or overlap. Converted, lost and disqualified stages require their matching timestamps and reasons.';
comment on function public.leads_are_likely_duplicates(
  text, uuid, uuid, text, text, text, uuid,
  text, uuid, uuid, text, text, text, uuid
) is
  'False-positive-aware duplicate signal: Company or title alone never suffices, and explicitly different campaigns are not blindly merged.';
comment on function public.list_archived_leads() is
  'Explicit management-only access to soft-deleted Leads and Leads hidden by an archived Company.';

commit;
