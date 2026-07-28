begin;

-- Creation provenance is write-once. This guard has no runtime bypass: an
-- offline correction must deliberately disable the relevant trigger in a
-- reviewed maintenance migration, perform the correction, and re-enable it.
create or replace function public.reject_creation_audit_metadata_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  audit_column text;
begin
  if tg_nargs = 0 then
    raise exception 'Creation audit metadata guard is misconfigured'
      using
        errcode = '55000',
        detail = 'immutable_creation_audit_metadata:missing_columns';
  end if;

  foreach audit_column in array tg_argv
  loop
    if (pg_catalog.to_jsonb(new) -> audit_column)
      is distinct from (pg_catalog.to_jsonb(old) -> audit_column)
    then
      raise exception 'Creation audit metadata cannot be changed'
        using
          errcode = '42501',
          detail = pg_catalog.format(
            'immutable_creation_audit_metadata:%s.%s:%s',
            tg_table_schema,
            tg_table_name,
            audit_column
          );
    end if;
  end loop;

  return new;
end;
$$;

revoke all
  on function public.reject_creation_audit_metadata_update()
  from public;
revoke all
  on function public.reject_creation_audit_metadata_update()
  from authenticated;

do $$
declare
  application_role name;
begin
  foreach application_role in array array['anon'::name, 'service_role'::name]
  loop
    if exists (
      select 1
      from pg_catalog.pg_roles
      where rolname = application_role
    ) then
      execute pg_catalog.format(
        'revoke all on function public.reject_creation_audit_metadata_update() from %I',
        application_role
      );
    end if;
  end loop;
end;
$$;

drop trigger if exists companies_protect_creation_audit_metadata
  on public.companies;
create trigger companies_protect_creation_audit_metadata
  before update of created_by, created_at on public.companies
  for each row execute function
    public.reject_creation_audit_metadata_update('created_by', 'created_at');

drop trigger if exists contacts_protect_creation_audit_metadata
  on public.contacts;
create trigger contacts_protect_creation_audit_metadata
  before update of created_by, created_at on public.contacts
  for each row execute function
    public.reject_creation_audit_metadata_update('created_by', 'created_at');

drop trigger if exists lead_sources_protect_creation_audit_metadata
  on public.lead_sources;
create trigger lead_sources_protect_creation_audit_metadata
  before update of created_at on public.lead_sources
  for each row execute function
    public.reject_creation_audit_metadata_update('created_at');

drop trigger if exists leads_05_protect_creation_audit_metadata
  on public.leads;
create trigger leads_05_protect_creation_audit_metadata
  before update of created_by, created_at on public.leads
  for each row execute function
    public.reject_creation_audit_metadata_update('created_by', 'created_at');

drop trigger if exists lead_signals_protect_creation_audit_metadata
  on public.lead_signals;
create trigger lead_signals_protect_creation_audit_metadata
  before update of created_at on public.lead_signals
  for each row execute function
    public.reject_creation_audit_metadata_update('created_at');

drop trigger if exists lead_activities_05_protect_creation_audit_metadata
  on public.lead_activities;
create trigger lead_activities_05_protect_creation_audit_metadata
  before update of created_by, created_at on public.lead_activities
  for each row execute function
    public.reject_creation_audit_metadata_update('created_by', 'created_at');

drop trigger if exists opportunities_20_protect_creation_audit_metadata
  on public.opportunities;
create trigger opportunities_20_protect_creation_audit_metadata
  before update of created_at on public.opportunities
  for each row execute function
    public.reject_creation_audit_metadata_update('created_at');

drop trigger if exists sales_tasks_protect_creation_audit_metadata
  on public.sales_tasks;
create trigger sales_tasks_protect_creation_audit_metadata
  before update of created_at on public.sales_tasks
  for each row execute function
    public.reject_creation_audit_metadata_update('created_at');

drop trigger if exists company_mutation_confirmations_protect_creation_audit_metadata
  on public.company_mutation_confirmations;
create trigger company_mutation_confirmations_protect_creation_audit_metadata
  before update of actor_id, created_at
  on public.company_mutation_confirmations
  for each row execute function
    public.reject_creation_audit_metadata_update('actor_id', 'created_at');

comment on function public.reject_creation_audit_metadata_update() is
  'Rejects changes to trigger-declared creation provenance. There is no role bypass while the trigger is enabled.';

commit;
