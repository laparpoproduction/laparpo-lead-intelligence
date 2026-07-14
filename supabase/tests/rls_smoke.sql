\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'admin@laparpo.test', '{"full_name":"Sample Admin"}'),
  ('00000000-0000-0000-0000-000000000002', 'sales1@laparpo.test', '{"full_name":"Sales One"}'),
  ('00000000-0000-0000-0000-000000000003', 'sales2@laparpo.test', '{"full_name":"Sales Two"}');

update public.profiles
set role = 'ceo_admin'
where id = '00000000-0000-0000-0000-000000000001';

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

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
  city,
  state,
  country,
  website_url,
  public_phone,
  source_url,
  source_type,
  discovered_at,
  created_by
) values (
  '10000000-0000-0000-0000-000000000001',
  'Sample Food Sdn Bhd',
  'Sample Food',
  'fnb',
  'Food and beverage',
  'Seberang Jaya',
  'Penang',
  'MY',
  'https://sample-food.test',
  '017-0000001',
  'https://sample-food.test/contact',
  'company_website',
  now(),
  '00000000-0000-0000-0000-000000000001'
);

insert into public.contacts (
  id,
  company_id,
  full_name,
  job_title,
  work_email,
  source_url,
  source_type,
  discovered_at,
  created_by
) values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Public Contact',
  'Marketing Manager',
  'marketing@sample-food.test',
  'https://sample-food.test/contact',
  'company_website',
  now(),
  '00000000-0000-0000-0000-000000000001'
);

insert into public.lead_sources (
  id,
  company_id,
  source_url,
  source_type,
  discovered_at
) values (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'https://sample-food.test/contact',
  'company_website',
  now()
);

insert into public.leads (
  id,
  title,
  company_id,
  primary_source_id,
  assigned_to,
  created_by,
  category,
  reason_selected,
  source_type,
  source_url,
  discovered_at
) values (
  '40000000-0000-0000-0000-000000000001',
  'Sample Food marketing campaign',
  '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'fnb',
  'Public website lists a marketing contact',
  'company_website',
  'https://sample-food.test/contact',
  now()
);

reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000003',
  false
);

do $$
begin
  if exists (
    select 1 from public.companies
    where id = '10000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'RLS leak: unrelated sales representative read a company';
  end if;

  if exists (
    select 1 from public.leads
    where id = '40000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'RLS leak: unrelated sales representative read a lead';
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

do $$
begin
  if not exists (
    select 1 from public.companies
    where id = '10000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'RLS failure: assigned representative cannot read company';
  end if;

  if not exists (
    select 1 from public.leads
    where id = '40000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'RLS failure: assigned representative cannot read lead';
  end if;
end;
$$;

reset role;
