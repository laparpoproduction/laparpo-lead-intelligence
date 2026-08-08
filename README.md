# Laparpo Lead Intelligence

Production foundation for Laparpo Production's lead prospecting and sales-assistance system. The product is designed to turn legitimate public business signals into conversations, appointments, quotations and deposits.

Automated lead discovery is deliberately outside this foundation sprint.

## Foundation scope

- Next.js App Router with strict TypeScript and Tailwind CSS
- Supabase SSR authentication for server and browser usage
- Active-user and role-based route protection
- Responsive modules for Overview, Leads, Companies, Contacts, Tasks, Campaigns and Settings
- PostgreSQL migrations with constraints, indexes and Row Level Security
- Deterministic company fingerprint and reusable duplicate-checking utility
- Zod validation, structured logging, loading, empty and error states
- Vitest, Playwright and PostgreSQL RLS smoke tests in GitHub Actions

## Roles and access

| Role | Operational modules | Campaigns | Settings |
| --- | --- | --- | --- |
| CEO / Admin | All records | Yes | Yes |
| Sales Manager | All sales records | Yes | No |
| Sales Representative | Owned or assigned records | No | No |

New Supabase Auth users receive the `sales_representative` role. Promote the first verified account through SQL as described in `supabase/seed.sql`. Inactive profiles are denied dashboard access.

## Local setup

1. Install Node.js 20.9 or newer.
2. Install the lockfile exactly:

   ```bash
   npm ci
   ```

3. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

4. Create a Supabase project and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `COMPANY_DUPLICATE_CONFIRMATION_SECRET` with at least 32 random characters
   - `CONTACT_DUPLICATE_CONFIRMATION_SECRET` with at least 32 random characters
   - `LEAD_DUPLICATE_CONFIRMATION_SECRET` with at least 32 random characters
   - `MUTATION_AUDIT_CORRELATION_SECRET` with at least 32 random characters,
     matching the protected private database secret described in the deployment
     runbook
   - optional `OPENAI_API_KEY` to enable the read-only AI Phase 1A/1B actions and optional
     allow-listed `OPENAI_MODEL` (`gpt-5.6-terra` or `gpt-5.6-luna`)
5. Apply **every** migration currently present in `supabase/migrations/` in
   filename order. The directory, not this README, is the migration source of
   truth. Do not select only a historical subset. Follow the
   [deployment and database migration runbook](docs/deployment.md) before
   targeting any shared or production database.
6. After migration 023 exists, use the privileged database/secret-management
   procedure described in the runbook to provision the matching verifier value
   into its private single-purpose store. Do not use an application role or a
   database/role setting.
7. Create the first user through Supabase Auth and promote that account to `ceo_admin`.
8. Start the app:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

Missing or partial Supabase configuration fails closed. For a deliberate local
preview without Supabase, leave both Supabase variables absent and set the
server-only `LAPARPO_DEMO_MODE=true`. Demo preview is allowed only outside
production, is visibly labelled and cannot create a real mutation context.

## Environment variables

| Variable | Visibility | Required now | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Yes for auth | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server | Yes for auth | Supabase publishable or legacy anon key |
| `LAPARPO_DEMO_MODE` | Server only | No; defaults to disabled | Exact `true` enables the non-production preview only when both Supabase values are absent |
| `LAPARPO_AUTHENTICATED_E2E` | Server only | TEST-010 only | Exact `true`, together with the AI-stub flag, enables only the disposable authenticated E2E lane outside production |
| `LAPARPO_E2E_AI_STUB` | Server only | TEST-010 only | Exact `true` selects the deterministic outbound AI substitute only inside the authenticated E2E lane |
| `LAPARPO_E2E_AI_STUB_CALLS_FILE` | Server only | TEST-010 only | Isolated `.tmp/authenticated-e2e` counter used to prove exactly one stub call |
| `COMPANY_DUPLICATE_CONFIRMATION_SECRET` | Server only | Yes for company mutations | Signs short-lived duplicate confirmation tokens; use at least 32 random characters |
| `CONTACT_DUPLICATE_CONFIRMATION_SECRET` | Server only | Yes for contact mutations | Signs namespaced, short-lived Contact confirmation tokens; use at least 32 random characters |
| `LEAD_DUPLICATE_CONFIRMATION_SECRET` | Server only | Yes for lead mutations | Signs namespaced, short-lived lead confirmation tokens; use at least 32 random characters |
| `MUTATION_AUDIT_CORRELATION_SECRET` | Server only | Yes for production mutations | Signs short-lived request correlation sent only by the server Supabase client; must match the protected private database secret |
| `OPENAI_API_KEY` | Server only | No | Enables the optional read-only Company intelligence and Opportunity pipeline summary actions |
| `OPENAI_MODEL` | Server only | No | Allow-listed AI model for both controlled slices; defaults safely to `gpt-5.6-terra` |
| `LOG_LEVEL` | Server only | No | Logging threshold; defaults to `info` |

