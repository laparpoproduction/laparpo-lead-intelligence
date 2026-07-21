begin;

create table public.lead_mutation_confirmations (
  confirmation_id uuid primary key,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  operation text not null,
  lead_id uuid references public.leads(id) on delete restrict,
  submission_hash text not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint lead_mutation_confirmations_operation_check
    check (operation in ('create', 'update')),
  constraint lead_mutation_confirmations_hash_check
    check (submission_hash ~ '^[a-f0-9]{64}$'),
  constraint lead_mutation_confirmations_state_check check (
    (
      operation = 'create'
      and (
        (lead_id is null and consumed_at is null)
        or (lead_id is not null and consumed_at is not null)
      )
    )
    or (
      operation = 'update'
      and lead_id is not null
    )
  )
);

create index lead_mutation_confirmations_actor_created_idx
  on public.lead_mutation_confirmations (actor_id, created_at desc);

alter table public.lead_mutation_confirmations enable row level security;

create policy "users read own lead confirmations"
  on public.lead_mutation_confirmations for select to authenticated
  using (public.is_active_user() and actor_id = (select auth.uid()));

revoke all on public.lead_mutation_confirmations from public;
revoke insert, update, delete, truncate, references, trigger
  on public.lead_mutation_confirmations from authenticated;
grant select on public.lead_mutation_confirmations to authenticated;

-- These trigger helpers own only ledger claim/finalization. They are SECURITY
-- DEFINER so authenticated users never receive write privileges on the ledger.
-- The public mutation RPCs remain SECURITY INVOKER, keeping Leads RLS final.
create or replace function public.claim_lead_mutation_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  confirmation_text text := nullif(
    current_setting('laparpo.lead_confirmation_id', true),
    ''
  );
  confirmation_actor uuid := auth.uid();
  confirmation_id_value uuid;
  confirmation_operation text := nullif(
    current_setting('laparpo.lead_confirmation_operation', true),
    ''
  );
  confirmation_hash text := nullif(
    current_setting('laparpo.lead_confirmation_hash', true),
    ''
  );
  expected_operation text;
  existing_confirmation public.lead_mutation_confirmations%rowtype;
begin
  if confirmation_text is null then
    return new;
  end if;

  begin
    confirmation_id_value := confirmation_text::uuid;
  exception
    when invalid_text_representation then
      raise exception 'Invalid confirmation identifier' using errcode = '22023';
  end;

  expected_operation := case TG_OP
    when 'INSERT' then 'create'
    when 'UPDATE' then 'update'
    else null
  end;

  if confirmation_actor is null
    or not public.is_active_user()
    or confirmation_operation is distinct from expected_operation
    or confirmation_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Lead confirmation binding is invalid'
      using errcode = '22023';
  end if;

  begin
    insert into public.lead_mutation_confirmations (
      confirmation_id,
      actor_id,
      operation,
      lead_id,
      submission_hash
    ) values (
      confirmation_id_value,
      confirmation_actor,
      confirmation_operation,
      case when confirmation_operation = 'update' then new.id else null end,
      confirmation_hash
    );
  exception
    when unique_violation then
      select * into existing_confirmation
      from public.lead_mutation_confirmations
      where confirmation_id = confirmation_id_value;

      if not found
        or existing_confirmation.actor_id <> confirmation_actor
        or existing_confirmation.operation <> confirmation_operation
        or existing_confirmation.submission_hash <> confirmation_hash
        or existing_confirmation.lead_id is null
        or existing_confirmation.consumed_at is null
        or (
          confirmation_operation = 'update'
          and existing_confirmation.lead_id <> new.id
        ) then
        raise exception 'Confirmation is invalid or currently being consumed'
          using errcode = '22023';
      end if;

      -- Cancelling the row mutation lets the invoker RPC return the durable
      -- result without applying create/update a second time.
      return null;
  end;

  return new;
end;
$$;

create or replace function public.finalize_lead_mutation_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  confirmation_text text := nullif(
    current_setting('laparpo.lead_confirmation_id', true),
    ''
  );
  confirmation_id_value uuid;
  confirmation_actor uuid := auth.uid();
  confirmation_operation text := nullif(
    current_setting('laparpo.lead_confirmation_operation', true),
    ''
  );
  confirmation_hash text := nullif(
    current_setting('laparpo.lead_confirmation_hash', true),
    ''
  );
  affected_rows integer;
