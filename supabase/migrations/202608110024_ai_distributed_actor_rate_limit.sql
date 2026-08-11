begin;

create schema ai_rate_limit_private;

revoke all on schema ai_rate_limit_private
  from public, anon, authenticated, service_role;

-- Bounded operational abuse-control state: one row per actor and no more than
-- the five accepted timestamps needed to reproduce the rolling-window policy.
-- This is not AI history and is not exposed through the Data API.
create table ai_rate_limit_private.actor_windows (
  actor_id uuid primary key references public.profiles(id) on delete cascade,
  accepted_at timestamptz[] not null,
  updated_at timestamptz not null,
  constraint actor_windows_bounded_timestamps check (
    pg_catalog.cardinality(accepted_at) between 1 and 5
    and pg_catalog.array_position(accepted_at, null) is null
  )
);

revoke all on table ai_rate_limit_private.actor_windows
  from public, anon, authenticated, service_role;

comment on table ai_rate_limit_private.actor_windows is
  'Bounded operational state for the shared Phase 1A/1B authenticated actor AI budget. It is not CRM mutation audit or AI usage history.';

-- SECURITY DEFINER is required because authenticated callers are deliberately
-- denied direct access to the private state. The zero-argument surface derives
-- actor identity and time internally and returns no stored timestamps.
create or replace function public.consume_ai_actor_rate_limit()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  authenticated_actor_id uuid := auth.uid();
  authoritative_now timestamptz;
  accepted_timestamps timestamptz[];
  last_accepted_at timestamptz;
  inserted_rows integer;
  cooldown_remaining_ms integer := 0;
  window_remaining_ms integer := 0;
  retry_after_ms integer := 0;
begin
  if authenticated_actor_id is null or not public.is_active_user() then
    raise insufficient_privilege using message = 'Active authentication required';
  end if;

  authoritative_now := pg_catalog.clock_timestamp();

  insert into ai_rate_limit_private.actor_windows (
    actor_id,
    accepted_at,
    updated_at
  ) values (
    authenticated_actor_id,
    array[authoritative_now],
    authoritative_now
  )
  on conflict (actor_id) do nothing;

  get diagnostics inserted_rows = row_count;
  if inserted_rows = 1 then
    return pg_catalog.jsonb_build_object(
      'allowed', true,
      'retry_after_ms', 0
    );
  end if;

  select actor_window.accepted_at
  into accepted_timestamps
  from ai_rate_limit_private.actor_windows as actor_window
  where actor_window.actor_id = authenticated_actor_id
  for update;

  if accepted_timestamps is null then
    raise data_exception using message = 'AI rate-limit state unavailable';
  end if;

  select coalesce(
    pg_catalog.array_agg(accepted_timestamp order by accepted_timestamp),
    array[]::timestamptz[]
  )
  into accepted_timestamps
  from pg_catalog.unnest(accepted_timestamps) as accepted_timestamp
  where authoritative_now - accepted_timestamp < interval '60 seconds';

  last_accepted_at := accepted_timestamps[
    pg_catalog.cardinality(accepted_timestamps)
  ];

  if last_accepted_at is not null
    and authoritative_now - last_accepted_at < interval '5 seconds'
  then
    cooldown_remaining_ms := pg_catalog.ceil(
      pg_catalog.extract(
        epoch from (last_accepted_at + interval '5 seconds' - authoritative_now)
      ) * 1000
    )::integer;
  end if;

  if pg_catalog.cardinality(accepted_timestamps) >= 5 then
    window_remaining_ms := pg_catalog.ceil(
      pg_catalog.extract(
        epoch from (accepted_timestamps[1] + interval '60 seconds' - authoritative_now)
      ) * 1000
    )::integer;
  end if;

  retry_after_ms := greatest(
    cooldown_remaining_ms,
    window_remaining_ms,
    0
  );

  if retry_after_ms > 0 then
    update ai_rate_limit_private.actor_windows as actor_window
    set accepted_at = accepted_timestamps,
        updated_at = authoritative_now
    where actor_window.actor_id = authenticated_actor_id;

    return pg_catalog.jsonb_build_object(
      'allowed', false,
      'retry_after_ms', retry_after_ms
    );
  end if;

  accepted_timestamps := pg_catalog.array_append(
    accepted_timestamps,
    authoritative_now
  );

  update ai_rate_limit_private.actor_windows as actor_window
  set accepted_at = accepted_timestamps,
      updated_at = authoritative_now
  where actor_window.actor_id = authenticated_actor_id;

  return pg_catalog.jsonb_build_object(
    'allowed', true,
    'retry_after_ms', 0
  );
end;
$$;

revoke all on function public.consume_ai_actor_rate_limit()
  from public, anon, service_role;
grant execute on function public.consume_ai_actor_rate_limit()
  to authenticated;

commit;