Never expose the OpenAI API key or a Supabase service-role key through a `NEXT_PUBLIC_` variable.
Production builds fail during Next.js configuration when
the Supabase URL/key is missing, partial or invalid; demo mode is enabled or
malformed; or any duplicate-confirmation/audit-correlation secret is missing or
shorter than 32 characters. Demo mode is forbidden in production.
Tests and local development may omit the server-only mutation secrets until
those workflows are exercised. Supabase values may be omitted only for the
explicit non-production demo described above; production-like local builds must
provide URL/key and explicit test-only confirmation values.
The authenticated E2E flags are exact booleans, are rejected in production and
must never use a `NEXT_PUBLIC_` prefix. They do not create an actor, session,
repository, RLS or mutation bypass; they substitute only the outbound AI provider.

## Database architecture

The migrations provide:

- `profiles` with CEO/Admin, Sales Manager and Sales Representative roles
- `companies` with public source metadata, normalized contact fields, social URLs,
  full address, location and fingerprint
- `contacts` with optional company ownership, public professional details,
  source provenance, assignment, lifecycle status, soft delete and a non-unique
  duplicate signal
- `leads` with pre-Opportunity stages, qualification, ownership, provenance,
  sales context, outcome consistency, soft delete and duplicate signals
- `lead_signals`, `lead_activities` and `sales_tasks`
- compatibility tables for `lead_sources` and `opportunities`

Successful CRM mutations are also recorded by PostgreSQL in an append-only
audit trail. The trigger derives the authenticated actor and actual changed
field names inside the same transaction; it never stores CRM before/after
values. Server actions generate a fresh request ID and sign a short-lived
PostgREST context so the same ID appears in structured application logs and
database events. Direct authenticated PostgREST mutations remain audited with
no invented application correlation.

Database audit events prove only successful committed mutations: an event in a
failed transaction rolls back with that transaction. Structured application
logs correlate safe failure outcomes, but they are not presented as
database-authoritative or guaranteed durable unless the deployment's log sink
provides that retention. No historical audit events are backfilled.

Every new company requires a public source URL and discovery timestamp. Leads
retain direct source type and discovery provenance; public-directory, website and
social sources require URLs, while referrals, campaigns and signals require their
corresponding evidence when a URL is unavailable. RLS lets management see the
sales workspace while representatives see records they created, are assigned, or
may read through an accessible Company.

### Duplicate protection

Company fingerprints normalise:

- legal suffixes and company-name punctuation;
- website hostnames without protocol, path or `www`;
- Malaysian phone numbers into country-code form;
- city, state and country.

Fingerprint and website-domain indexes are intentionally non-unique: branches and
legitimate businesses may share a corporate website, phone or city. The database
normalizes these fields for lookup, while `src/lib/companies/duplicate.ts` labels a
record as a likely duplicate only when its normalized name matches together with a
matching domain, Malaysian phone number, or complete city-and-state location.
Create and update server actions return a duplicate warning before allowing an
explicit override. The override token is short-lived and signed server-side, and is
bound to the authenticated user, operation, company ID where applicable, and the
canonical submitted fields.
Confirmed duplicate mutations also carry a random idempotency ID. PostgreSQL
records only that ID, the actor, operation, submission hash and resulting company
ID; the form payload is never stored. Replayed creates return the original company,
while replayed updates return a safe already-consumed result.