begin
  if confirmation_text is null then
    return new;
  end if;

  confirmation_id_value := confirmation_text::uuid;

  update public.lead_mutation_confirmations
  set lead_id = new.id,
      consumed_at = clock_timestamp()
  where confirmation_id = confirmation_id_value
    and actor_id = confirmation_actor
    and operation = confirmation_operation
    and submission_hash = confirmation_hash
    and (lead_id is null or lead_id = new.id)
    and consumed_at is null;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Lead confirmation could not be finalized'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger leads_00_claim_mutation_confirmation
  before insert or update on public.leads
  for each row execute function public.claim_lead_mutation_confirmation();

create trigger leads_zz_finalize_mutation_confirmation
  after insert or update on public.leads
  for each row execute function public.finalize_lead_mutation_confirmation();

revoke all on function public.claim_lead_mutation_confirmation() from public;
revoke all on function public.claim_lead_mutation_confirmation() from authenticated;
revoke all on function public.finalize_lead_mutation_confirmation() from public;
revoke all on function public.finalize_lead_mutation_confirmation() from authenticated;

create or replace function public.create_confirmed_duplicate_lead(
  target_confirmation_id uuid,
  target_submission_hash text,
  lead_data jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_confirmation public.lead_mutation_confirmations%rowtype;
  new_lead_id uuid := gen_random_uuid();
  affected_rows integer;
begin
  if not public.is_active_user() then
    raise exception 'Active authentication is required' using errcode = '42501';
  end if;
  if target_submission_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid submission hash' using errcode = '22023';
  end if;

  perform set_config('laparpo.lead_confirmation_id', target_confirmation_id::text, true);
  perform set_config('laparpo.lead_confirmation_operation', 'create', true);
  perform set_config('laparpo.lead_confirmation_hash', target_submission_hash, true);

  insert into public.leads (
    id, company_id, primary_contact_id, title, stage, lead_status,
    qualification_status, priority, lead_score, estimated_value, currency,
    service_interest, assigned_to, created_by, source_type, source_url,
    source_signal_id, source_campaign, referral_name, discovered_at,
    last_verified_at, business_need, budget_notes, timeline_notes,
    decision_maker_notes, expected_close_date, next_step, next_follow_up_at,
    last_contacted_at, notes, converted_at, lost_at, lost_reason,
    disqualified_at, disqualified_reason
  ) values (
    new_lead_id,
    (lead_data ->> 'company_id')::uuid,
    (lead_data ->> 'primary_contact_id')::uuid,
    lead_data ->> 'title',
    (lead_data ->> 'stage')::public.lead_stage,
    (lead_data ->> 'lead_status')::public.lead_operational_status,
    (lead_data ->> 'qualification_status')::public.lead_qualification_status,
    (lead_data ->> 'priority')::public.lead_priority,
    (lead_data ->> 'lead_score')::integer,
    (lead_data ->> 'estimated_value')::numeric,
    lead_data ->> 'currency',
    lead_data ->> 'service_interest',
    (lead_data ->> 'assigned_to')::uuid,
    auth.uid(),
    lead_data ->> 'source_type',
    lead_data ->> 'source_url',
    (lead_data ->> 'source_signal_id')::uuid,
    lead_data ->> 'source_campaign',
    lead_data ->> 'referral_name',
    (lead_data ->> 'discovered_at')::timestamptz,
    (lead_data ->> 'last_verified_at')::timestamptz,
    lead_data ->> 'business_need',
    lead_data ->> 'budget_notes',
    lead_data ->> 'timeline_notes',
    lead_data ->> 'decision_maker_notes',
    (lead_data ->> 'expected_close_date')::date,
    lead_data ->> 'next_step',
    (lead_data ->> 'next_follow_up_at')::timestamptz,
    (lead_data ->> 'last_contacted_at')::timestamptz,
    lead_data ->> 'notes',
    (lead_data ->> 'converted_at')::timestamptz,
    (lead_data ->> 'lost_at')::timestamptz,
    lead_data ->> 'lost_reason',
    (lead_data ->> 'disqualified_at')::timestamptz,
    lead_data ->> 'disqualified_reason'
  );

  get diagnostics affected_rows = row_count;
  if affected_rows = 0 then
    select * into existing_confirmation
    from public.lead_mutation_confirmations
    where confirmation_id = target_confirmation_id
      and actor_id = auth.uid()
      and operation = 'create'
      and submission_hash = target_submission_hash
      and lead_id is not null
      and consumed_at is not null;

    if not found then
      raise exception 'Confirmation is invalid or currently being consumed'
        using errcode = '22023';
    end if;

    perform set_config('laparpo.lead_confirmation_id', '', true);
    perform set_config('laparpo.lead_confirmation_operation', '', true);
    perform set_config('laparpo.lead_confirmation_hash', '', true);
    return jsonb_build_object(
      'lead_id', existing_confirmation.lead_id,
      'already_processed', true
    );
  end if;

  perform set_config('laparpo.lead_confirmation_id', '', true);
  perform set_config('laparpo.lead_confirmation_operation', '', true);
  perform set_config('laparpo.lead_confirmation_hash', '', true);
  return jsonb_build_object('lead_id', new_lead_id, 'already_processed', false);
end;
$$;

create or replace function public.update_confirmed_duplicate_lead(
  target_confirmation_id uuid,
  target_submission_hash text,
  target_lead_id uuid,
  lead_updates jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_confirmation public.lead_mutation_confirmations%rowtype;
  affected_rows integer;
begin
  if not public.is_active_user() then
    raise exception 'Active authentication is required' using errcode = '42501';
  end if;
  if target_submission_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid submission hash' using errcode = '22023';
  end if;

  perform set_config('laparpo.lead_confirmation_id', target_confirmation_id::text, true);
  perform set_config('laparpo.lead_confirmation_operation', 'update', true);
  perform set_config('laparpo.lead_confirmation_hash', target_submission_hash, true);

  update public.leads as lead
  set
    company_id = case when lead_updates ? 'company_id'
      then (lead_updates ->> 'company_id')::uuid else lead.company_id end,
    primary_contact_id = case when lead_updates ? 'primary_contact_id'
      then (lead_updates ->> 'primary_contact_id')::uuid else lead.primary_contact_id end,
    title = case when lead_updates ? 'title'
      then lead_updates ->> 'title' else lead.title end,
    stage = case when lead_updates ? 'stage'
      then (lead_updates ->> 'stage')::public.lead_stage else lead.stage end,
    lead_status = case when lead_updates ? 'lead_status'
      then (lead_updates ->> 'lead_status')::public.lead_operational_status else lead.lead_status end,
    qualification_status = case when lead_updates ? 'qualification_status'
      then (lead_updates ->> 'qualification_status')::public.lead_qualification_status else lead.qualification_status end,
    priority = case when lead_updates ? 'priority'
      then (lead_updates ->> 'priority')::public.lead_priority else lead.priority end,
    lead_score = case when lead_updates ? 'lead_score'
      then (lead_updates ->> 'lead_score')::integer else lead.lead_score end,
    estimated_value = case when lead_updates ? 'estimated_value'
      then (lead_updates ->> 'estimated_value')::numeric else lead.estimated_value end,
    currency = case when lead_updates ? 'currency'
      then lead_updates ->> 'currency' else lead.currency end,
    service_interest = case when lead_updates ? 'service_interest'
      then lead_updates ->> 'service_interest' else lead.service_interest end,
    assigned_to = case when lead_updates ? 'assigned_to'
      then (lead_updates ->> 'assigned_to')::uuid else lead.assigned_to end,
    source_type = case when lead_updates ? 'source_type'
      then lead_updates ->> 'source_type' else lead.source_type end,
    source_url = case when lead_updates ? 'source_url'
      then lead_updates ->> 'source_url' else lead.source_url end,
    source_signal_id = case when lead_updates ? 'source_signal_id'
      then (lead_updates ->> 'source_signal_id')::uuid else lead.source_signal_id end,
    source_campaign = case when lead_updates ? 'source_campaign'
      then lead_updates ->> 'source_campaign' else lead.source_campaign end,
    referral_name = case when lead_updates ? 'referral_name'
      then lead_updates ->> 'referral_name' else lead.referral_name end,
    discovered_at = case when lead_updates ? 'discovered_at'
      then (lead_updates ->> 'discovered_at')::timestamptz else lead.discovered_at end,
    last_verified_at = case when lead_updates ? 'last_verified_at'
      then (lead_updates ->> 'last_verified_at')::timestamptz else lead.last_verified_at end,
    business_need = case when lead_updates ? 'business_need'
      then lead_updates ->> 'business_need' else lead.business_need end,
    budget_notes = case when lead_updates ? 'budget_notes'
      then lead_updates ->> 'budget_notes' else lead.budget_notes end,
    timeline_notes = case when lead_updates ? 'timeline_notes'
      then lead_updates ->> 'timeline_notes' else lead.timeline_notes end,
    decision_maker_notes = case when lead_updates ? 'decision_maker_notes'
      then lead_updates ->> 'decision_maker_notes' else lead.decision_maker_notes end,
    expected_close_date = case when lead_updates ? 'expected_close_date'
      then (lead_updates ->> 'expected_close_date')::date else lead.expected_close_date end,
    next_step = case when lead_updates ? 'next_step'
      then lead_updates ->> 'next_step' else lead.next_step end,
    next_follow_up_at = case when lead_updates ? 'next_follow_up_at'
      then (lead_updates ->> 'next_follow_up_at')::timestamptz else lead.next_follow_up_at end,
    last_contacted_at = case when lead_updates ? 'last_contacted_at'
      then (lead_updates ->> 'last_contacted_at')::timestamptz else lead.last_contacted_at end,
    notes = case when lead_updates ? 'notes'
      then lead_updates ->> 'notes' else lead.notes end,
    converted_at = case when lead_updates ? 'converted_at'
      then (lead_updates ->> 'converted_at')::timestamptz else lead.converted_at end,
    lost_at = case when lead_updates ? 'lost_at'
      then (lead_updates ->> 'lost_at')::timestamptz else lead.lost_at end,
    lost_reason = case when lead_updates ? 'lost_reason'
      then lead_updates ->> 'lost_reason' else lead.lost_reason end,
    disqualified_at = case when lead_updates ? 'disqualified_at'
      then (lead_updates ->> 'disqualified_at')::timestamptz else lead.disqualified_at end,
    disqualified_reason = case when lead_updates ? 'disqualified_reason'
      then lead_updates ->> 'disqualified_reason' else lead.disqualified_reason end
  where lead.id = target_lead_id
    and lead.deleted_at is null;

  get diagnostics affected_rows = row_count;
  if affected_rows = 0 then
    select * into existing_confirmation
    from public.lead_mutation_confirmations
    where confirmation_id = target_confirmation_id
      and actor_id = auth.uid()
      and operation = 'update'
      and lead_id = target_lead_id
      and submission_hash = target_submission_hash
      and consumed_at is not null;

    if found then
      perform set_config('laparpo.lead_confirmation_id', '', true);
      perform set_config('laparpo.lead_confirmation_operation', '', true);
      perform set_config('laparpo.lead_confirmation_hash', '', true);
      return jsonb_build_object(
        'lead_id', existing_confirmation.lead_id,
        'already_processed', true
      );
    end if;

    raise exception 'Lead not found or update is not permitted' using errcode = 'P0002';
  end if;

  perform set_config('laparpo.lead_confirmation_id', '', true);
  perform set_config('laparpo.lead_confirmation_operation', '', true);
  perform set_config('laparpo.lead_confirmation_hash', '', true);
  return jsonb_build_object('lead_id', target_lead_id, 'already_processed', false);
end;
$$;

revoke all on function public.create_confirmed_duplicate_lead(uuid, text, jsonb)
  from public;
revoke all on function public.update_confirmed_duplicate_lead(uuid, text, uuid, jsonb)
  from public;
grant execute on function public.create_confirmed_duplicate_lead(uuid, text, jsonb)
  to authenticated;
grant execute on function public.update_confirmed_duplicate_lead(uuid, text, uuid, jsonb)
  to authenticated;

comment on table public.lead_mutation_confirmations is
  'Replay ledger storing actor/operation/Lead bindings and a canonical payload hash; no Lead form payload is retained.';

commit;
