\set ON_ERROR_STOP on

-- Read-list fixtures are isolated from earlier mutation smoke suites.
reset role;
insert into public.companies (
  id, legal_name, display_name, company_type, country, source_url,
  source_type, discovered_at, created_by
) values
(
  '85000000-0000-4000-8000-000000000101',
  'Opportunity Visible Client Sdn Bhd',
  'Opportunity Visible Client',
  'other',
  'MY',
  'https://opportunity-visible.test',
  'company_website',
  now(),
  '71000000-0000-4000-8000-000000000003'
),
(
  '85000000-0000-4000-8000-000000000102',
  'Opportunity Hidden Client Sdn Bhd',
  'Opportunity Hidden Client',
  'other',
  'MY',
  'https://opportunity-hidden.test',
  'company_website',
  now(),
  '71000000-0000-4000-8000-000000000001'
),
(
  '85000000-0000-4000-8000-000000000103',
  'Opportunity Archived Client Sdn Bhd',
  'Opportunity Archived Client',
  'other',
  'MY',
  'https://opportunity-archived.test',
  'company_website',
  now(),
  '71000000-0000-4000-8000-000000000001'
);

insert into public.leads (
  id, company_id, title, stage, lead_status, created_by, assigned_to,
  source_type, discovered_at, service_interest
) values
(
  '85000000-0000-4000-8000-000000000001',
  '85000000-0000-4000-8000-000000000101',
  'Representative visible Opportunity search needle',
  'qualified',
  'active',
  '71000000-0000-4000-8000-000000000003',
  null,
  'manual',
  now(),
  'food_review'
),
(
  '85000000-0000-4000-8000-000000000002',
  '85000000-0000-4000-8000-000000000102',
  'Representative inaccessible Opportunity search needle',
  'qualified',
  'active',
  '71000000-0000-4000-8000-000000000001',
  null,
  'manual',
  now(),
  'corporate_video'
),
(
  '85000000-0000-4000-8000-000000000003',
  null,
  'Archived Lead Opportunity search needle',
  'qualified',
  'active',
  '71000000-0000-4000-8000-000000000001',
  null,
  'manual',
  now(),
  'other'
),
(
  '85000000-0000-4000-8000-000000000004',
  '85000000-0000-4000-8000-000000000103',
  'Archived Company Opportunity search needle',
  'qualified',
  'active',
  '71000000-0000-4000-8000-000000000001',
  null,
  'manual',
  now(),
  'event_coverage'
),
(
  '85000000-0000-4000-8000-000000000005',
  '85000000-0000-4000-8000-000000000102',
  'Ledger-backed conversion with ordinary sibling',
  'qualified',
  'active',
  '71000000-0000-4000-8000-000000000001',
  null,
  'manual',
  now(),
  'hard_selling_video'
);

insert into public.opportunities (
  id, lead_id, service, estimated_value_myr, quotation_number
) values
(
  '86000000-0000-4000-8000-000000000001',
  '85000000-0000-4000-8000-000000000001',
  'food_review',
  3500,
  'Q-VISIBLE'
),
(
  '86000000-0000-4000-8000-000000000002',
  '85000000-0000-4000-8000-000000000002',
  'corporate',
  8000,
  'Q-HIDDEN'
),
(
  '86000000-0000-4000-8000-000000000003',
  '85000000-0000-4000-8000-000000000003',
  'other',
  null,
  null
),
(
  '86000000-0000-4000-8000-000000000004',
  '85000000-0000-4000-8000-000000000004',
  'event_coverage',
  5000,
  null
),
(
  '86000000-0000-4000-8000-000000000010',
  '74000000-0000-4000-8000-000000000010',
  'other',
  null,
  null
);

update public.leads
set deleted_at = now()
where id = '85000000-0000-4000-8000-000000000003';
update public.companies
set deleted_at = now()
where id = '85000000-0000-4000-8000-000000000103';

-- Build the designated conversion Opportunity through the production RPC.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000001',
  false
);
select *
from public.convert_lead_to_opportunity(
  '85000000-0000-4000-8000-000000000005',
  'hard_selling'::public.service_type,
  5000
);
insert into public.opportunities (
  id, lead_id, service, estimated_value_myr
) values (
  '86000000-0000-4000-8000-000000000005',
  '85000000-0000-4000-8000-000000000005',
  'social_media_campaign',
  3500
);

