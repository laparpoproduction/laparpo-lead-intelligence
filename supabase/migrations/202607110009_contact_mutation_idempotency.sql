begin;

create table public.contact_mutation_confirmations (
  confirmation_id uuid primary key,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  operation text not null,
  contact_id uuid references public.contacts(id) on delete restrict,
  submission_hash text not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint contact_mutation_confirmations_operation_check
    check (operation in ('create', 'update')),
  constraint contact_mutation_confirmations_hash_check
    check (submission_hash ~ '^[a-f0-9]{64}$'),
  constraint contact_mutation_confirmations_state_check check (
    (
      operation = 'create'
      and (
        (contact_id is null and consumed_at is null)
        or (contact_id is not null and consumed_at is not null)
      )
    )
    or (
      operation = 'update'
      and contact_id is not null
    )
  )
);

create index contact_mutation_confirmations_actor_created_idx
  on public.contact_mutation_confirmations (actor_id, created_at desc);

alter table public.contact_mutation_confirmations enable row level security;

create policy "users read own contact confirmations"
  on public.contact_mutation_confirmations for select to authenticated
  using (public.is_active_user() and actor_id = (select auth.uid()));

create or replace function public.protect_contact_confirmation_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.confirmation_id is distinct from old.confirmation_id
    or new.actor_id is distinct from old.actor_id
    or new.operation is distinct from old.operation
    or new.submission_hash is distinct from old.submission_hash
    or new.created_at is distinct from old.created_at then
    raise exception 'Contact confirmation binding cannot be changed'
      using errcode = '42501';
  end if;

  if old.consumed_at is not null or new.consumed_at is null then
    raise exception 'Contact confirmation state transition is invalid'
      using errcode = '42501';
  end if;

  if old.operation = 'update' and new.contact_id is distinct from old.contact_id then
    raise exception 'Update confirmation contact cannot be changed'
      using errcode = '42501';
  end if;

  if old.operation = 'create' and (old.contact_id is not null or new.contact_id is null) then
    raise exception 'Create confirmation result is invalid'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger contact_mutation_confirmations_protect_fields
  before update on public.contact_mutation_confirmations
  for each row execute function public.protect_contact_confirmation_fields();

revoke all on public.contact_mutation_confirmations from public;
revoke insert, update, delete, truncate, references, trigger
  on public.contact_mutation_confirmations from authenticated;
grant select on public.contact_mutation_confirmations to authenticated;