### Companies interface

The protected Companies workspace now includes a responsive list, one reusable
create/edit form, deliberate duplicate confirmation, and management-only
soft-delete confirmation. Mutations continue to use the existing server actions;
the interface does not introduce REST endpoints or client-side database access.
The list uses URL search parameters as its validated source of truth for company
name or domain search, company type, industry, city and state filters, safe sorting,
and deterministic 25-record server pagination. Empty and invalid parameters are
canonicalized, filter changes reset to page one, and pagination links preserve the
active query. Company rows open a protected details route with a verified-record
workspace and an opt-in transient Company intelligence section; timeline,
analytics and contact workflows remain separately scoped.

### AI Phase 1A: public Company intelligence

The protected Company detail workspace can generate evidence-bound Company
intelligence. The model selects only allow-listed profile, business-signal,
missing-field and recommendation codes; trusted application templates render the
visible summary, signals, gaps and non-binding suggestions. It is a server-only
read/analyze/recommend flow:

1. the Server Action resolves the authenticated active actor;
2. the existing Company service and RLS establish access to the target ID;
3. an explicit GREEN projection selects only legal/display name, Company type,
   industry, description, city, state, country, estimated branch count, website
   URL, source URL and source type;
4. an AI-specific trust-boundary validator rejects oversized fields and rejects
   serialized Company metadata above 8,192 UTF-8 bytes before provider invocation;
5. the official OpenAI SDK calls the Responses API with a fixed prompt,
   Structured Outputs, `store: false`, an allow-listed model, bounded output,
   a 20-second timeout and no automatic retry; and
6. strict Zod schemas reject extra properties and anything outside the closed
   enum contract;
7. an application validator checks every selected profile code, signal, gap and
   evidence reference against the actual GREEN projection; and
8. the application derives Low or Medium confidence from the validated profile
   completeness, then maps the validated codes to fixed text before the transient
   result reaches the UI.

The provider output has no arbitrary summary, signal, gap or recommendation text.
Its evidence references are limited to the same 12 GREEN projection fields and
all arrays are bounded. Profile assessment is one of
`well_populated_public_profile`, `partially_populated_public_profile` or
`sparse_public_profile`. Business and recommendation codes describe only supplied
business categories, recorded metadata, possible partnership-review fit,
clarification or human review. There is no code for a CRM mutation, contact
instruction, generated destination, customer, campaign, revenue, employee count,
award, market share or external verification. The provider schema contains no
confidence, score, probability or certainty field.

The per-field AI limits are: legal and display name 200 characters each,
industry/city/state 120 each, description 2,000, country 2, website/source URL
2,048 each, source type 100, and estimated branch count 100,000. Oversized input
is rejected rather than truncated so meaning and provenance cannot be silently
altered. Safe rejection logs contain only request/actor/Company IDs, the limit
category, and size metadata—not the rejected value or serialized projection.

The browser supplies only the target Company ID. It cannot supply Company
content, a model name, tools or authority. Company URLs are opaque untrusted
strings: this feature never fetches, browses, verifies, links or dereferences
them. No OpenAI web search, function tool, MCP, service-role Supabase client,
database write, cache revalidation, AI history or H7 mutation event is involved.
Demo and misconfigured modes cannot call the provider.

Contacts, emails, phone/WhatsApp values, Leads, Activities, notes, Profile data,
auth/session data, audit data, confirmation values and secrets are excluded from
the model request. Requests set `store: false`, which disables Responses
application-state storage for this use; it does not by itself override provider
abuse-monitoring retention or the organization's API data controls. Production
use still requires approval of the provider terms and project data settings.

The implementation applies a five-second per-user cooldown and five requests per
minute within one application runtime, caps input fields and structured output,
and records only safe metadata such as request/resource IDs, model, duration and
token counts. It never logs prompts, Company payloads, structured model output,
rendered text, provider raw responses or provider errors. This local limiter is deliberately not
presented as durable or distributed. TEST-010 now provides the authenticated
database-backed browser proof. Before broad AI production rollout, configure
provider project spend/rate controls and alerts, add a distributed limiter,
retain privacy-safe application logs, approve provider privacy controls, add a
`safety_identifier`, and complete the Contact PII and future URL-ingestion policy.

