begin;

create extension if not exists pgcrypto;

create type public.team_role as enum ('admin', 'sales', 'viewer');
create type public.company_category as enum ('fnb', 'agency', 'hotel', 'other');
create type public.lead_status as enum ('new', 'qualified', 'contacted', 'meeting', 'quotation', 'deposit', 'won', 'lost');
create type public.lead_priority as enum ('low', 'medium', 'high');
create type public.service_type as enum ('food_review', 'hard_selling', 'corporate', 'storyline_celebrity', 'other');
create type public.activity_type as enum ('note', 'call', 'whatsapp', 'email', 'meeting', 'quotation', 'deposit', 'status_change');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.team_role not null default 'sales',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  name_key text generated always as (lower(trim(regexp_replace(name, '\s+', ' ', 'g')))) stored,
  category public.company_category not null,
  website_url text,
  website_domain text,
  public_phone text,
  public_email text,
  city text,
  state text,
  country_code char(2) not null default 'MY',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name_key, country_code)
);

create unique index companies_website_domain_unique
  on public.companies (lower(website_domain))
  where website_domain is not null;

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text,
  job_title text,
  public_email text,
  public_phone text,
  source_url text not null check (source_url ~ '^https?://'),
  discovered_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (public_email is not null or public_phone is not null)
);

create unique index contacts_company_email_unique
  on public.contacts (company_id, lower(public_email))
  where public_email is not null;
create unique index contacts_company_phone_unique
  on public.contacts (company_id, regexp_replace(public_phone, '\D', '', 'g'))
  where public_phone is not null;

create table public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source_url text not null check (source_url ~ '^https?://'),
  source_type text not null,
  discovered_at timestamptz not null,
  last_checked_at timestamptz,
  source_notes text,
  created_at timestamptz not null default now(),
  unique (company_id, source_url),
  unique (id, company_id)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  primary_source_id uuid not null,
  owner_id uuid references public.profiles(id) on delete set null,
  status public.lead_status not null default 'new',
  priority public.lead_priority not null default 'low',
  score smallint not null default 0 check (score between 0 and 100),
  next_action text,
  next_action_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_source_company_fk foreign key (primary_source_id, company_id)
    references public.lead_sources(id, company_id) on delete restrict
);

create table public.lead_signals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  signal_type text not null,
  description text not null,
  confidence numeric(3,2) not null check (confidence between 0 and 1),
  evidence_url text not null check (evidence_url ~ '^https?://'),
  observed_at timestamptz not null,
  ai_inferred boolean not null default false,
  created_at timestamptz not null default now(),
  unique (lead_id, signal_type, evidence_url)
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  service public.service_type not null,
  estimated_value_myr numeric(12,2) check (estimated_value_myr >= 0),
  quotation_number text,
  quotation_sent_at timestamptz,
  meeting_at timestamptz,
  deposit_amount_myr numeric(12,2) check (deposit_amount_myr >= 0),
  deposit_received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  activity_type public.activity_type not null,
  summary text not null,
  happened_at timestamptz not null default now(),
  follow_up_at timestamptz,
  created_at timestamptz not null default now()
);

create index leads_owner_status_idx on public.leads (owner_id, status);
create index leads_next_action_idx on public.leads (next_action_at) where next_action_at is not null;
create index lead_signals_lead_idx on public.lead_signals (lead_id);
create index activities_lead_happened_idx on public.activities (lead_id, happened_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger companies_set_updated_at before update on public.companies for each row execute function public.set_updated_at();
create trigger contacts_set_updated_at before update on public.contacts for each row execute function public.set_updated_at();
create trigger leads_set_updated_at before update on public.leads for each row execute function public.set_updated_at();
create trigger opportunities_set_updated_at before update on public.opportunities for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.lead_sources enable row level security;
alter table public.leads enable row level security;
alter table public.lead_signals enable row level security;
alter table public.opportunities enable row level security;
alter table public.activities enable row level security;

create policy "authenticated users read profiles" on public.profiles for select to authenticated using (true);
create policy "users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "team reads companies" on public.companies for select to authenticated using (true);
create policy "team creates companies" on public.companies for insert to authenticated with check ((select auth.uid()) = created_by);
create policy "team updates companies" on public.companies for update to authenticated using (true) with check (true);

create policy "team manages contacts" on public.contacts for all to authenticated using (true) with check (true);
create policy "team manages lead sources" on public.lead_sources for all to authenticated using (true) with check (true);
create policy "team manages leads" on public.leads for all to authenticated using (true) with check (true);
create policy "team manages lead signals" on public.lead_signals for all to authenticated using (true) with check (true);
create policy "team manages opportunities" on public.opportunities for all to authenticated using (true) with check (true);
create policy "team manages activities" on public.activities for all to authenticated using (true) with check (true);

commit;