-- The public mutation functions below remain SECURITY INVOKER so Contacts RLS
-- is the final authorization boundary. These trigger helpers own only the
-- ledger claim/finalization steps. Trigger invocation does not require clients
-- to have EXECUTE permission on the helpers.
create or replace function public.claim_contact_mutation_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  confirmation_text text := nullif(
    current_setting('laparpo.contact_confirmation_id', true),
    ''
  );
  confirmation_actor uuid := auth.uid();
  confirmation_id_value uuid;
  confirmation_operation text := nullif(
    current_setting('laparpo.contact_confirmation_operation', true),
    ''
  );
  confirmation_hash text := nullif(
    current_setting('laparpo.contact_confirmation_hash', true),
    ''
  );
  expected_operation text;
  existing_confirmation public.contact_mutation_confirmations%rowtype;
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
    raise exception 'Contact confirmation binding is invalid'
      using errcode = '22023';
  end if;

  begin
    insert into public.contact_mutation_confirmations (
      confirmation_id,
      actor_id,
      operation,
      contact_id,
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
      from public.contact_mutation_confirmations
      where confirmation_id = confirmation_id_value;

      if not found
        or existing_confirmation.actor_id <> confirmation_actor
        or existing_confirmation.operation <> confirmation_operation
        or existing_confirmation.submission_hash <> confirmation_hash
        or existing_confirmation.contact_id is null
        or existing_confirmation.consumed_at is null
        or (
          confirmation_operation = 'update'
          and existing_confirmation.contact_id <> new.id
        ) then
        raise exception 'Confirmation is invalid or currently being consumed'
          using errcode = '22023';
      end if;

      return null;
  end;

  return new;
end;
$$;

create or replace function public.finalize_contact_mutation_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  confirmation_text text := nullif(
    current_setting('laparpo.contact_confirmation_id', true),
    ''
  );
  confirmation_id_value uuid;
  confirmation_actor uuid := auth.uid();
  confirmation_operation text := nullif(
    current_setting('laparpo.contact_confirmation_operation', true),
    ''
  );
  confirmation_hash text := nullif(
    current_setting('laparpo.contact_confirmation_hash', true),
    ''
  );
  affected_rows integer;
begin
  if confirmation_text is null then
    return new;
  end if;

  confirmation_id_value := confirmation_text::uuid;

  update public.contact_mutation_confirmations
  set contact_id = new.id,
      consumed_at = clock_timestamp()
  where confirmation_id = confirmation_id_value
    and actor_id = confirmation_actor
    and operation = confirmation_operation
    and submission_hash = confirmation_hash
    and (contact_id is null or contact_id = new.id)
    and consumed_at is null;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Contact confirmation could not be finalized'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger contacts_00_claim_mutation_confirmation
  before insert or update on public.contacts
  for each row execute function public.claim_contact_mutation_confirmation();

create trigger contacts_zz_finalize_mutation_confirmation
  after insert or update on public.contacts
  for each row execute function public.finalize_contact_mutation_confirmation();

revoke all on function public.protect_contact_confirmation_fields() from public;
revoke all on function public.protect_contact_confirmation_fields() from authenticated;
revoke all on function public.claim_contact_mutation_confirmation() from public;
revoke all on function public.claim_contact_mutation_confirmation() from authenticated;
revoke all on function public.finalize_contact_mutation_confirmation() from public;
revoke all on function public.finalize_contact_mutation_confirmation() from authenticated;

create or replace function public.create_confirmed_duplicate_contact(
  target_confirmation_id uuid,
  target_submission_hash text,
  contact_data jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_confirmation public.contact_mutation_confirmations%rowtype;
  new_contact_id uuid := gen_random_uuid();
  affected_rows integer;
begin
  if not public.is_active_user() then
    raise exception 'Active authentication is required' using errcode = '42501';
  end if;
  if target_submission_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid submission hash' using errcode = '22023';
  end if;

  perform set_config(
    'laparpo.contact_confirmation_id',
    target_confirmation_id::text,
    true
  );
  perform set_config('laparpo.contact_confirmation_operation', 'create', true);
  perform set_config(
    'laparpo.contact_confirmation_hash',
    target_submission_hash,
    true
  );

  insert into public.contacts (
    id, company_id, full_name, first_name, last_name, job_title, department,
    seniority, work_email, personal_email, public_phone, mobile_phone,
    whatsapp_phone, linkedin_url, facebook_url, instagram_url, source_url,
    source_type, discovered_at, last_verified_at, is_primary_contact,
    contact_status, notes, created_by, assigned_to
  ) values (
    new_contact_id,
    (contact_data ->> 'company_id')::uuid,
    contact_data ->> 'full_name',
    contact_data ->> 'first_name',
    contact_data ->> 'last_name',
    contact_data ->> 'job_title',
    contact_data ->> 'department',
    contact_data ->> 'seniority',
    contact_data ->> 'work_email',
    contact_data ->> 'personal_email',
    contact_data ->> 'public_phone',
    contact_data ->> 'mobile_phone',
    contact_data ->> 'whatsapp_phone',
    contact_data ->> 'linkedin_url',
    contact_data ->> 'facebook_url',
    contact_data ->> 'instagram_url',
    contact_data ->> 'source_url',
    contact_data ->> 'source_type',
    (contact_data ->> 'discovered_at')::timestamptz,
    (contact_data ->> 'last_verified_at')::timestamptz,
    (contact_data ->> 'is_primary_contact')::boolean,
    (contact_data ->> 'contact_status')::public.contact_status,
    contact_data ->> 'notes',
    auth.uid(),
    (contact_data ->> 'assigned_to')::uuid
  );

  get diagnostics affected_rows = row_count;
  if affected_rows = 0 then
    select * into existing_confirmation
    from public.contact_mutation_confirmations
    where confirmation_id = target_confirmation_id
      and actor_id = auth.uid()
      and operation = 'create'
      and submission_hash = target_submission_hash
      and contact_id is not null
      and consumed_at is not null;

    if not found then
      raise exception 'Confirmation is invalid or currently being consumed'
        using errcode = '22023';
    end if;

    perform set_config('laparpo.contact_confirmation_id', '', true);
    perform set_config('laparpo.contact_confirmation_operation', '', true);
    perform set_config('laparpo.contact_confirmation_hash', '', true);

    return jsonb_build_object(
      'contact_id', existing_confirmation.contact_id,
      'already_processed', true
    );
  end if;

  perform set_config('laparpo.contact_confirmation_id', '', true);
  perform set_config('laparpo.contact_confirmation_operation', '', true);
  perform set_config('laparpo.contact_confirmation_hash', '', true);

  return jsonb_build_object(
    'contact_id', new_contact_id,
    'already_processed', false
  );
end;
$$;

create or replace function public.update_confirmed_duplicate_contact(
  target_confirmation_id uuid,
  target_submission_hash text,
  target_contact_id uuid,
  contact_updates jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_confirmation public.contact_mutation_confirmations%rowtype;
  affected_rows integer;
begin
  if not public.is_active_user() then
    raise exception 'Active authentication is required' using errcode = '42501';
  end if;
  if target_submission_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid submission hash' using errcode = '22023';
  end if;

  perform set_config(
    'laparpo.contact_confirmation_id',
    target_confirmation_id::text,
    true
  );
  perform set_config('laparpo.contact_confirmation_operation', 'update', true);
  perform set_config(
    'laparpo.contact_confirmation_hash',
    target_submission_hash,
    true
  );

  update public.contacts as contact
  set
    company_id = case when contact_updates ? 'company_id'
      then (contact_updates ->> 'company_id')::uuid else contact.company_id end,
    full_name = case when contact_updates ? 'full_name'
      then contact_updates ->> 'full_name' else contact.full_name end,
    first_name = case when contact_updates ? 'first_name'
      then contact_updates ->> 'first_name' else contact.first_name end,
    last_name = case when contact_updates ? 'last_name'
      then contact_updates ->> 'last_name' else contact.last_name end,
    job_title = case when contact_updates ? 'job_title'
      then contact_updates ->> 'job_title' else contact.job_title end,
    department = case when contact_updates ? 'department'
      then contact_updates ->> 'department' else contact.department end,
    seniority = case when contact_updates ? 'seniority'
      then contact_updates ->> 'seniority' else contact.seniority end,
    work_email = case when contact_updates ? 'work_email'
      then contact_updates ->> 'work_email' else contact.work_email end,
    personal_email = case when contact_updates ? 'personal_email'
      then contact_updates ->> 'personal_email' else contact.personal_email end,
    public_phone = case when contact_updates ? 'public_phone'
      then contact_updates ->> 'public_phone' else contact.public_phone end,
    mobile_phone = case when contact_updates ? 'mobile_phone'
      then contact_updates ->> 'mobile_phone' else contact.mobile_phone end,
    whatsapp_phone = case when contact_updates ? 'whatsapp_phone'
      then contact_updates ->> 'whatsapp_phone' else contact.whatsapp_phone end,
    linkedin_url = case when contact_updates ? 'linkedin_url'
      then contact_updates ->> 'linkedin_url' else contact.linkedin_url end,
    facebook_url = case when contact_updates ? 'facebook_url'
      then contact_updates ->> 'facebook_url' else contact.facebook_url end,
    instagram_url = case when contact_updates ? 'instagram_url'
      then contact_updates ->> 'instagram_url' else contact.instagram_url end,
    source_url = case when contact_updates ? 'source_url'
      then contact_updates ->> 'source_url' else contact.source_url end,
    source_type = case when contact_updates ? 'source_type'
      then contact_updates ->> 'source_type' else contact.source_type end,
    discovered_at = case when contact_updates ? 'discovered_at'
      then (contact_updates ->> 'discovered_at')::timestamptz else contact.discovered_at end,
    last_verified_at = case when contact_updates ? 'last_verified_at'
      then (contact_updates ->> 'last_verified_at')::timestamptz else contact.last_verified_at end,
    is_primary_contact = case when contact_updates ? 'is_primary_contact'
      then (contact_updates ->> 'is_primary_contact')::boolean else contact.is_primary_contact end,
    contact_status = case when contact_updates ? 'contact_status'
      then (contact_updates ->> 'contact_status')::public.contact_status else contact.contact_status end,
    notes = case when contact_updates ? 'notes'
      then contact_updates ->> 'notes' else contact.notes end,
    assigned_to = case when contact_updates ? 'assigned_to'
      then (contact_updates ->> 'assigned_to')::uuid else contact.assigned_to end
  where contact.id = target_contact_id
    and contact.deleted_at is null;

  get diagnostics affected_rows = row_count;
  if affected_rows = 0 then
    select * into existing_confirmation
    from public.contact_mutation_confirmations
    where confirmation_id = target_confirmation_id
      and actor_id = auth.uid()
      and operation = 'update'
      and contact_id = target_contact_id
      and submission_hash = target_submission_hash
      and consumed_at is not null;

    if found then
      perform set_config('laparpo.contact_confirmation_id', '', true);
      perform set_config('laparpo.contact_confirmation_operation', '', true);
      perform set_config('laparpo.contact_confirmation_hash', '', true);

      return jsonb_build_object(
        'contact_id', existing_confirmation.contact_id,
        'already_processed', true
      );
    end if;

    raise exception 'Contact not found or update is not permitted' using errcode = 'P0002';
  end if;

  perform set_config('laparpo.contact_confirmation_id', '', true);
  perform set_config('laparpo.contact_confirmation_operation', '', true);
  perform set_config('laparpo.contact_confirmation_hash', '', true);

  return jsonb_build_object(
    'contact_id', target_contact_id,
    'already_processed', false
  );
end;
$$;

revoke all on function public.create_confirmed_duplicate_contact(uuid, text, jsonb)
  from public;
revoke all on function public.update_confirmed_duplicate_contact(uuid, text, uuid, jsonb)
  from public;
grant execute on function public.create_confirmed_duplicate_contact(uuid, text, jsonb)
  to authenticated;
grant execute on function public.update_confirmed_duplicate_contact(uuid, text, uuid, jsonb)
  to authenticated;

comment on table public.contact_mutation_confirmations is
  'Replay ledger storing only actor/operation/contact bindings and a canonical payload hash; no contact form payload is retained.';

commit;