-- A. Active management sees permitted active Opportunities, including both
-- Opportunities for one converted Lead.
do $$
begin
  if not exists (
    select 1
    from public.opportunity_list_read_model
    where id = '86000000-0000-4000-8000-000000000001'
      and lead_title = 'Representative visible Opportunity search needle'
      and company_name = 'Opportunity Visible Client'
  ) then
    raise exception 'Active management could not list an allowed Opportunity';
  end if;
  if (
    select count(*)
    from public.opportunity_list_read_model
    where lead_id = '85000000-0000-4000-8000-000000000005'
  ) <> 2 then
    raise exception 'Multiple Opportunities for one Lead were not preserved';
  end if;
  if not exists (
    select 1
    from public.opportunity_list_read_model
    where id = '86000000-0000-4000-8000-000000000001'
      and lead_id = '85000000-0000-4000-8000-000000000001'
      and service = 'food_review'::public.service_type
      and estimated_value_myr = 3500
      and quotation_number = 'Q-VISIBLE'
      and lead_title = 'Representative visible Opportunity search needle'
      and company_id = '85000000-0000-4000-8000-000000000101'
      and company_name = 'Opportunity Visible Client'
      and not conversion_opportunity
  ) then
    raise exception 'Exact Opportunity detail projection was incomplete';
  end if;
end;
$$;

-- G/H. Only the exact ledger relationship receives conversion classification.
do $$
declare
  designated_id uuid;
begin
  select opportunity_id into designated_id
  from public.lead_conversions
  where lead_id = '85000000-0000-4000-8000-000000000005';

  if not exists (
    select 1 from public.opportunity_list_read_model
    where id = designated_id
      and conversion_opportunity
      and converted_at is not null
  ) then
    raise exception 'Designated conversion Opportunity was not classified';
  end if;
  if not exists (
    select 1 from public.opportunity_list_read_model
    where id = '86000000-0000-4000-8000-000000000005'
      and not conversion_opportunity
      and converted_at is null
  ) then
    raise exception 'Ordinary sibling Opportunity was misclassified or hidden';
  end if;
end;
$$;

-- I. A legacy converted Lead never causes a guessed ledger relationship.
do $$
begin
  if not exists (
    select 1 from public.opportunity_list_read_model
    where id = '86000000-0000-4000-8000-000000000010'
      and not conversion_opportunity
      and converted_at is null
  ) then
    raise exception 'Legacy no-ledger Opportunity received guessed classification';
  end if;
end;
$$;

-- E/F. Archived Lead and archived Company isolation flow through the view.
do $$
begin
  if exists (
    select 1 from public.opportunity_list_read_model
    where id in (
      '86000000-0000-4000-8000-000000000003',
      '86000000-0000-4000-8000-000000000004'
    )
  ) then
    raise exception 'Archived Lead or Company leaked through Opportunity list';
  end if;
end;
$$;

-- B/C/J. The authenticated representative sees the directly readable parent
-- Lead, while search/filter/order/limit cannot reveal an inaccessible parent.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000003',
  false
);
do $$
begin
  if not exists (
    select 1 from public.opportunity_list_read_model
    where id = '86000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Representative could not list a readable Lead Opportunity';
  end if;
  if exists (
    select 1 from public.opportunity_list_read_model
    where id = '86000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'Representative saw an inaccessible Lead Opportunity';
  end if;
  if exists (
    select 1 from public.opportunity_list_read_model
    where id = '86000000-0000-4000-8000-000000000002'
      and company_name = 'Opportunity Hidden Client'
  ) then
    raise exception 'Exact UUID guess leaked restricted Company metadata';
  end if;
  if exists (
    select 1
    from public.opportunity_list_read_model
    where lead_title ilike '%search needle%'
      and service = 'corporate'::public.service_type
    order by created_at desc, id
    limit 25 offset 0
  ) then
    raise exception 'Search/filter/pagination bypassed Lead RLS';
  end if;
end;
$$;

-- D. Inactive actors receive no usable rows even when they previously had a
-- management-shaped role in the restore regression suite.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000007',
  false
);
do $$
begin
  if exists (select 1 from public.opportunity_list_read_model limit 1) then
    raise exception 'Inactive actor received Opportunity list access';
  end if;
end;
$$;

reset role;
