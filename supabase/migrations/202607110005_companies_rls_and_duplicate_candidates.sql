begin;

drop policy if exists "users read permitted companies" on public.companies;
drop policy if exists "active users create sourced companies" on public.companies;
drop policy if exists "users update permitted companies" on public.companies;
drop policy if exists "users delete permitted companies" on public.companies;

create policy "users read permitted active companies"
  on public.companies for select to authenticated
  using (
    public.is_active_user()
    and public.can_access_company(id)
    and (deleted_at is null or public.is_sales_management())
  );

create policy "active users create sourced companies"
  on public.companies for insert to authenticated
  with check (
    public.is_active_user()
    and created_by = (select auth.uid())
    and (deleted_at is null or public.is_sales_management())
  );

create policy "users update permitted active companies"
  on public.companies for update to authenticated
  using (
    public.is_active_user()
    and public.can_access_company(id)
    and (deleted_at is null or public.is_sales_management())
  )
  with check (
    public.is_active_user()
    and public.can_access_company(id)
    and (deleted_at is null or public.is_sales_management())
  );

create policy "management deletes companies"
  on public.companies for delete to authenticated
  using (public.is_active_user() and public.is_sales_management());

create or replace function public.find_company_duplicate_candidates(
  candidate_name text,
  candidate_domain text default null,
  candidate_phone text default null,
  candidate_city text default null,
  candidate_state text default null,
  candidate_country text default null
)
returns setof public.companies
language sql
stable
security invoker
set search_path = ''
as $$
  select company.*
  from public.companies as company
  where company.deleted_at is null
    and public.normalise_company_name(company.display_name)
      = public.normalise_company_name(candidate_name)
    and (
      (
        coalesce(public.normalise_website_domain(candidate_domain), '') <> ''
        and company.website_domain = public.normalise_website_domain(candidate_domain)
      )
      or (
        coalesce(public.normalise_public_phone(candidate_phone), '') <> ''
        and company.public_phone = public.normalise_public_phone(candidate_phone)
      )
      or (
        coalesce(btrim(candidate_city), '') <> ''
        and coalesce(btrim(candidate_state), '') <> ''
        and btrim(lower(regexp_replace(coalesce(company.city, ''), '[^a-zA-Z0-9]+', ' ', 'g')))
          = btrim(lower(regexp_replace(candidate_city, '[^a-zA-Z0-9]+', ' ', 'g')))
        and btrim(lower(regexp_replace(coalesce(company.state, ''), '[^a-zA-Z0-9]+', ' ', 'g')))
          = btrim(lower(regexp_replace(candidate_state, '[^a-zA-Z0-9]+', ' ', 'g')))
        and upper(coalesce(company.country, '')) = upper(coalesce(candidate_country, ''))
      )
    )
  order by company.id;
$$;

revoke all on function public.find_company_duplicate_candidates(
  text,
  text,
  text,
  text,
  text,
  text
) from public;
grant execute on function public.find_company_duplicate_candidates(
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;

commit;
