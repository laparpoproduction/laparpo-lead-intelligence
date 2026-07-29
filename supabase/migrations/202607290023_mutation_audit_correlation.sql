begin;

create schema mutation_audit_private;

revoke all on schema mutation_audit_private
  from public, anon, authenticated, service_role;

-- This single-purpose store is populated only through a separately approved,
-- privileged deployment procedure after this migration has been applied.
-- Application roles cannot use the schema or relation directly.
create table mutation_audit_private.mutation_correlation_secret (
  singleton boolean primary key default true
    check (singleton),
  secret text not null
);

revoke all on table
  mutation_audit_private.mutation_correlation_secret
from public, anon, authenticated, service_role;

create table public.mutation_audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default clock_timestamp(),
  request_id uuid,
  actor_id uuid,
  actor_role public.app_role,
  resource_type text not null
    check (resource_type in (
      'profile',
      'company',
      'contact',
      'lead',
      'lead_activity',
      'lead_conversion',
      'opportunity'
    )),
  resource_id uuid not null,
  operation text not null
    check (operation ~ '^[a-z][a-z0-9_]{0,63}$'),
  application_operation text
    check (
      application_operation is null
      or application_operation in (
        'create_company',
        'update_company',
        'archive_company',
        'create_contact',
        'update_contact',
        'archive_contact',
        'create_lead',
        'update_lead',
        'archive_lead',
        'restore_lead',
        'create_lead_activity',
        'update_lead_activity',
        'archive_lead_activity',
        'restore_lead_activity',
        'convert_lead',
        'change_opportunity_stage',
        'assign_opportunity_owner',
        'set_opportunity_expected_close',
        'override_opportunity_probability',
        'clear_opportunity_probability',
        'mark_opportunity_won',
        'mark_opportunity_lost'
      )
    ),
  outcome text not null default 'succeeded'
    check (outcome = 'succeeded'),
  source text not null
    check (source in ('application', 'database')),
  changed_fields text[] not null,
  resource_version_before timestamptz,
  resource_version_after timestamptz,
  constraint mutation_audit_events_application_context_check check (
    (
      source = 'application'
      and request_id is not null
      and application_operation is not null
    )
    or (
      source = 'database'
      and request_id is null
      and application_operation is null
    )
  ),
  constraint mutation_audit_events_changed_fields_check check (
    array_position(changed_fields, null) is null
  )
);

comment on table public.mutation_audit_events is
  'Append-only, database-authoritative evidence for successful persisted CRM mutations. It stores changed field names, never before/after values. Events are atomic with the business transaction, so failed transactions retain no database event. Historical events are intentionally not backfilled.';
comment on column public.mutation_audit_events.request_id is
  'Server-generated application correlation UUID only when the signed, short-lived PostgREST request context verifies. Direct database mutations remain audited with NULL correlation.';
comment on column public.mutation_audit_events.source is
  'application means the server-only HMAC context verified; database means no application correlation context was supplied.';
comment on column public.mutation_audit_events.changed_fields is
  'Sorted names of fields actually inserted, changed, or removed. Field values are deliberately excluded.';

alter table public.mutation_audit_events enable row level security;

revoke all on table public.mutation_audit_events
  from public, anon, authenticated, service_role;

create index mutation_audit_events_occurred_at_idx
  on public.mutation_audit_events (occurred_at desc, id);
create index mutation_audit_events_request_id_idx
  on public.mutation_audit_events (request_id, occurred_at, id)
  where request_id is not null;
create index mutation_audit_events_actor_occurred_idx
  on public.mutation_audit_events (actor_id, occurred_at desc, id)
  where actor_id is not null;
create index mutation_audit_events_resource_occurred_idx
  on public.mutation_audit_events (
    resource_type,
    resource_id,
    occurred_at desc,
    id
  );

-- pgcrypto is created by migration 001. Supabase may install it in the trusted
-- `extensions` schema while disposable PostgreSQL installs it in `public`.
-- Resolve that catalog-owned namespace once and create a fixed, schema-
-- qualified wrapper; request-time code never uses dynamic SQL.
do $$
declare
  pgcrypto_schema text;
begin
  select namespace.nspname
  into pgcrypto_schema
  from pg_catalog.pg_extension as extension
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = extension.extnamespace
  where extension.extname = 'pgcrypto';

  if pgcrypto_schema is null then
    raise exception 'pgcrypto extension is required for mutation correlation';
  end if;

  execute pg_catalog.format(
    $definition$
      create or replace function mutation_audit_private.mutation_audit_hmac(
        payload text,
        secret text
      )
      returns bytea
      language sql
      immutable
      strict
      security invoker
      set search_path = ''
      as $function$
        select %I.hmac(payload, secret, 'sha256')
      $function$
    $definition$,
    pgcrypto_schema
  );
end;
$$;

revoke all on function
  mutation_audit_private.mutation_audit_hmac(text, text)
  from public, anon, authenticated, service_role;

create or replace function mutation_audit_private.fixed_length_mac_equal(
  provided_mac bytea,
  expected_mac bytea
)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  byte_index integer;
  aggregate_difference integer := 0;
