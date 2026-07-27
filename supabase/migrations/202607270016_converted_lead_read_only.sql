begin;

-- A ledger-backed converted Lead is a historical source record. Opportunity
-- authorization must continue to use can_modify_lead(), so this invariant is
-- enforced narrowly at the Lead row boundary instead of changing that helper.
create or replace function public.enforce_converted_lead_read_only()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  conversion_record public.lead_conversions%rowtype;
begin
  select conversion.*
  into conversion_record
  from public.lead_conversions as conversion
  where conversion.lead_id = old.id;

  if conversion_record.lead_id is null then
    return new;
  end if;

  -- The atomic conversion RPC creates the ledger immediately before its one
  -- Lead transition. Preserve that exact transition and no other mutation.
  -- fingerprint is a generated column and appears unset in NEW during BEFORE
  -- triggers; PostgreSQL recomputes it after these checks.
  if old.stage is distinct from 'converted'::public.lead_stage then
    if new.stage = 'converted'::public.lead_stage
      and new.lead_status = 'closed'::public.lead_operational_status
      and new.converted_at is not distinct from conversion_record.converted_at
      and (
        to_jsonb(new)
          - 'stage'
          - 'lead_status'
          - 'converted_at'
          - 'updated_at'
          - 'fingerprint'
      ) is not distinct from (
        to_jsonb(old)
          - 'stage'
          - 'lead_status'
          - 'converted_at'
          - 'updated_at'
          - 'fingerprint'
      )
    then
      return new;
    end if;

    raise exception 'Atomic Lead conversion may only change conversion state'
      using errcode = '23514', detail = 'converted_lead_read_only';
  end if;

  -- Management archive/restore remains valid. updated_at is maintained by the
  -- existing timestamp trigger and fingerprint is generated; every other
  -- historical Lead field is frozen.
  if (
    to_jsonb(new) - 'deleted_at' - 'updated_at' - 'fingerprint'
  ) is distinct from (
    to_jsonb(old) - 'deleted_at' - 'updated_at' - 'fingerprint'
  ) then
    raise exception 'Converted Lead sales data is read-only'
      using errcode = '23514', detail = 'converted_lead_read_only';
  end if;

  return new;
end;
$$;

create trigger leads_enforce_converted_read_only
before update on public.leads
for each row execute function public.enforce_converted_lead_read_only();

revoke all on function public.enforce_converted_lead_read_only() from public;

comment on function public.enforce_converted_lead_read_only() is
  'Freezes ordinary Lead fields after ledger-backed conversion while preserving the atomic transition and management archive/restore.';

commit;
