\set ON_ERROR_STOP on

-- This Opportunity predates migration 019. Its commercial metadata is
-- intentionally populated so the migration proves it does not infer pipeline
-- stage, ownership, Won, or Lost state from historical fields.
insert into public.opportunities (
  id,
  lead_id,
  service,
  estimated_value_myr,
  quotation_number,
  quotation_sent_at,
  meeting_at,
  deposit_amount_myr,
  deposit_received_at
) values (
  '89000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000301',
  'corporate',
  8000,
  'LEGACY-QUOTATION-019',
  '2026-07-01T08:00:00Z',
  '2026-07-02T08:00:00Z',
  4000,
  '2026-07-03T08:00:00Z'
);