Confidence is derived by the application from the completeness of the available
Company metadata after structural validation: sparse profiles produce Low;
partial and well-populated profiles produce Medium. Phase 1A cannot produce High.
Completeness is not external verification, factual correctness, sales or
conversion probability, a Lead score, Opportunity probability, financial
confidence or certainty that the Company will buy. Free-form field contents do
not alter this derivation.

Deterministic CI uses provider stubs and a distinct A–J synthetic evaluation
matrix for accepted and incompatible codes, evidence consistency, missing-field
consistency, deterministic rendering and confidence derivation. The closed
contract cannot represent unsupported customer, campaign, financial, staffing,
award, market-share or external-verification claims. The long-but-valid fixture
reaches 92.57% of the serialized input ceiling without truncation. CI makes no
live OpenAI calls and does not guarantee live-model quality. The controlled
evaluation record and manual Terra procedure are in
[`docs/ai-company-intelligence-quality-evaluation.md`](docs/ai-company-intelligence-quality-evaluation.md).

### AI Phase 1B: permission-aware Opportunity pipeline summary

The protected `/opportunities/pipeline` workspace provides an explicit
`Summarize pipeline` action. The result is transient, advisory and read-only: it
is generated only after the user acts, disappears on reload, is never stored in
PostgreSQL, creates no H7 mutation event and contains no mutation controls.

The server resolves the active actor and queries a dedicated bounded projection
from the existing `opportunity_list_read_model`. That view is
`security_invoker`, so the existing Lead/Company access rules and RLS determine
both detailed candidates and exact stage counts. The browser submits no actor,
role, Opportunity ID list, pipeline data, model or prompt. Candidate selection
runs six database-bounded category queries in this fixed priority: passed
expected-close date, unassigned, Quotation Sent, Negotiation, manual probability
override and missing expected-close date. Each query contributes at most 10 new
unique rows, excludes already-selected UUIDs and uses deterministic date/update
ordering with a UUID tie-break. An oldest-`updated_at` fallback fills only the
remaining capacity up to 75. Exact RLS-filtered aggregate counts separately
represent all six stages, including Won and Lost. The provider input is rejected
rather than truncated if its serialized UTF-8 size exceeds 32,768 bytes.

For each bounded active Opportunity the provider sees only its UUID, stage,
service, persisted probability metadata, expected close date,
privacy-minimized owner status, deterministic update age,
conversion/ordinary kind, quotation/meeting/deposit presence, overdue flag and
application-derived attention codes. The provider does **not** receive Company
names, Lead titles, Contacts, emails, phones/WhatsApp, notes, Profile identities,
auth/session data, audit data or creator identity. Authorized Company/Lead labels
stay in a server-side display map and are resolved only after semantic validation.

Application code—not the model—determines overdue dates, unassigned rows,
missing close dates, probability overrides and quotation/negotiation follow-up.
Recorded MYR value does not create an AI focus and is not sent to the provider;
it remains available only in the authorized server-side display map. The model
may only choose up to three distinct focus codes and up to five supplied UUIDs
per focus. A strict schema contains no prose, URL, command, confidence or new
probability field. Independent semantic validation rejects invented,
inaccessible, terminal, duplicate or wrong-predicate UUID selections as a whole;
fixed application templates render every visible sentence. Raw provider text is
independently JSON-parsed before application Zod validation; reserved keys
`__proto__`, `constructor` and `prototype` are rejected recursively rather than
normalized away.

When more active rows are accessible than the 75 analyzed candidates, the closed
overview is always `limited_pipeline_data`, even if the bounded set contains
grounded focus items. The UI shows exact analyzed/accessible counts and explains
that the category-aware sample may omit other attention-worthy Opportunities.
A fully analyzed non-empty pipeline with none of the configured signals uses the
separate `pipeline_no_grounded_attention` overview and makes no health or
conversion claim.

