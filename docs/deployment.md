# Production deployment and database migration runbook

This is the authoritative operational procedure for releasing Laparpo Lead
Intelligence. It is deliberately fail-closed: if a prerequisite, database
target, migration result or verification result is uncertain, stop the release.

The repository does not deploy itself and this runbook does not authorize a
production deployment. Never put credentials, keys, connection strings or
secret values in commits, tickets, command history, logs or screenshots.

## 1. Pre-deployment gate

Record the release commit, operator, change window, application target and
Supabase project reference in the approved change record. Before proceeding,
verify all of the following:

- The release commit is reviewed, immutable for the change window and has green
  exact-head CI. The checkout is clean and matches that commit.
- Node.js satisfies `package.json` (`>=20.9.0`). CI currently validates on
  Node.js 24. Use an npm version that supports the committed lockfile and install
  with `npm ci`; do not regenerate the lockfile during a release.
- `NEXT_PUBLIC_SUPABASE_URL` is the intended production project's valid HTTPS
  Supabase URL and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is its non-blank
  publishable or legacy anon key.
- `COMPANY_DUPLICATE_CONFIRMATION_SECRET`,
  `CONTACT_DUPLICATE_CONFIRMATION_SECRET` and
  `LEAD_DUPLICATE_CONFIRMATION_SECRET` are server-only production values of at
  least 32 characters. Never echo them or expose them through a
  `NEXT_PUBLIC_` variable.
- `LAPARPO_DEMO_MODE` is unset or exactly `false`. It must never be `true` in
  production. Missing, partial, blank or invalid Supabase configuration is a
  deployment failure, not a reason to enter demo mode.
- The operator has positively identified the Supabase organization, project
  reference, database host and environment. A project name alone is not enough.
- A current database backup or provider recovery point exists, restoration
  access is available, and the reviewed recovery owner and procedure are known.
  Do not begin a schema change while recovery readiness is unverified.
- `npm audit --omit=dev --audit-level=high` succeeds. A full `npm audit` may
  still report verified development-only tooling findings; those do not replace
  or weaken the production dependency gate.

Production build validation also requires the real configuration above. Do not
substitute test credentials for a production release build.

## 2. Database migration source of truth

`supabase/migrations/` is the only authoritative migration set. Apply every
pending `.sql` file in filename/version order. Never use a README, ticket,
historical migration number or copied subset as a migration manifest.

To review the release's migration inventory without printing credentials:

```bash
find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print | LC_ALL=C sort
```

At the H6 baseline commit, the verified inventory contains 22 migrations,
sequence `001` through `022`, with `022` latest. This is a dated verification
fact only. It is **not** the rule for deciding what to apply: future releases
must discover the complete directory again and include migrations `023+` when
they exist.

Application rollout must not proceed while any repository migration is pending,
unverified or failed. Historical migrations are immutable. Repair production
with a new, separately reviewed migration; never edit, rename, reorder or
replace an already released migration.

## 3. Supported migration execution

This repository currently contains SQL migrations and disposable PostgreSQL CI
coverage, but it does **not** contain a pinned Supabase CLI, a
`supabase/config.toml`, production project-link metadata or a production
migration executor. Consequently, the repository cannot safely prescribe
`supabase db push` or another remote command for production today.

That limitation is a hard gate, not permission to improvise. Before a production
release, the database/platform owner must provide an approved Supabase migration
facility that:

1. is authenticated outside the repository and positively targets the recorded
   production project;
2. reads the pending set from this release's complete
   `supabase/migrations/` directory;
3. applies pending files once, in filename/version order;
4. records and can report applied migration versions; and
5. returns a failing status on the first SQL error.

Use that facility's reviewed production procedure and capture its version report
in the change record. If no such approved, tracked facility is available, stop:
the database portion of the release is not executable safely.

Do not use the explicit `psql -f` sequence in `.github/workflows/ci.yml` as a
production migration command. It builds a fresh PostgreSQL 17 service and
interleaves legacy fixtures to test upgrade behavior; it is not a remote
Supabase deployment or migration ledger.

