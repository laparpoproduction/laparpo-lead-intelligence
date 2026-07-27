begin;

create table public.lead_conversions (
  lead_id uuid primary key
    references public.leads(id) on delete restrict,
  opportunity_id uuid not null unique,
  converted_at timestamptz not null,
  created_by uuid not null
    references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint lead_conversions_opportunity_lead_fk
    foreign key (opportunity_id, lead_id)
    references public.opportunities(id, lead_id)
    on update restrict
    on delete restrict
);

comment on table public.lead_conversions is
  'Immutable ledger identifying the single Opportunity created by a Lead conversion. Legacy converted Leads are intentionally not guessed or backfilled.';
comment on constraint lead_conversions_opportunity_lead_fk
  on public.lead_conversions is
  'The conversion Opportunity must belong to the same Lead and cannot be deleted while the conversion exists.';

alter table public.lead_conversions enable row level security;

create policy "users read permitted lead conversions"
  on public.lead_conversions for select to authenticated
  using (public.can_access_lead(lead_id));

revoke all on table public.lead_conversions from public;
revoke insert, update, delete, truncate, references, trigger
  on table public.lead_conversions from authenticated;
grant select on table public.lead_conversions to authenticated;

create or replace function public.enforce_lead_conversion_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  conversion_record public.lead_conversions%rowtype;
begin
  if tg_op = 'INSERT' then
    if new.stage = 'converted'::public.lead_stage then
      raise exception 'Lead conversion must use the atomic conversion function'
        using errcode = '23514';
    end if;
    return new;
  end if;

  select conversion.*
  into conversion_record
  from public.lead_conversions as conversion
  where conversion.lead_id = new.id;

  if new.stage = 'converted'::public.lead_stage then
    if conversion_record.lead_id is null then
      -- Converted rows that existed before this migration remain valid until
      -- reconciled, but no new conversion may bypass the atomic ledger RPC.
      if old.stage is distinct from 'converted'::public.lead_stage then
        raise exception 'Lead conversion must use the atomic conversion function'
          using errcode = '23514';
      end if;
    elsif new.lead_status <> 'closed'::public.lead_operational_status
      or new.converted_at is distinct from conversion_record.converted_at
    then
      raise exception 'Lead conversion state does not match its conversion ledger'
        using errcode = '23514';
    end if;
  elsif conversion_record.lead_id is not null then
    raise exception 'A converted Lead with a conversion ledger cannot leave the converted stage'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger leads_enforce_conversion_insert
before insert on public.leads
for each row execute function public.enforce_lead_conversion_integrity();

create trigger leads_enforce_conversion_integrity
before update of stage, lead_status, converted_at on public.leads
for each row execute function public.enforce_lead_conversion_integrity();

create or replace function public.convert_lead_to_opportunity(
  target_lead_id uuid,
  target_service public.service_type default null,
  target_estimated_value_myr numeric default null
)
returns table (
  lead_id uuid,
  opportunity_id uuid,
  conversion_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  lead_record public.leads%rowtype;
  conversion_record public.lead_conversions%rowtype;
  resolved_service public.service_type;
  resolved_estimated_value_myr numeric(12, 2);
  conversion_time timestamptz;
  created_opportunity_id uuid;
begin
  if actor_id is null or not public.is_active_user() then
    raise exception 'Active authentication is required'
      using errcode = '42501', detail = 'inactive_or_unauthenticated';
  end if;

  if target_lead_id is null then
    raise exception 'A valid Lead ID is required'
      using errcode = '22023', detail = 'invalid_lead_id';
  end if;

  select lead.*
  into lead_record
  from public.leads as lead
  where lead.id = target_lead_id
    and lead.deleted_at is null
  for update;

  if lead_record.id is null then
    raise exception 'Lead not found'
      using errcode = 'P0002', detail = 'lead_not_found';
  end if;

  if not public.can_modify_lead(lead_record.id) then
    raise exception 'Lead modification permission is required'
      using errcode = '42501', detail = 'lead_not_modifiable';
  end if;

  select conversion.*
  into conversion_record
  from public.lead_conversions as conversion
  where conversion.lead_id = lead_record.id;

  if lead_record.stage = 'converted'::public.lead_stage then
    if conversion_record.lead_id is null then
      raise exception 'Legacy converted Lead requires explicit reconciliation'
        using errcode = '23514', detail = 'legacy_conversion_unresolved';
    end if;

    return query
    select
      conversion_record.lead_id,
      conversion_record.opportunity_id,
      'already_converted'::text;
    return;
  end if;

  if conversion_record.lead_id is not null then
    raise exception 'Lead conversion ledger conflicts with Lead state'
      using errcode = '23514', detail = 'conversion_state_conflict';
  end if;

  if lead_record.stage in (
    'lost'::public.lead_stage,
    'disqualified'::public.lead_stage
  ) then
    raise exception 'Terminal Lead cannot be converted'
      using errcode = '23514', detail = 'lead_terminal';
  end if;

  resolved_service := coalesce(
    target_service,
    case lead_record.service_interest
      when 'food_review' then 'food_review'::public.service_type
      when 'hard_selling_video' then 'hard_selling'::public.service_type
      when 'corporate_video' then 'corporate'::public.service_type
      when 'storyline_celebrity' then 'storyline_celebrity'::public.service_type
      when 'social_media_campaign' then 'social_media_campaign'::public.service_type
      when 'event_coverage' then 'event_coverage'::public.service_type
      when 'other' then 'other'::public.service_type
      else null
    end
  );

  if resolved_service is null then
    raise exception 'Lead service cannot be mapped to an Opportunity service'
      using errcode = '22023', detail = 'unsupported_service';
  end if;

  if target_estimated_value_myr is not null then
    if target_estimated_value_myr::text in ('NaN', 'Infinity', '-Infinity')
      or target_estimated_value_myr < 0
      or target_estimated_value_myr > 9999999999.99
    then
      raise exception 'Estimated MYR value is invalid'
        using errcode = '22003', detail = 'invalid_estimated_value_myr';
    end if;
    resolved_estimated_value_myr := target_estimated_value_myr;
  elsif lead_record.currency = 'MYR' then
    resolved_estimated_value_myr := lead_record.estimated_value;
  else
    resolved_estimated_value_myr := null;
  end if;

  conversion_time := statement_timestamp();

  insert into public.opportunities (
    lead_id,
    service,
    estimated_value_myr
  ) values (
    lead_record.id,
    resolved_service,
    resolved_estimated_value_myr
  )
  returning id into created_opportunity_id;

  insert into public.lead_conversions (
    lead_id,
    opportunity_id,
    converted_at,
    created_by
  ) values (
    lead_record.id,
    created_opportunity_id,
    conversion_time,
    actor_id
  );

  update public.leads
  set
    stage = 'converted'::public.lead_stage,
    lead_status = 'closed'::public.lead_operational_status,
    converted_at = conversion_time
  where id = lead_record.id;

  return query
  select
    lead_record.id,
    created_opportunity_id,
    'converted'::text;
end;
$$;

revoke all on function public.enforce_lead_conversion_integrity() from public;
revoke all on function public.convert_lead_to_opportunity(
  uuid,
  public.service_type,
  numeric
) from public;
grant execute on function public.convert_lead_to_opportunity(
  uuid,
  public.service_type,
  numeric
) to authenticated;

comment on function public.convert_lead_to_opportunity(
  uuid,
  public.service_type,
  numeric
) is
  'Atomically locks and converts a modifiable active Lead, creates one Opportunity, and records an immutable retry-safe conversion ledger.';

commit;
