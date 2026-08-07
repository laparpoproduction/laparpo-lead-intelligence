#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ "${LAPARPO_AUTHENTICATED_E2E:-}" != "true" ]]; then
  echo "Authenticated E2E requires LAPARPO_AUTHENTICATED_E2E=true" >&2
  exit 1
fi

mapfile -t migration_files < <(find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print | LC_ALL=C sort)
if [[ "${#migration_files[@]}" -ne 23 ]] || printf '%s\n' "${migration_files[@]}" | grep -q '024'; then
  echo "Authenticated E2E requires the frozen 001-023 migration inventory" >&2
  exit 1
fi

mkdir -p .tmp/authenticated-e2e

if ! NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-/tmp/laparpo-npm-cache}" \
  npx --yes supabase@2.39.2 start \
    --exclude realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor \
    --workdir . \
    > .tmp/authenticated-e2e/start.log 2>&1; then
  echo "Disposable Supabase failed to start. Safe diagnostics:" >&2
  grep -Ei 'error|failed|unhealthy|timeout|denied|stopped' \
    .tmp/authenticated-e2e/start.log \
    | sed -E \
        -e 's#postgres(ql)?://[^[:space:]]+#[redacted-db-url]#g' \
        -e 's/(eyJ[A-Za-z0-9._-]+)/[redacted-token]/g' \
    | tail -50 >&2 || true
  exit 1
fi

if ! NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-/tmp/laparpo-npm-cache}" \
  npx --yes supabase@2.39.2 db reset --local --no-seed --workdir . \
    > .tmp/authenticated-e2e/reset.log 2>&1; then
  echo "Disposable Supabase migration reset failed. Safe diagnostics:" >&2
  grep -Ei 'error|failed|fatal|denied|does not exist|syntax' \
    .tmp/authenticated-e2e/reset.log \
    | sed -E 's/(eyJ[A-Za-z0-9._-]+)/[redacted-token]/g' \
    | tail -50 >&2 || true
  exit 1
fi

NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-/tmp/laparpo-npm-cache}" \
  npx --yes supabase@2.39.2 status --output env --workdir . \
  > .tmp/authenticated-e2e/supabase.env

node scripts/authenticated-e2e/provision.mjs
echo "Disposable authenticated Supabase fixtures are ready."