### Local and test databases

CI's bootstrap, legacy fixtures, seed data and smoke tests are for disposable
local/test databases only. A developer may reproduce them only against a
positively identified throwaway database.

Never run a reset, drop, recreate, bootstrap, seed replacement or test fixture
against production. This repository does not define a production reset
procedure. In particular, do not run these against production:

- `supabase/tests/bootstrap.sql`;
- `supabase/tests/*fixture.sql`;
- automated seed replacement; or
- the CI PostgreSQL command block.

The one-time first-user promotion described in `supabase/seed.sql` is a separate
privileged administration procedure, not a schema migration. Review its exact
target account and authorization independently; do not treat it as general
production seed data.

## 4. Release order

Perform the release in this order:

1. Verify the reviewed release commit, clean checkout and exact-head CI.
2. Verify all production configuration without printing secret values.
3. Run `npm ci` to install the committed dependency graph.
4. Run the release gates:

   ```bash
   npm audit --omit=dev --audit-level=high
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```

5. Positively verify the Supabase production target and operator authorization.
6. Confirm backup/recovery readiness and the reviewed recovery owner.
7. Through the approved tracked facility, apply every pending file discovered
   from `supabase/migrations/`, in filename order.
8. Compare the facility's applied-version report with the complete migration
   directory at the release commit. Stop if any version is absent or failed.
9. Complete the non-destructive database and staging checks below.
10. Deploy or start the exact validated application artifact.
11. Complete post-deploy health, authentication and read-path verification.

Do not start the new application before its required migrations are complete.
If a release platform deploys automatically, configure or pause promotion so
steps 5–9 remain a blocking precondition.

## 5. Migration failure and recovery

If any migration fails:

- stop the application rollout and do not mark the deployment successful;
- record the failing filename/version and the database facility's sanitized
  error output;
- preserve evidence and investigate the database's actual transaction state
  before retrying;
- do not skip the migration or manually mark it applied without proof that its
  complete intended transaction succeeded;
- do not rerun arbitrary historical SQL, mutate a historical file or make
  ad-hoc production edits; and
- use only an explicitly reviewed recovery or forward-fix procedure.

An application rollback does not automatically reverse a database change.
Restore or point-in-time recovery is a separate, high-impact action and must
follow the provider-approved recovery procedure with explicit review. Confirm
schema/application compatibility before rolling back only the application.

## 6. Verification

Use exact-head CI and a controlled staging project for destructive or adversarial
security tests. Do not test hard deletes, privilege escalation or immutable
field mutation against live production data.

Before application rollout, verify:

- the approved migration facility reports every migration in the release
  directory as successfully applied;
- read-only catalog or migration metadata confirms the expected hardened
  database objects from the release;
- exact-head CI passed migration/legacy-upgrade coverage, RLS/database smokes,
  profile privilege protection, Company hard-delete/soft-delete protection,
  immutable creation audit metadata, conversion/restore/concurrency integrity
  and Opportunity pipeline/CAS/Won-Lost concurrency; and
- the production dependency audit still succeeds.

In controlled staging, confirm:

- authentication succeeds for an active test user and an inactive test user is
  denied;
- Sales Manager profile privilege escalation remains blocked;
- Company physical deletion remains blocked while normal soft deletion works;
- creation provenance fields remain immutable;
- production configuration cannot enter demo mode; and
- Companies, Contacts, Leads, Lead Activities and Opportunity
  list/detail/pipeline reads work for authorized roles.

After application deployment, perform non-destructive production checks:

- the service health route and login page respond normally;
- an active authorized account can authenticate and reach permitted modules;
- an inactive account remains denied if an approved production-safe test
  identity exists; otherwise rely on the controlled staging proof;
- the UI is not labelled as demo and no configuration-failure page appears;
- authorized basic reads work for Companies, Contacts and Leads;
- authorized Opportunity list, detail and pipeline reads work; and
- logs contain no migration, authentication, configuration or database errors
  and expose no secret values.

Record the release commit, application artifact/version, migration version
report and verification outcome. A missing proof is a failed release gate.
