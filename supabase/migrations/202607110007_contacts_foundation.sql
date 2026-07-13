begin;

create type public.contact_status as enum (
  'discovered',
  'verified',
  'contacted',
  'qualified',
  'inactive',
  'do_not_contact'
);

drop index if exists public.contacts_company_email_unique;
drop index if exists public.contacts_company_phone_unique;

alter table public.contacts
  drop constraint if exists contacts_check,
  drop constraint if exists contacts_company_id_fkey;

alter table public.contacts rename column public_email to work_email;
alter table public.contacts rename column contact_source_url to source_url;
alter table public.contacts rename column verified_at to last_verified_at;

alter table public.contacts
  alter column company_id drop not null,
  add column first_name text,
  add column last_name text,
  add column department text,
  add column seniority text,
  add column personal_email text,
  add column mobile_phone text,
  add column whatsapp_phone text,
  add column linkedin_url text,
  add column facebook_url text,
  add column instagram_url text,
  add column source_type text not null default 'manual',
  add column is_primary_contact boolean not null default false,
  add column contact_status public.contact_status not null default 'discovered',
  add column notes text,
  add column created_by uuid references public.profiles(id) on delete set null,
  add column assigned_to uuid references public.profiles(id) on delete set null,
  add column deleted_at timestamptz,
  add constraint contacts_company_id_fk
    foreign key (company_id) references public.companies(id) on delete restrict;

update public.contacts as contact
set created_by = company.created_by
from public.companies as company
where contact.company_id = company.id
  and contact.created_by is null;

create or replace function public.normalise_contact_name(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    btrim(regexp_replace(coalesce(value, ''), '[[:space:]]+', ' ', 'g')),
    ''
  );
$$;

