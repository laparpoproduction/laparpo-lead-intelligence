\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values (
  '00000000-0000-0000-0000-000000000004',
  'inactive-sales@laparpo.test',
  '{"full_name":"Inactive Sales"}'
);

insert into public.companies (
  id,
  legal_name,
  display_name,
  company_type,
  source_url,
  source_type,
  discovered_at,
  created_by
) values (
  '10000000-0000-0000-0000-000000000012',
  'Inactive Owner Company Sdn Bhd',
  'Inactive Owner Company',
  'other',
  'https://inactive-owner-company.test/about',
  'company_website',
  now(),
  '00000000-0000-0000-0000-000000000004'
);

update public.profiles
set is_active = false
where id = '00000000-0000-0000-0000-000000000004';

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  false
);

insert into public.companies (
  id,
  legal_name,
  display_name,
  company_type,
  industry,
  public_phone,
  public_email,
  website_url,
  address_line_1,
  city,
  state,
  postcode,
  country,
  estimated_branch_count,
  source_url,
  source_type,
  discovered_at,
  created_by
) values (
  '10000000-0000-0000-0000-000000000010',
  '  CRM Sample Foods Sdn Bhd  ',
  '  CRM Sample Foods  ',
  'fnb',
  'Food and beverage',
  '017-222 3344',
  'SALES@CRM-SAMPLE.TEST',
  'https://www.crm-sample.test/locations',
  '10, Jalan Contoh',
  'Seberang Jaya',
  'Penang',
  '13700',
  'my',
  2,
  'https://crm-sample.test/about',
  'company_website',
  now(),
  '00000000-0000-0000-0000-000000000001'
);

do $$
declare
  company_record public.companies%rowtype;
begin
  select * into strict company_record
  from public.companies
  where id = '10000000-0000-0000-0000-000000000010';

  if company_record.legal_name <> 'CRM Sample Foods Sdn Bhd'
    or company_record.display_name <> 'CRM Sample Foods'
    or company_record.website_domain <> 'crm-sample.test'
    or company_record.public_phone <> '60172223344'
    or company_record.public_email <> 'sales@crm-sample.test'
    or company_record.country <> 'MY' then
    raise exception 'Company normalization failed';
  end if;

  if company_record.source_url is null or company_record.discovered_at is null then
    raise exception 'Company source provenance was not retained';
  end if;
end;
$$;

update public.companies
set description = 'Updated during company trigger test',
    updated_at = '2000-01-01 00:00:00+00'
where id = '10000000-0000-0000-0000-000000000010';

do $$
begin
  if exists (
    select 1 from public.companies
    where id = '10000000-0000-0000-0000-000000000010'
      and updated_at <= '2000-01-01 00:00:00+00'
  ) then
    raise exception 'companies updated_at trigger did not run';
  end if;

  begin
    insert into public.companies (
      legal_name,
      display_name,
      company_type,
      source_type,
      discovered_at,
      created_by
    ) values (
      'Missing Source Sdn Bhd',
      'Missing Source',
      'other',
      'manual',
      now(),
      '00000000-0000-0000-0000-000000000001'
    );
    raise exception 'Company without source provenance was accepted';
  exception
    when check_violation then null;
  end;
end;
$$;

reset role;

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000004',
  false
);

do $$
declare
  affected_rows integer;
begin
  begin
    insert into public.companies (
      legal_name,
      display_name,
      company_type,
      source_url,
      source_type,
      discovered_at,
      created_by
    ) values (
      'Inactive Insert Sdn Bhd',
      'Inactive Insert',
      'other',
      'https://inactive-insert.test/about',
      'company_website',
      now(),
      '00000000-0000-0000-0000-000000000004'
    );
    raise exception 'Inactive user created a company';
  exception
    when insufficient_privilege then null;
  end;

  update public.companies
  set description = 'Inactive unauthorized update'
  where id = '10000000-0000-0000-0000-000000000012';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'Inactive user updated a company';
  end if;

  delete from public.companies
  where id = '10000000-0000-0000-0000-000000000012';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'Inactive user deleted a company';
  end if;
end;
$$;

reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000002',
  false
);

insert into public.companies (
  id,
  legal_name,
  display_name,
  company_type,
  city,
  state,
  country,
  source_url,
  source_type,
  discovered_at,
  created_by
) values (
  '10000000-0000-0000-0000-000000000011',
  'Representative Company Sdn Bhd',
  'Representative Company',
  'other',
  'George Town',
  'Penang',
  'MY',
  'https://representative-company.test/about',
  'company_website',
  now(),
  '00000000-0000-0000-0000-000000000002'
);

do $$
begin
  if not exists (
    select 1 from public.companies
    where id = '10000000-0000-0000-0000-000000000011'
  ) then
    raise exception 'Representative cannot read a company they created';
  end if;
end;
$$;

reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000003',
  false
);

do $$
declare
  affected_rows integer;
begin
  if exists (
    select 1 from public.companies
    where id = '10000000-0000-0000-0000-000000000011'
  ) then
    raise exception 'Unrelated representative read a company';
  end if;

  update public.companies
  set description = 'Unauthorized update'
  where id = '10000000-0000-0000-0000-000000000011';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'Unrelated representative updated a company';
  end if;

  delete from public.companies
  where id = '10000000-0000-0000-0000-000000000011';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'Unrelated representative deleted a company';
  end if;
end;
$$;

reset role;