begin
  -- Length is public wire-format metadata. For valid inputs, every one of the
  -- 32 bytes is compared and no mismatch can end the loop early.
  if pg_catalog.octet_length(provided_mac) <> 32
    or pg_catalog.octet_length(expected_mac) <> 32
  then
    return false;
  end if;

  for byte_index in 0..31 loop
    aggregate_difference := aggregate_difference | (
      pg_catalog.get_byte(provided_mac, byte_index)
      # pg_catalog.get_byte(expected_mac, byte_index)
    );
  end loop;

  return aggregate_difference = 0;
end;
$$;

revoke all on function
  mutation_audit_private.fixed_length_mac_equal(bytea, bytea)
from public, anon, authenticated, service_role;

create or replace function public.verified_mutation_request_context()
returns table (
  request_id uuid,
  application_operation text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_headers text;
  request_headers jsonb;
  request_id_text text;
  operation_text text;
  issued_at_text text;
  signature_text text;
  correlation_secret text;
  correlation_secret_rows bigint;
  issued_at_epoch bigint;
  provided_mac bytea;
  expected_mac bytea;
  has_correlation_header boolean;
begin
  raw_headers := nullif(pg_catalog.current_setting('request.headers', true), '');
  if raw_headers is null then
    return query select null::uuid, null::text;
    return;
  end if;

  request_headers := raw_headers::jsonb;
  request_id_text := request_headers ->> 'x-laparpo-request-id';
  operation_text := request_headers ->> 'x-laparpo-request-operation';
  issued_at_text := request_headers ->> 'x-laparpo-request-issued-at';
  signature_text := request_headers ->> 'x-laparpo-request-signature';
  has_correlation_header :=
    request_id_text is not null
    or operation_text is not null
    or issued_at_text is not null
    or signature_text is not null;

  if not has_correlation_header then
    return query select null::uuid, null::text;
    return;
  end if;

  select count(*), min(secret)
  into correlation_secret_rows, correlation_secret
  from mutation_audit_private.mutation_correlation_secret;

  if correlation_secret_rows <> 1
    or correlation_secret is null
    or pg_catalog.btrim(correlation_secret) = ''
    or pg_catalog.length(correlation_secret) < 32
    or request_id_text is null
    or operation_text is null
    or issued_at_text is null
    or signature_text is null
    or operation_text not in (
      'create_company',
      'update_company',
      'archive_company',
      'create_contact',
      'update_contact',
      'archive_contact',
      'create_lead',
      'update_lead',
      'archive_lead',
      'restore_lead',
      'create_lead_activity',
      'update_lead_activity',
      'archive_lead_activity',
      'restore_lead_activity',
      'convert_lead',
      'change_opportunity_stage',
      'assign_opportunity_owner',
      'set_opportunity_expected_close',
      'override_opportunity_probability',
      'clear_opportunity_probability',
      'mark_opportunity_won',
      'mark_opportunity_lost'
    )
    or issued_at_text !~ '^[0-9]{10}$'
    or signature_text !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Invalid mutation audit correlation context'
      using errcode = '22023';
  end if;

  begin
    request_id := request_id_text::uuid;
    issued_at_epoch := issued_at_text::bigint;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Invalid mutation audit correlation context'
        using errcode = '22023';
  end;

  if pg_catalog.abs(
    extract(epoch from pg_catalog.clock_timestamp())::bigint
      - issued_at_epoch
  ) > 300
  then
    raise exception 'Expired mutation audit correlation context'
      using errcode = '22023';
  end if;

  provided_mac := pg_catalog.decode(signature_text, 'hex');
  expected_mac := mutation_audit_private.mutation_audit_hmac(
    request_id_text || ':' || issued_at_text || ':' || operation_text,
    correlation_secret
  );

  if not mutation_audit_private.fixed_length_mac_equal(
    provided_mac,
    expected_mac
  ) then
    raise exception 'Invalid mutation audit correlation context'
      using errcode = '22023';
  end if;

  application_operation := operation_text;
  return next;
end;
$$;

revoke all on function public.verified_mutation_request_context()
  from public, anon, authenticated, service_role;

create or replace function public.record_mutation_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_record jsonb;
  new_record jsonb;
  effective_record jsonb;
  changed_field_names text[];
  authenticated_actor_id uuid := auth.uid();
  authenticated_actor_role public.app_role;
  verified_request_id uuid;
  verified_application_operation text;
  actual_operation text;
  before_version timestamptz;
  after_version timestamptz;
begin
  old_record := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  new_record := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  effective_record := coalesce(new_record, old_record);

  select coalesce(
    pg_catalog.array_agg(field_name order by field_name),
    array[]::text[]
  )
  into changed_field_names
  from (
    select field_name
    from pg_catalog.jsonb_object_keys(
      coalesce(old_record, '{}'::jsonb)
      || coalesce(new_record, '{}'::jsonb)
    ) as fields(field_name)
    where case tg_op
      when 'INSERT' then new_record -> field_name <> 'null'::jsonb
      when 'DELETE' then old_record -> field_name <> 'null'::jsonb
      else (old_record -> field_name) is distinct from (new_record -> field_name)
    end
  ) as actual_changes;

  before_version := coalesce(
    nullif(old_record ->> 'updated_at', '')::timestamptz,
    nullif(old_record ->> 'created_at', '')::timestamptz,
    nullif(old_record ->> 'converted_at', '')::timestamptz
  );
  after_version := coalesce(
    nullif(new_record ->> 'updated_at', '')::timestamptz,
    nullif(new_record ->> 'created_at', '')::timestamptz,
    nullif(new_record ->> 'converted_at', '')::timestamptz
  );

  actual_operation := case
    when tg_op = 'INSERT' and tg_argv[0] = 'lead_conversion' then 'convert'
    when tg_op = 'INSERT' then 'create'
    when tg_op = 'DELETE' then 'delete'
    when old_record -> 'deleted_at' = 'null'::jsonb
      and new_record -> 'deleted_at' <> 'null'::jsonb
      then 'archive'
    when old_record -> 'deleted_at' <> 'null'::jsonb
      and new_record -> 'deleted_at' = 'null'::jsonb
      then 'restore'
    when tg_argv[0] = 'lead'
      and old_record ->> 'stage' is distinct from new_record ->> 'stage'
      and new_record ->> 'stage' = 'converted'
      then 'convert'
    when tg_argv[0] = 'opportunity'
      and old_record -> 'won_at' = 'null'::jsonb
      and new_record -> 'won_at' <> 'null'::jsonb
      then 'mark_won'
    when tg_argv[0] = 'opportunity'
      and old_record -> 'lost_at' = 'null'::jsonb
      and new_record -> 'lost_at' <> 'null'::jsonb
      then 'mark_lost'
    when tg_argv[0] = 'opportunity'
      and old_record ->> 'pipeline_stage'
        is distinct from new_record ->> 'pipeline_stage'
      then 'change_stage'
    when tg_argv[0] = 'opportunity'
      and old_record -> 'owner_id' is distinct from new_record -> 'owner_id'
      then case
        when new_record -> 'owner_id' = 'null'::jsonb then 'clear_owner'
        else 'assign_owner'
      end
    when tg_argv[0] = 'opportunity'
      and old_record -> 'expected_close_date'
        is distinct from new_record -> 'expected_close_date'
      then case
        when new_record -> 'expected_close_date' = 'null'::jsonb
          then 'clear_expected_close'
        else 'set_expected_close'
      end
    when tg_argv[0] = 'opportunity'
      and old_record -> 'probability_overridden'
        is distinct from new_record -> 'probability_overridden'
      then case
        when new_record ->> 'probability_overridden' = 'true'
          then 'override_probability'
        else 'clear_probability_override'
      end
    else 'update'
  end;

  if authenticated_actor_id is not null then
    select profile.role
    into authenticated_actor_role
    from public.profiles as profile
    where profile.id = authenticated_actor_id;
  end if;

  select context.request_id, context.application_operation
  into verified_request_id, verified_application_operation
  from public.verified_mutation_request_context() as context;

  insert into public.mutation_audit_events (
    request_id,
    actor_id,
    actor_role,
    resource_type,
    resource_id,
    operation,
    application_operation,
    source,
    changed_fields,
    resource_version_before,
    resource_version_after
  ) values (
    verified_request_id,
    authenticated_actor_id,
    authenticated_actor_role,
    tg_argv[0],
    (effective_record ->> tg_argv[1])::uuid,
    actual_operation,
    verified_application_operation,
    case
      when verified_request_id is null then 'database'
      else 'application'
    end,
    changed_field_names,
    before_version,
    after_version
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.record_mutation_audit_event()
  from public, anon, authenticated, service_role;

create trigger profiles_zz_record_mutation_audit
  after insert or update or delete on public.profiles
  for each row execute function public.record_mutation_audit_event(
    'profile',
    'id'
  );
create trigger companies_zz_record_mutation_audit
  after insert or update or delete on public.companies
  for each row execute function public.record_mutation_audit_event(
    'company',
    'id'
  );
create trigger contacts_zz_record_mutation_audit
  after insert or update or delete on public.contacts
  for each row execute function public.record_mutation_audit_event(
    'contact',
    'id'
  );
create trigger leads_zz_record_mutation_audit
  after insert or update or delete on public.leads
  for each row execute function public.record_mutation_audit_event(
    'lead',
    'id'
  );
create trigger lead_activities_zz_record_mutation_audit
  after insert or update or delete on public.lead_activities
  for each row execute function public.record_mutation_audit_event(
    'lead_activity',
    'id'
  );
create trigger lead_conversions_zz_record_mutation_audit
  after insert or update or delete on public.lead_conversions
  for each row execute function public.record_mutation_audit_event(
    'lead_conversion',
    'lead_id'
  );
create trigger opportunities_zz_record_mutation_audit
  after insert or update or delete on public.opportunities
  for each row execute function public.record_mutation_audit_event(
    'opportunity',
    'id'
  );

commit;