create or replace function public.normalise_contact_name_key(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    btrim(
      regexp_replace(
        lower(coalesce(public.normalise_contact_name(value), '')),
        '[^[:alnum:]]+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;

create or replace function public.normalise_contact_profile_url(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    regexp_replace(
      split_part(
        split_part(lower(btrim(coalesce(value, ''))), '#', 1),
        '?',
        1
      ),
      '/+$',
      '',
      'g'
    ),
    ''
  );
$$;

create or replace function public.contact_fingerprint(
  contact_company_id uuid,
  contact_full_name text,
  contact_work_email text,
  contact_personal_email text,
  contact_public_phone text,
  contact_mobile_phone text,
  contact_whatsapp_phone text,
  contact_linkedin_url text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when nullif(concat_ws(
      '|',
      contact_company_id::text,
      public.normalise_contact_name_key(contact_full_name),
      public.normalise_public_email(contact_work_email),
      public.normalise_public_email(contact_personal_email),
      nullif(public.normalise_public_phone(contact_public_phone), ''),
      nullif(public.normalise_public_phone(contact_mobile_phone), ''),
      nullif(public.normalise_public_phone(contact_whatsapp_phone), ''),
      public.normalise_contact_profile_url(contact_linkedin_url)
    ), '') is null then null
    else md5(concat_ws(
      '|',
      contact_company_id::text,
      public.normalise_contact_name_key(contact_full_name),
      public.normalise_public_email(contact_work_email),
      public.normalise_public_email(contact_personal_email),
      nullif(public.normalise_public_phone(contact_public_phone), ''),
      nullif(public.normalise_public_phone(contact_mobile_phone), ''),
      nullif(public.normalise_public_phone(contact_whatsapp_phone), ''),
      public.normalise_contact_profile_url(contact_linkedin_url)
    ))
  end;
$$;

-- Duplicate decisions use multiple corroborating signals. The composite fingerprint
-- is intentionally non-unique and is never the sole insert blocker.
create or replace function public.contacts_are_likely_duplicates(
  left_contact jsonb,
  right_contact jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  with contact_values as (
    select
      public.normalise_contact_name_key(left_contact ->> 'full_name') as left_name,
      public.normalise_contact_name_key(right_contact ->> 'full_name') as right_name,
      public.normalise_public_email(left_contact ->> 'work_email') as left_work_email,
      public.normalise_public_email(left_contact ->> 'personal_email') as left_personal_email,
      public.normalise_public_email(right_contact ->> 'work_email') as right_work_email,
      public.normalise_public_email(right_contact ->> 'personal_email') as right_personal_email,
      nullif(public.normalise_public_phone(left_contact ->> 'public_phone'), '') as left_public_phone,
      nullif(public.normalise_public_phone(right_contact ->> 'public_phone'), '') as right_public_phone,
      nullif(public.normalise_public_phone(left_contact ->> 'mobile_phone'), '') as left_mobile_phone,
      nullif(public.normalise_public_phone(right_contact ->> 'mobile_phone'), '') as right_mobile_phone,
      nullif(public.normalise_public_phone(left_contact ->> 'whatsapp_phone'), '') as left_whatsapp_phone,
      nullif(public.normalise_public_phone(right_contact ->> 'whatsapp_phone'), '') as right_whatsapp_phone,
      public.normalise_contact_profile_url(left_contact ->> 'linkedin_url') as left_linkedin_url,
      public.normalise_contact_profile_url(right_contact ->> 'linkedin_url') as right_linkedin_url,
      nullif(left_contact ->> 'company_id', '') as left_company_id,
      nullif(right_contact ->> 'company_id', '') as right_company_id
  )
  select
    (
      left_work_email is not null
      and left_work_email in (right_work_email, right_personal_email)
    )
    or (
      left_personal_email is not null
      and left_personal_email in (right_work_email, right_personal_email)
    )
    or (
      left_linkedin_url is not null
      and left_linkedin_url = right_linkedin_url
    )
    or (
      left_whatsapp_phone is not null
      and left_whatsapp_phone = right_whatsapp_phone
    )
    or (
      left_name is not null
      and left_name = right_name
      and (
        (left_company_id is not null and left_company_id = right_company_id)
        or (
          left_public_phone is not null
          and left_public_phone = right_public_phone
        )
        or (
          left_mobile_phone is not null
          and left_mobile_phone = right_mobile_phone
        )
      )
    )
  from contact_values;
$$;

create or replace function public.normalise_contact_record()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.first_name := public.normalise_contact_name(new.first_name);
  new.last_name := public.normalise_contact_name(new.last_name);
  new.full_name := public.normalise_contact_name(new.full_name);
  if new.full_name is null then
    new.full_name := public.normalise_contact_name(
      concat_ws(' ', new.first_name, new.last_name)
    );
  end if;

  new.job_title := public.normalise_contact_name(new.job_title);
  new.department := public.normalise_contact_name(new.department);
  new.seniority := public.normalise_contact_name(new.seniority);
  new.notes := nullif(btrim(coalesce(new.notes, '')), '');
  new.work_email := public.normalise_public_email(new.work_email);
  new.personal_email := public.normalise_public_email(new.personal_email);
  new.public_phone := nullif(public.normalise_public_phone(new.public_phone), '');
  new.mobile_phone := nullif(public.normalise_public_phone(new.mobile_phone), '');
  new.whatsapp_phone := nullif(public.normalise_public_phone(new.whatsapp_phone), '');
  new.linkedin_url := public.normalise_contact_profile_url(new.linkedin_url);
  new.facebook_url := public.normalise_contact_profile_url(new.facebook_url);
  new.instagram_url := public.normalise_contact_profile_url(new.instagram_url);
  new.source_url := btrim(new.source_url);
  new.source_type := public.normalise_contact_name(new.source_type);
  return new;
end;
$$;

update public.contacts
set
  first_name = first_name,
  last_name = last_name,
  full_name = public.normalise_contact_name(full_name),
  job_title = public.normalise_contact_name(job_title),
  department = public.normalise_contact_name(department),
  seniority = public.normalise_contact_name(seniority),
  work_email = public.normalise_public_email(work_email),
  personal_email = public.normalise_public_email(personal_email),
  public_phone = nullif(public.normalise_public_phone(public_phone), ''),
  mobile_phone = nullif(public.normalise_public_phone(mobile_phone), ''),
  whatsapp_phone = nullif(public.normalise_public_phone(whatsapp_phone), ''),
  linkedin_url = public.normalise_contact_profile_url(linkedin_url),
  facebook_url = public.normalise_contact_profile_url(facebook_url),
  instagram_url = public.normalise_contact_profile_url(instagram_url),
  source_url = btrim(source_url),
  source_type = coalesce(public.normalise_contact_name(source_type), 'manual'),
  notes = nullif(btrim(coalesce(notes, '')), '');

alter table public.contacts
  add column fingerprint text generated always as (
    public.contact_fingerprint(
      company_id,
      full_name,
      work_email,
      personal_email,
      public_phone,
      mobile_phone,
      whatsapp_phone,
      linkedin_url
    )
  ) stored,
  add constraint contacts_identity_required_check check (
    full_name is not null
    or first_name is not null
    or last_name is not null
    or work_email is not null
    or personal_email is not null
    or public_phone is not null
    or mobile_phone is not null
    or whatsapp_phone is not null
    or linkedin_url is not null
  ) not valid,
  add constraint contacts_full_name_length_check
    check (full_name is null or char_length(full_name) between 1 and 200) not valid,
  add constraint contacts_first_name_length_check
    check (first_name is null or char_length(first_name) between 1 and 120) not valid,
  add constraint contacts_last_name_length_check
    check (last_name is null or char_length(last_name) between 1 and 120) not valid,
  add constraint contacts_job_title_nonempty_check
    check (job_title is null or char_length(btrim(job_title)) between 1 and 160) not valid,
  add constraint contacts_department_nonempty_check
    check (department is null or char_length(btrim(department)) between 1 and 160) not valid,
  add constraint contacts_seniority_nonempty_check
    check (seniority is null or char_length(btrim(seniority)) between 1 and 80) not valid,
  add constraint contacts_notes_nonempty_check
    check (notes is null or char_length(btrim(notes)) between 1 and 5000) not valid,
  add constraint contacts_work_email_format_check check (
    work_email is null
    or (
      work_email = public.normalise_public_email(work_email)
      and work_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ) not valid,
  add constraint contacts_personal_email_format_check check (
    personal_email is null
    or (
      personal_email = public.normalise_public_email(personal_email)
      and personal_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ) not valid,
  add constraint contacts_public_phone_format_check
    check (public_phone is null or public_phone ~ '^[0-9]{7,15}$') not valid,
  add constraint contacts_mobile_phone_format_check
    check (mobile_phone is null or mobile_phone ~ '^[0-9]{7,15}$') not valid,
  add constraint contacts_whatsapp_phone_format_check
    check (whatsapp_phone is null or whatsapp_phone ~ '^[0-9]{7,15}$') not valid,
  add constraint contacts_linkedin_url_format_check
    check (linkedin_url is null or linkedin_url ~ '^https?://([^.]+\.)?linkedin\.com/') not valid,
  add constraint contacts_facebook_url_format_check
    check (facebook_url is null or facebook_url ~ '^https?://([^.]+\.)?facebook\.com/') not valid,
  add constraint contacts_instagram_url_format_check
    check (instagram_url is null or instagram_url ~ '^https?://([^.]+\.)?instagram\.com/') not valid,
  add constraint contacts_source_url_format_check
    check (source_url ~* '^https?://[^[:space:]]+$') not valid,
  add constraint contacts_source_type_nonempty_check
    check (char_length(btrim(source_type)) between 1 and 100) not valid,
  add constraint contacts_verification_date_check
    check (last_verified_at is null or last_verified_at >= discovered_at) not valid,
  add constraint contacts_fingerprint_format_check
    check (fingerprint is null or fingerprint ~ '^[a-f0-9]{32}$') not valid;

create trigger contacts_normalise_record
  before insert or update of
    full_name,
    first_name,
    last_name,
    job_title,
    department,
    seniority,
    notes,
    work_email,
    personal_email,
    public_phone,
    mobile_phone,
    whatsapp_phone,
    linkedin_url,
    facebook_url,
    instagram_url,
    source_url,
    source_type
  on public.contacts
  for each row execute function public.normalise_contact_record();

create or replace function public.protect_contact_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_sales_management() then
    return new;
  end if;
  if not public.is_active_user() then
    raise exception 'Inactive users cannot update contacts' using errcode = '42501';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by cannot be changed' using errcode = '42501';
  end if;
  if new.deleted_at is distinct from old.deleted_at then
    raise exception 'deleted_at can only be changed by management' using errcode = '42501';
  end if;
  if new.assigned_to is distinct from old.assigned_to
    and new.assigned_to is not null
    and new.assigned_to <> auth.uid() then
    raise exception 'Representatives cannot assign contacts to other users'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger contacts_protect_fields
  before update on public.contacts
  for each row execute function public.protect_contact_fields();

create index contacts_full_name_normalised_idx
  on public.contacts (public.normalise_contact_name_key(full_name))
  where full_name is not null and deleted_at is null;
create index contacts_work_email_idx
  on public.contacts (work_email)
  where work_email is not null and deleted_at is null;
create index contacts_public_phone_idx
  on public.contacts (public_phone)
  where public_phone is not null and deleted_at is null;
create index contacts_mobile_phone_idx
  on public.contacts (mobile_phone)
  where mobile_phone is not null and deleted_at is null;
create index contacts_whatsapp_phone_idx
  on public.contacts (whatsapp_phone)
  where whatsapp_phone is not null and deleted_at is null;
create index contacts_linkedin_url_idx
  on public.contacts (linkedin_url)
  where linkedin_url is not null and deleted_at is null;
create index contacts_status_idx
  on public.contacts (contact_status)
  where deleted_at is null;
create index contacts_fingerprint_idx
  on public.contacts (fingerprint)
  where fingerprint is not null;
create index contacts_active_company_created_idx
  on public.contacts (company_id, created_at desc)
  where deleted_at is null;
create index contacts_active_assignee_created_idx
  on public.contacts (assigned_to, created_at desc)
  where assigned_to is not null and deleted_at is null;
create index contacts_created_by_idx
  on public.contacts (created_by)
  where created_by is not null;
create index contacts_active_created_at_idx
  on public.contacts (created_at desc)
  where deleted_at is null;

create or replace function public.contact_company_is_active(target_company_id uuid)
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

create or replace function public.can_link_contact_to_company(target_company_id uuid)
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
        public.contact_company_is_active(target_company_id)
        and (
          public.is_sales_management()
          or public.can_access_company(target_company_id)
        )
      )
    );
$$;

create or replace function public.can_access_contact(target_contact_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and exists (
    select 1
    from public.contacts as contact
    where contact.id = target_contact_id
      and contact.deleted_at is null
      and public.contact_company_is_active(contact.company_id)
      and (
        public.is_sales_management()
        or contact.created_by = auth.uid()
        or contact.assigned_to = auth.uid()
        or (
          contact.company_id is not null
          and public.can_access_company(contact.company_id)
        )
      )
  );
$$;

-- Archived access is deliberately explicit. Direct table reads expose active
-- contacts only, including for management.
create or replace function public.list_archived_contacts()
returns setof public.contacts
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
  select contact.*
  from public.contacts as contact
  left join public.companies as company on company.id = contact.company_id
  where contact.deleted_at is not null
    or (contact.company_id is not null and company.deleted_at is not null)
  order by contact.created_at desc, contact.id;
end;
$$;

revoke all on function public.contact_company_is_active(uuid) from public;
revoke all on function public.can_link_contact_to_company(uuid) from public;
revoke all on function public.can_access_contact(uuid) from public;
revoke all on function public.list_archived_contacts() from public;
grant execute on function public.can_link_contact_to_company(uuid) to authenticated;
grant execute on function public.can_access_contact(uuid) to authenticated;
grant execute on function public.list_archived_contacts() to authenticated;

drop policy if exists "users read permitted contacts" on public.contacts;
drop policy if exists "users create permitted contacts" on public.contacts;
drop policy if exists "users update permitted contacts" on public.contacts;
drop policy if exists "users delete permitted contacts" on public.contacts;

create policy "users read permitted active contacts"
  on public.contacts for select to authenticated
  using (public.can_access_contact(id));

create policy "active users create sourced contacts"
  on public.contacts for insert to authenticated
  with check (
    public.is_active_user()
    and created_by = (select auth.uid())
    and deleted_at is null
    and (assigned_to is null or assigned_to = (select auth.uid()) or public.is_sales_management())
    and public.can_link_contact_to_company(company_id)
  );

create policy "users update permitted active contacts"
  on public.contacts for update to authenticated
  using (public.can_access_contact(id))
  with check (
    public.is_active_user()
    and public.can_link_contact_to_company(company_id)
    and (
      public.is_sales_management()
      or (
        deleted_at is null
        and (
          created_by = (select auth.uid())
          or assigned_to = (select auth.uid())
          or (
            company_id is not null
            and public.can_access_company(company_id)
          )
        )
      )
    )
  );

comment on column public.contacts.full_name is
  'Canonical display name. first_name and last_name are optional aids and are never used to split or overwrite a supplied cultural name.';
comment on column public.contacts.company_id is
  'Nullable for legitimate independent public contacts; linked companies use ON DELETE RESTRICT to preserve CRM history.';
comment on column public.contacts.fingerprint is
  'Non-unique exact-record signal. Likely duplicate decisions require corroborating email, LinkedIn, WhatsApp, phone-plus-name, or company-plus-name evidence.';
comment on function public.list_archived_contacts() is
  'Explicit management-only access to soft-deleted contacts and contacts hidden by a soft-deleted company.';

commit;
