\set ON_ERROR_STOP on

-- Seed one pre-010 Lead so the additive migration proves that legacy data and
-- source ownership survive the stage/ownership/provenance conversion.
insert into auth.users (id, email, raw_user_meta_data) values (
  '90000000-0000-4000-8000-000000000001',
  'legacy-owner@laparpo.test',
  '{"full_name":"Legacy Lead Owner"}'
);

insert into public.companies (
  id,
  legal_name,
  display_name,
  company_type,
  country,
  source_url,
  source_type,
  discovered_at,
  created_by
) values (
  '90000000-0000-4000-8000-000000000101',
  'Legacy Lead Company Sdn Bhd',
  'Legacy Lead Company',
  'other',
  'MY',
  'https://legacy-lead.test/about',
  'company_website',
  '2026-07-13T00:00:00Z',
  '90000000-0000-4000-8000-000000000001'
);

insert into public.lead_sources (
  id,
  company_id,
  source_url,
  source_type,
  discovered_at
) values (
  '90000000-0000-4000-8000-000000000201',
  '90000000-0000-4000-8000-000000000101',
  'https://legacy-lead.test/campaign',
  'company_website',
  '2026-07-13T00:00:00Z'
);

insert into public.leads (
  id,
  company_id,
  primary_source_id,
  owner_id,
  status,
  priority,
  category,
  recommended_service,
  reason_selected
) values (
  '90000000-0000-4000-8000-000000000301',
  '90000000-0000-4000-8000-000000000101',
  '90000000-0000-4000-8000-000000000201',
  '90000000-0000-4000-8000-000000000001',
  'quotation',
  'medium',
  'other',
  'corporate',
  'Legacy Lead preserved through migration 010'
);
