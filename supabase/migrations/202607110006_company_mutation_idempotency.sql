begin;

create table public.company_mutation_confirmations (
  confirmation_id uuid primary key,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  operation text not null,
  company_id uuid references public.companies(id) on delete restrict,
  submission_hash text not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint company_mutation_confirmations_operation_check
    check (operation in ('create', 'update')),
  constraint company_mutation_confirmations_hash_check
    check (submission_hash ~ '^[a-f0-9]{64}$'),
  constraint company_mutation_confirmations_consumed_check
    check (
      (company_id is null and consumed_at is null)
      or (company_id is not null and consumed_at is not null)
    )
);

create index company_mutation_confirmations_actor_created_idx
  on public.company_mutation_confirmations (actor_id, created_at desc);

alter table public.company_mutation_confirmations enable row level security;

create policy "users read own company confirmations"
  on public.company_mutation_confirmations for select to authenticated
  using (public.is_active_user() and actor_id = (select auth.uid()));

create policy "users create own company confirmations"
  on public.company_mutation_confirmations for insert to authenticated
  with check (
    public.is_active_user()
    and actor_id = (select auth.uid())
    and (
      (operation = 'create' and company_id is null and consumed_at is null)
      or (
        operation = 'update'
        and company_id is not null
        and consumed_at is not null
        and public.can_access_company(company_id)
      )
    )
  );

create policy "users consume own company confirmations"
  on public.company_mutation_confirmations for update to authenticated
  using (
    public.is_active_user()
    and actor_id = (select auth.uid())
    and company_id is null
    and consumed_at is null
  )
  with check (
    public.is_active_user()
    and actor_id = (select auth.uid())
    and company_id is not null
    and consumed_at is not null
  );

grant select, insert, update on public.company_mutation_confirmations to authenticated;

create or replace function public.create_confirmed_duplicate_company(
  target_confirmation_id uuid,
  target_submission_hash text,
  company_data jsonb
)
returns public.companies
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_confirmation public.company_mutation_confirmations%rowtype;
  company_record public.companies%rowtype;
begin
  if not public.is_active_user() then
    raise exception 'Active authentication is required' using errcode = '42501';
  end if;

  if target_submission_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid submission hash' using errcode = '22023';
  end if;

  begin
    insert into public.company_mutation_confirmations (
      confirmation_id,
      actor_id,
      operation,
      submission_hash
    ) values (
      target_confirmation_id,
      auth.uid(),
      'create',
      target_submission_hash
    );
  exception
    when unique_violation then
      select * into existing_confirmation
      from public.company_mutation_confirmations
      where confirmation_id = target_confirmation_id;

      if not found
        or existing_confirmation.actor_id <> auth.uid()
        or existing_confirmation.operation <> 'create'
        or existing_confirmation.submission_hash <> target_submission_hash
        or existing_confirmation.company_id is null then
        raise exception 'Confirmation is invalid or currently being consumed'
          using errcode = '22023';
      end if;

      select * into company_record
      from public.companies
      where id = existing_confirmation.company_id;
      if not found then
        raise exception 'Confirmed company no longer exists' using errcode = 'P0002';
      end if;
      return company_record;
  end;

  insert into public.companies (
    legal_name, display_name, company_type, industry, description,
    public_phone, public_email, website_url, website_domain, facebook_url,
    instagram_url, tiktok_url, youtube_url, google_maps_url, address_line_1,
    address_line_2, city, state, postcode, country, estimated_branch_count,
    source_url, source_type, discovered_at, last_verified_at, created_by
  ) values (
    company_data ->> 'legal_name',
    company_data ->> 'display_name',
    (company_data ->> 'company_type')::public.company_category,
    company_data ->> 'industry',
    company_data ->> 'description',
    company_data ->> 'public_phone',
    company_data ->> 'public_email',
    company_data ->> 'website_url',
    company_data ->> 'website_domain',
    company_data ->> 'facebook_url',
    company_data ->> 'instagram_url',
    company_data ->> 'tiktok_url',
    company_data ->> 'youtube_url',
    company_data ->> 'google_maps_url',
    company_data ->> 'address_line_1',
    company_data ->> 'address_line_2',
    company_data ->> 'city',
    company_data ->> 'state',
    company_data ->> 'postcode',
    company_data ->> 'country',
    (company_data ->> 'estimated_branch_count')::integer,
    company_data ->> 'source_url',
    company_data ->> 'source_type',
    (company_data ->> 'discovered_at')::timestamptz,
    (company_data ->> 'last_verified_at')::timestamptz,
    auth.uid()
  ) returning * into company_record;

  update public.company_mutation_confirmations
  set company_id = company_record.id,
      consumed_at = now()
  where confirmation_id = target_confirmation_id;

  return company_record;
end;
$$;

revoke all on function public.create_confirmed_duplicate_company(uuid, text, jsonb)
  from public;
grant execute on function public.create_confirmed_duplicate_company(uuid, text, jsonb)
  to authenticated;

commit;
