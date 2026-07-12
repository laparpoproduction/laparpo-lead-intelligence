begin;

alter table public.companies
  add column deleted_at timestamptz;

create index companies_active_created_at_idx
  on public.companies (created_at desc)
  where deleted_at is null;

commit;
