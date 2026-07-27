\set ON_ERROR_STOP on

-- This row exists before the conversion ledger migration to prove that an
-- upgraded database preserves historical conversion state without guessing an
-- Opportunity relationship.
insert into public.leads (
  id, title, stage, lead_status, qualification_status,
  created_by, source_type, discovered_at, converted_at
) values (
  '74000000-0000-4000-8000-000000000010',
  'Legacy converted Lead without a stable Opportunity reference',
  'converted',
  'closed',
  'qualified',
  '90000000-0000-4000-8000-000000000001',
  'inbound',
  now(),
  now()
);
