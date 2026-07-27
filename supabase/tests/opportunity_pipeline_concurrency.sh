#!/usr/bin/env bash
set -euo pipefail

task_psql=(psql -X -qAt -v ON_ERROR_STOP=1)
task_tmp_dir="$(mktemp -d)"
task_actor_id="71000000-0000-4000-8000-000000000002"
task_lead_id="87000000-0000-4000-8000-000000000002"
task_stage_id="8a000000-0000-4000-8000-000000000001"
task_same_id="8a000000-0000-4000-8000-000000000002"
task_terminal_id="8a000000-0000-4000-8000-000000000003"

cleanup() {
  "${task_psql[@]}" \
    -v stage_id="$task_stage_id" \
    -v same_id="$task_same_id" \
    -v terminal_id="$task_terminal_id" <<'SQL' >/dev/null
reset role;
delete from public.opportunities
where id in (
  :'stage_id'::uuid,
  :'same_id'::uuid,
  :'terminal_id'::uuid
);
SQL
  rm -r "$task_tmp_dir"
}
trap cleanup EXIT

task_versions="$("${task_psql[@]}" \
  -v lead_id="$task_lead_id" \
  -v stage_id="$task_stage_id" \
  -v same_id="$task_same_id" \
  -v terminal_id="$task_terminal_id" <<'SQL'
reset role;
insert into public.opportunities (id, lead_id, service)
values
  (:'stage_id'::uuid, :'lead_id'::uuid, 'food_review'),
  (:'same_id'::uuid, :'lead_id'::uuid, 'food_review'),
  (:'terminal_id'::uuid, :'lead_id'::uuid, 'food_review');

select id::text || '|' || updated_at::text
from public.opportunities
where id in (
  :'stage_id'::uuid,
  :'same_id'::uuid,
  :'terminal_id'::uuid
)
order by id;
SQL
)"

task_stage_version="$(printf '%s\n' "$task_versions" | awk -F'|' -v id="$task_stage_id" '$1 == id { print $2 }')"
task_same_version="$(printf '%s\n' "$task_versions" | awk -F'|' -v id="$task_same_id" '$1 == id { print $2 }')"
task_terminal_version="$(printf '%s\n' "$task_versions" | awk -F'|' -v id="$task_terminal_id" '$1 == id { print $2 }')"

"${task_psql[@]}" \
  -v actor_id="$task_actor_id" \
  -v opportunity_id="$task_stage_id" \
  -v expected="$task_stage_version" >"$task_tmp_dir/stage-winner" <<'SQL' &
begin;
set role authenticated;
select set_config('request.jwt.claim.sub', :'actor_id', false);
with changed as (
  update public.opportunities
  set pipeline_stage = 'discussion'
  where id = :'opportunity_id'::uuid
    and updated_at = :'expected'::timestamptz
  returning 1
)
select 'winner=' || count(*) from changed;
select pg_sleep(1.5);
commit;
SQL
task_winner_pid=$!
sleep 0.2
"${task_psql[@]}" \
  -v actor_id="$task_actor_id" \
  -v opportunity_id="$task_stage_id" \
  -v expected="$task_stage_version" >"$task_tmp_dir/stage-loser" <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub', :'actor_id', false);
with changed as (
  update public.opportunities
  set pipeline_stage = 'quotation_sent'
  where id = :'opportunity_id'::uuid
    and updated_at = :'expected'::timestamptz
  returning 1
)
select 'loser=' || count(*) from changed;
SQL
wait "$task_winner_pid"
grep -qx 'winner=1' "$task_tmp_dir/stage-winner"
grep -qx 'loser=0' "$task_tmp_dir/stage-loser"
"${task_psql[@]}" -v opportunity_id="$task_stage_id" <<'SQL'
select 1 / case when exists (
    select 1 from public.opportunities
    where id = :'opportunity_id'::uuid
      and pipeline_stage = 'discussion'
      and probability_percent = 40
  ) then 1 else 0 end;
SQL

"${task_psql[@]}" \
  -v actor_id="$task_actor_id" \
  -v opportunity_id="$task_same_id" \
  -v expected="$task_same_version" >"$task_tmp_dir/same-winner" <<'SQL' &
begin;
set role authenticated;
select set_config('request.jwt.claim.sub', :'actor_id', false);
with changed as (
  update public.opportunities
  set pipeline_stage = 'discussion'
  where id = :'opportunity_id'::uuid
    and updated_at = :'expected'::timestamptz
  returning 1
)
select 'winner=' || count(*) from changed;
select pg_sleep(1.5);
commit;
SQL
task_winner_pid=$!
sleep 0.2
"${task_psql[@]}" \
  -v actor_id="$task_actor_id" \
  -v opportunity_id="$task_same_id" \
  -v expected="$task_same_version" >"$task_tmp_dir/same-loser" <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub', :'actor_id', false);
with changed as (
  update public.opportunities
  set pipeline_stage = 'discussion'
  where id = :'opportunity_id'::uuid
    and updated_at = :'expected'::timestamptz
  returning 1
)
select 'loser=' || count(*) from changed;
SQL
wait "$task_winner_pid"
grep -qx 'winner=1' "$task_tmp_dir/same-winner"
grep -qx 'loser=0' "$task_tmp_dir/same-loser"
"${task_psql[@]}" -v opportunity_id="$task_same_id" <<'SQL'
select 1 / case when exists (
    select 1 from public.opportunities
    where id = :'opportunity_id'::uuid
      and pipeline_stage = 'discussion'
      and probability_percent = 40
  ) then 1 else 0 end;
SQL

"${task_psql[@]}" \
  -v actor_id="$task_actor_id" \
  -v opportunity_id="$task_terminal_id" \
  -v expected="$task_terminal_version" >"$task_tmp_dir/terminal-winner" <<'SQL' &
begin;
set role authenticated;
select set_config('request.jwt.claim.sub', :'actor_id', false);
with changed as (
  update public.opportunities
  set pipeline_stage = 'won'
  where id = :'opportunity_id'::uuid
    and updated_at = :'expected'::timestamptz
  returning 1
)
select 'winner=' || count(*) from changed;
select pg_sleep(1.5);
commit;
SQL
task_winner_pid=$!
sleep 0.2
"${task_psql[@]}" \
  -v actor_id="$task_actor_id" \
  -v opportunity_id="$task_terminal_id" \
  -v expected="$task_terminal_version" >"$task_tmp_dir/terminal-loser" <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub', :'actor_id', false);
with changed as (
  update public.opportunities
  set pipeline_stage = 'lost',
      lost_reason = 'budget'
  where id = :'opportunity_id'::uuid
    and updated_at = :'expected'::timestamptz
  returning 1
)
select 'loser=' || count(*) from changed;
SQL
wait "$task_winner_pid"
grep -qx 'winner=1' "$task_tmp_dir/terminal-winner"
grep -qx 'loser=0' "$task_tmp_dir/terminal-loser"
"${task_psql[@]}" -v opportunity_id="$task_terminal_id" <<'SQL'
select 1 / case when exists (
    select 1 from public.opportunities
    where id = :'opportunity_id'::uuid
      and pipeline_stage = 'won'
      and probability_percent = 100
      and not probability_overridden
      and won_at is not null
      and lost_at is null
      and lost_reason is null
  ) then 1 else 0 end;
SQL

printf '%s\n' "Opportunity pipeline CAS concurrency checks passed"