Phase 1B reuses the official SDK/Responses API foundation, allow-listed Terra or
Luna model, `store: false`, low reasoning effort, 600 output-token ceiling,
20-second timeout, zero retries, no tools and no web search. Phase 1A and 1B share
the same actor-keyed five-second cooldown/five-per-minute in-runtime limiter.
That limiter is bounded but not distributed or durable. CI covers the A–M
synthetic matrix and real local Supabase/Auth browser journeys using the
production-forbidden deterministic provider; no live OpenAI call is made. See
[`docs/ai-opportunity-pipeline-summary-quality-evaluation.md`](docs/ai-opportunity-pipeline-summary-quality-evaluation.md).

Phase 1B does not predict sales success, recompute CRM probability, infer missing
money, convert currencies, reopen terminal Opportunities or grant mutation
authority. `LIVE-TERRA-EVAL-NOT-RUN` remains the current live-quality status.

### Contacts database foundation

`contacts.full_name` is the canonical display name. Optional `first_name` and
`last_name` fields help when a public source provides them, but the database never
splits or overwrites a supplied cultural name. `company_id` is nullable for a
legitimate independent public contact; when present, the relationship uses
`ON DELETE RESTRICT` so company removal cannot erase contact or CRM history.

The constrained contact statuses are `discovered`, `verified`, `contacted`,
`qualified`, `inactive` and `do_not_contact`. Every contact retains `source_url`,
`source_type` and `discovered_at`. Emails are lowercased, Malaysian phone and
WhatsApp values use country-code digit form, and public profile URLs are
normalized before storage.

The contact fingerprint is indexed but intentionally non-unique. A likely
duplicate requires stronger corroboration: a matching work/personal email,
LinkedIn profile or WhatsApp number, or the same normalized name together with
the same company, public phone or mobile number. A shared name at different
companies and a shared company main phone alone do not block a record. The
Contacts repository uses the RLS-bound `find_contact_duplicate_candidates()`
function to retrieve all targeted candidates in bounded pages; `ContactService`
then applies the shared pairwise rule and raises a safe duplicate warning. A
deliberate manual override remains reserved for the later server-actions task.

RLS exposes active contacts to management and gives representatives read access
when they created or were assigned the contact, or can access its company through
ownership or an assigned lead. Company/Lead-derived access is read-only;
representatives may update only contacts they created or are assigned. Inactive
and unrelated users are denied. Ordinary table reads hide soft-deleted contacts
and contacts whose company is soft-deleted; active CEO/Admin and Sales Manager
users can retrieve archived records only through the explicit
`list_archived_contacts()` function. Hard deletion is not permitted.

All Supabase access for Contacts is isolated in `SupabaseContactRepository`.
Ordinary reads exclude archived records, list/search queries are capped at 100
records with a default of 25, and primary sorting always has an `id` tiebreaker.
`ContactService` resolves business authorization before mutation: management can
manage assignments, while representatives may update only records they created
or are assigned and may self-assign only their own currently unassigned contact.
Company- or Lead-derived visibility remains read-only, with RLS as the final
database boundary.

Contacts server actions resolve the authenticated profile and construct the
`ContactActor` on the server before invoking `ContactService`; form values cannot
provide role, creator or deletion authority. Create, update and soft-delete map
validation, permission, duplicate and not-found failures into typed safe states
and return cache-revalidation/redirect metadata consumed by the Contact UI.

Likely duplicates receive a Contact-specific ten-minute HMAC token bound to the
actor, operation, target Contact for updates, normalized payload hash and a
unique confirmation UUID. Confirmed create and update use transaction-scoped,
`SECURITY INVOKER` PostgreSQL functions. The confirmation ledger stores only
bindings, a SHA-256 payload hash and the resulting Contact ID; successful retries
return that original ID and never reapply the mutation. RLS and the existing
assignment/company rules remain the final mutation boundary.

The protected Contact UI provides `/contacts`, `/contacts/new`,
`/contacts/[contactId]` and `/contacts/[contactId]/edit`. The active list uses
canonical URL state and bounded 25-record server pages. Search covers names,
public emails, phones, WhatsApp and LinkedIn; filters cover status, Company,
assignee, creator and primary-contact state. Safe sorting supports name, job
title, department, status and Contact timestamps, with deterministic `id`
tiebreaking. Create and edit share one accessible form, duplicate warnings expose
candidate IDs only and require explicit signed confirmation, and successful or
replayed mutations navigate to the original Contact result. Archive remains an
explicit management-only soft-delete action.

