begin;

alter table public.companies
  add column address_line_1 text,
  add column address_line_2 text,
  add column postcode text;

drop index if exists public.companies_website_domain_unique;
drop index if exists public.companies_fingerprint_unique;

create or replace function public.normalise_public_email(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(lower(btrim(coalesce(value, ''))), '');
$$;

update public.companies
set
  legal_name = regexp_replace(btrim(legal_name), '[[:space:]]+', ' ', 'g'),
  display_name = regexp_replace(btrim(display_name), '[[:space:]]+', ' ', 'g'),
  website_domain = nullif(
    public.normalise_website_domain(
      coalesce(nullif(btrim(website_url), ''), website_domain)
    ),
    ''
  ),
  public_email = public.normalise_public_email(public_email),
  country = upper(coalesce(nullif(btrim(country), ''), 'MY')),
  public_phone = nullif(
    case
      when upper(coalesce(nullif(btrim(country), ''), 'MY')) = 'MY'
        then public.normalise_public_phone(public_phone)
      else regexp_replace(coalesce(public_phone, ''), '\D', '', 'g')
    end,
    ''
  );

create or replace function public.normalise_company_record()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.legal_name := regexp_replace(btrim(new.legal_name), '[[:space:]]+', ' ', 'g');
  new.display_name := regexp_replace(btrim(new.display_name), '[[:space:]]+', ' ', 'g');
  new.country := upper(coalesce(nullif(btrim(new.country), ''), 'MY'));
  new.website_domain := nullif(
    public.normalise_website_domain(
      coalesce(nullif(btrim(new.website_url), ''), new.website_domain)
    ),
    ''
  );
  new.public_email := public.normalise_public_email(new.public_email);
  new.public_phone := nullif(
    case
      when new.country = 'MY' then public.normalise_public_phone(new.public_phone)
      else regexp_replace(coalesce(new.public_phone, ''), '\D', '', 'g')
    end,
    ''
  );
  return new;
end;
$$;

create trigger companies_normalise_record
  before insert or update of
    legal_name,
    display_name,
    country,
    website_url,
    website_domain,
    public_email,
    public_phone
  on public.companies
  for each row execute function public.normalise_company_record();

alter table public.companies
  add constraint companies_legal_name_length_check
    check (char_length(legal_name) between 2 and 200) not valid,
  add constraint companies_legal_name_trimmed_check
    check (legal_name = btrim(legal_name)) not valid,
  add constraint companies_display_name_trimmed_check
    check (display_name = btrim(display_name)) not valid,
  add constraint companies_country_iso_code_check
    check (country = upper(country) and btrim(country) ~ '^[A-Z]{2}$') not valid,
  add constraint companies_website_url_http_check
    check (website_url is null or website_url ~* '^https?://[^[:space:]]+$') not valid,
  add constraint companies_facebook_url_http_check
    check (facebook_url is null or facebook_url ~* '^https?://[^[:space:]]+$') not valid,
  add constraint companies_instagram_url_http_check
    check (instagram_url is null or instagram_url ~* '^https?://[^[:space:]]+$') not valid,
  add constraint companies_tiktok_url_http_check
    check (tiktok_url is null or tiktok_url ~* '^https?://[^[:space:]]+$') not valid,
  add constraint companies_youtube_url_http_check
    check (youtube_url is null or youtube_url ~* '^https?://[^[:space:]]+$') not valid,
  add constraint companies_google_maps_url_http_check
    check (google_maps_url is null or google_maps_url ~* '^https?://[^[:space:]]+$') not valid,
  add constraint companies_website_domain_normalised_check
    check (
      website_domain is null
      or (
        website_domain = lower(website_domain)
        and website_domain !~ '^www\.'
        and website_domain ~ '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$'
      )
    ) not valid,
  add constraint companies_public_email_normalised_check
    check (
      public_email is null
      or (
        public_email = public.normalise_public_email(public_email)
        and public_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    ) not valid,
  add constraint companies_public_phone_normalised_check
    check (
      public_phone is null
      or (
        country = 'MY' and public_phone ~ '^60[0-9]{7,11}$'
      )
      or (
        country <> 'MY' and public_phone ~ '^[0-9]{7,15}$'
      )
    ) not valid,
  add constraint companies_postcode_length_check
    check (postcode is null or char_length(btrim(postcode)) between 1 and 20) not valid;

create index companies_display_name_normalised_idx
  on public.companies (public.normalise_company_name(display_name));
create index companies_website_domain_idx
  on public.companies (website_domain)
  where website_domain is not null;
create index companies_industry_normalised_idx
  on public.companies (lower(industry))
  where industry is not null;
create index companies_created_by_idx on public.companies (created_by);
create index companies_fingerprint_idx on public.companies (fingerprint);

drop policy if exists "users update permitted companies" on public.companies;
drop policy if exists "users delete permitted companies" on public.companies;

create policy "users update permitted companies"
  on public.companies for update to authenticated
  using (public.is_active_user() and public.can_access_company(id))
  with check (public.is_active_user() and public.can_access_company(id));

create policy "users delete permitted companies"
  on public.companies for delete to authenticated
  using (
    public.is_active_user()
    and (
      public.is_sales_management()
      or created_by = (select auth.uid())
    )
  );

commit;
