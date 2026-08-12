#!/usr/bin/env bash
set -euo pipefail

task_psql=(psql -X -qAt -v ON_ERROR_STOP=1)
task_tmp_dir="$(mktemp -d)"
task_actor_id="8d000000-0000-4000-8000-000000000001"
task_other_actor_id="8d000000-0000-4000-8000-000000000002"

cleanup() {
  "${task_psql[@]}" \
    -v actor_id="$task_actor_id" \
    -v other_actor_id="$task_other_actor_id" <<'SQL' >/dev/null
reset role;
delete from ai_rate_limit_private.actor_windows
where actor_id in (:'actor_id'::uuid, :'other_actor_id'::uuid);
delete from auth.users
where id in (:'actor_id'::uuid, :'other_actor_id'::uuid);
SQL
  rm -r "$task_tmp_dir"
}
trap cleanup EXIT

"${task_psql[@]}" \
  -v actor_id="$task_actor_id" \
  -v other_actor_id="$task_other_actor_id" <<'SQL'
insert into auth.users (id, email, raw_user_meta_data) values
  (:'actor_id'::uuid, 'ai-rate-concurrency-a@laparpo.test', '{}'),
  (:'other_actor_id'::uuid, 'ai-rate-concurrency-b@laparpo.test', '{}');
SQL

for task_round in 1 2 3 4 5; do
  "${task_psql[@]}" -v actor_id="$task_actor_id" <<'SQL'
insert into ai_rate_limit_private.actor_windows (actor_id, accepted_at, updated_at)
values (
  :'actor_id'::uuid,
  array[
    pg_catalog.clock_timestamp() - interval '25 seconds',
    pg_catalog.clock_timestamp() - interval '20 seconds',
    pg_catalog.clock_timestamp() - interval '15 seconds',
    pg_catalog.clock_timestamp() - interval '10 seconds'
  ],
  pg_catalog.clock_timestamp()
)
on conflict (actor_id) do update
set accepted_at = excluded.accepted_at,
    updated_at = excluded.updated_at;
SQL

  for task_request in 1 2 3 4 5 6 7 8; do
    "${task_psql[@]}" -v actor_id="$task_actor_id" \
      >"$task_tmp_dir/round-${task_round}-${task_request}" <<'SQL' &
set role authenticated;
select set_config('request.jwt.claim.sub', :'actor_id', false);
select (public.consume_ai_actor_rate_limit() ->> 'allowed')::boolean;
SQL
  done
  wait

  task_winners="$(awk '$0 == "t" { count += 1 } END { print count + 0 }' "$task_tmp_dir"/round-"$task_round"-*)"
  test "$task_winners" -eq 1
  "${task_psql[@]}" -v actor_id="$task_actor_id" <<'SQL'
select 1 / (pg_catalog.cardinality(accepted_at) = 5)::integer
from ai_rate_limit_private.actor_windows
where actor_id = :'actor_id'::uuid;
SQL
done

# Independent sessions for different actors do not share or block each other's
# budget; each receives its own first accepted slot.
"${task_psql[@]}" \
  -v actor_id="$task_actor_id" \
  -v other_actor_id="$task_other_actor_id" <<'SQL'
delete from ai_rate_limit_private.actor_windows
where actor_id in (:'actor_id'::uuid, :'other_actor_id'::uuid);
SQL
for task_pair in a b; do
  if [[ "$task_pair" == "a" ]]; then
    task_pair_actor="$task_actor_id"
  else
    task_pair_actor="$task_other_actor_id"
  fi
  "${task_psql[@]}" -v actor_id="$task_pair_actor" \
    >"$task_tmp_dir/pair-$task_pair" <<'SQL' &
set role authenticated;
select set_config('request.jwt.claim.sub', :'actor_id', false);
select (public.consume_ai_actor_rate_limit() ->> 'allowed')::boolean;
SQL
done
wait
grep -qx 't' "$task_tmp_dir/pair-a"
grep -qx 't' "$task_tmp_dir/pair-b"

printf '%s\n' "AI actor rate-limit concurrency checks passed"