### Leads database foundation

A Lead is a potential sale before it becomes an Opportunity. Its pipeline stages
are `new`, `researching`, `ready_to_contact`, `contacted`, `replied`, `qualified`,
`meeting_scheduled`, `quotation_requested`, `quotation_sent`, `negotiation`,
`converted`, `lost` and `disqualified`. `converted` means ready for future
Opportunity creation; deposits, shooting, editing and delivery are deliberately
excluded. Operational status (`active`, `paused`, `closed`), qualification and
soft deletion remain separate concepts. Priority is `low`, `normal`, `high` or
`urgent`; score is nullable and constrained to 0–100, and optional money uses a
non-negative numeric value with an uppercase three-letter currency defaulting to
`MYR`.

`company_id` is nullable for legitimate independent inbound or referral prospects.
Linked Companies use `ON DELETE RESTRICT`; an optional primary Contact must be
active and have exactly the same Company relationship, while Contact deletion
only clears that optional link. The legacy `primary_source_id` remains nullable
for compatibility, while new provenance is stored directly on the Lead. Outcome
timestamps and reasons are constrained so converted, lost and disqualified states
cannot overlap.

Lead fingerprints are indexed but non-unique. Title or Company alone never marks
an exact duplicate. Likely-duplicate evidence combines Company with campaign,
source, Contact, service or normalized title; explicitly different campaigns are
not blindly merged. This preserves multiple legitimate needs per Company and a
future manual override workflow.

Ordinary RLS reads expose active Leads only. Company-derived representative access
is read-only; representatives need creator or assignee ownership to update and may
only self-assign an unassigned Lead they created. Management may assign active
profiles and archive Leads. Archived Leads, including those hidden by an archived
Company, are available only through `list_archived_leads()`. Hard delete has no
authenticated policy, and existing Signals, Activities, Tasks and Opportunities
use restrictive Lead foreign keys to preserve sales history.

### Leads server actions

Lead create, update, archive and restore mutations resolve the authenticated actor
on the server and call `LeadService`; client input never supplies role, ownership or
archive fields. Likely duplicates return candidate IDs and a short-lived HMAC token
bound to actor, operation, target Lead and the canonical normalized payload.

Confirmed duplicate mutations use `create_confirmed_duplicate_lead` and
`update_confirmed_duplicate_lead`. These SECURITY INVOKER RPCs keep Lead writes
RLS-bound while locked-down trigger helpers atomically claim and finalize a
persistent confirmation ledger in the same transaction. Replays return the
original Lead ID, failed mutations roll back their claim, and no form payload is
stored in the ledger.

## Quality checks

```bash
npm audit --omit=dev --audit-level=high
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run test:e2e:authenticated
```

The existing `playwright.config.ts` remains the 16-test, read-only demo-preview
UX suite on port 3000. TEST-010 adds a separate serial browser lane on port 3001
using `playwright.authenticated.config.ts`, one worker and a disposable local
Supabase stack. It uses real Auth cookies, PostgREST, RLS, Company server actions
and H7 audit triggers. Only the outbound AI provider is deterministic, and no
`OPENAI_API_KEY` is permitted.

To run the authenticated lane locally, install Docker, a PostgreSQL 17-compatible
`psql` client, Node.js 20.9+ and Chromium. Use only a disposable checkout with no
remote Supabase link:

```bash
export LAPARPO_AUTHENTICATED_E2E=true
export LAPARPO_E2E_AI_STUB=true
export MUTATION_AUDIT_CORRELATION_SECRET=local-test-only-correlation-secret-at-least-32-chars
bash scripts/authenticated-e2e/start-local-supabase.sh
npx playwright install chromium
npm run test:e2e:authenticated
npx --yes supabase@2.39.2 stop --no-backup --workdir .
```

The setup pins Supabase CLI `2.39.2`, starts Docker-backed local services, and
applies the repository's actual 001–023 migrations. It creates retry-safe confirmed Auth
users through the local Admin API, promotes their Profiles through the local database
owner, and keeps the service-role key, database URL and random password in an
ignored chmod-600 fixture file. Those credentials are never passed to Next or
browser storage by fixture setup. Do not run `supabase link`, `supabase db push`
or substitute a remote project. These commands are local/CI test infrastructure;
the H6 production migration runbook is unchanged.

GitHub Actions performs a production-dependency audit, lint, type checking,
Vitest and a production build. Its disposable PostgreSQL job covers migration
ordering and legacy upgrade fixtures; general RLS and CRM database smoke tests;
profile privilege, Company hard-delete/soft-delete and immutable creation
metadata hardening; Companies, Contacts, Leads and Lead Activities; conversion,
retry, concurrency, immutable ledger and restore behavior; and Opportunity
list/detail/pipeline, CAS and Won/Lost concurrency. The demo Playwright suite
covers preview UX, while the isolated TEST-010 job covers real login/session
persistence, Company create/read/archive, database persistence, H7 correlation,
transient AI rendering, soft-delete authorization and logout. This summary is
categorical: the workflow itself is authoritative for
the exact current test steps. The same authenticated lane now also covers the
read-only Opportunity summary over seeded synthetic pipeline rows, authorization
exclusions, unchanged database/H7 state and transient rendering. AI tests use
fakes and captured request objects; CI never needs `OPENAI_API_KEY` and never
calls OpenAI.

## Manual test checklist

1. With no Supabase variables and `LAPARPO_DEMO_MODE=true` outside production,
   verify all modules render in visibly labelled read-only demo preview mode.
2. With Supabase configured and no session, verify `/`, `/leads` and other dashboard routes redirect to `/login`.
3. Verify invalid credentials show a generic error.
4. Verify an inactive profile cannot enter the dashboard.
5. Verify a Sales Representative cannot open `/campaigns` or `/settings`.
6. Verify a Sales Manager can open `/campaigns` but not `/settings`.
7. Verify a CEO/Admin can access every module and create sourced company, contact and lead records.
8. Test duplicate name, domain, phone and location variations.
9. Check loading, empty and error states on mobile and desktop.
10. Create a sourced company, confirm a duplicate warning where applicable, edit
    the company, then soft-delete it from the Companies list.
11. Search and filter Companies, change its sort order, navigate between result
    pages, and confirm that refreshing or sharing the URL restores the same state.
12. Create and edit a sourced Contact, review an intentional duplicate warning,
    confirm or revise it, open the details route, and archive as management.
13. Search and filter Contacts, change sorting, navigate pages, refresh the page
    and confirm the canonical URL restores the same result state.
14. In controlled staging with an approved OpenAI project, generate Company
    intelligence for an accessible Company, verify the result is labelled
    non-binding and transient, and confirm an inaccessible Company cannot invoke
    the provider. Do not use Contact PII or private notes.
15. From `/opportunities/pipeline`, explicitly generate the AI Pipeline Summary,
    confirm only accessible active Opportunities appear, follow only ordinary
    detail links, reload to clear the result, and verify no stage, owner,
    probability, value or H7 history changed.

## Known limitations

- The Company details route includes the verified profile and transient public
  Company intelligence, but timeline, analytics and Contact workflows are not
  implemented.
- Company and assignee controls use validated UUID inputs. Bounded searchable
  selectors and profile display names remain deferred to avoid full-table reads.
- Contact confirmation ledger cleanup/retention automation is not yet scheduled.
- Lead management, activities, conversion and restore workflows and the
  Opportunity list/detail/pipeline workspace are implemented. Quotations,
  finance workflows and follow-up reminder automation are not implemented.
- Account invitation, password reset and role-management screens are not implemented.
- Company intelligence and Opportunity pipeline summarization do not persist,
  bulk-process, discover, scrape, browse, ingest websites, process Contact PII
  or mutate CRM data. TEST-010 is covered;
  durable distributed AI rate limiting, retained logs, provider approvals,
  spend controls, `safety_identifier`, Contact PII and URL-ingestion policy remain
  gates before broad AI production rollout.
- External discovery, web ingestion and scheduled jobs are not implemented.
- Dashboard metrics remain placeholders.
