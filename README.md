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
2. Install dependencies:

   ```bash
   npm install
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
5. Apply migrations in filename order:
   - `202607110001_sprint_1_core_schema.sql`
   - `202607110002_align_foundation_schema.sql`
   - `202607110003_crm_companies_foundation.sql`
   - `202607110004_companies_soft_delete.sql`
   - `202607110005_companies_rls_and_duplicate_candidates.sql`
   - `202607110006_company_mutation_idempotency.sql`
   - `202607110007_contacts_foundation.sql`
   - `202607110008_contacts_duplicate_candidates.sql`
   - `202607110009_contact_mutation_idempotency.sql`
6. Create the first user through Supabase Auth and promote that account to `ceo_admin`.
7. Start the app:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

The dashboard shows a labelled setup preview when Supabase variables are absent. Authentication and RLS are enforced once Supabase is configured.

## Environment variables

| Variable | Visibility | Required now | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Yes for auth | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server | Yes for auth | Supabase publishable or legacy anon key |
| `COMPANY_DUPLICATE_CONFIRMATION_SECRET` | Server only | Yes for company mutations | Signs short-lived duplicate confirmation tokens; use at least 32 random characters |
| `CONTACT_DUPLICATE_CONFIRMATION_SECRET` | Server only | Yes for contact mutations | Signs namespaced, short-lived Contact confirmation tokens; use at least 32 random characters |
| `OPENAI_API_KEY` | Server only | No | Reserved for a later AI sprint |
| `LOG_LEVEL` | Server only | No | Logging threshold; defaults to `info` |

Never expose the OpenAI API key or a Supabase service-role key through a `NEXT_PUBLIC_` variable.
Production builds fail during Next.js configuration when
either duplicate-confirmation secret is missing or shorter than 32 characters.
Tests and local development may omit them until duplicate confirmation is exercised;
production-like local builds must provide an explicit test-only value.

## Database architecture

The migrations provide:

- `profiles` with CEO/Admin, Sales Manager and Sales Representative roles
- `companies` with public source metadata, normalized contact fields, social URLs,
  full address, location and fingerprint
- `contacts` with optional company ownership, public professional details,
  source provenance, assignment, lifecycle status, soft delete and a non-unique
  duplicate signal
- `leads` with ownership, score confidence, value, service and follow-up fields
- `lead_signals`, `lead_activities` and `sales_tasks`
- compatibility tables for `lead_sources` and `opportunities`

Every new company requires a public source URL and discovery timestamp. Every lead remains tied to a matching company source. RLS lets management see the sales workspace while representatives see records they created, own or are assigned.

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
placeholder; timeline, analytics and contact workflows remain separately scoped.

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

## Quality checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

GitHub Actions applies all migrations to PostgreSQL and runs the general RLS test,
`supabase/tests/companies_smoke.sql`, `supabase/tests/contacts_smoke.sql` and
`supabase/tests/contact_actions_smoke.sql`. The
Contacts test verifies normalization, provenance, non-unique duplicate signals,
nullable company relationships, management/representative access, archived-record
isolation and safe company relationships.

## Manual test checklist

1. With no Supabase variables, verify all seven modules render in setup preview mode.
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

## Known limitations

- The company details route is a protected placeholder only; timeline, analytics
  and contact workflows are not implemented.
- Company and assignee controls use validated UUID inputs. Bounded searchable
  selectors and profile display names remain deferred to avoid full-table reads.
- Contact confirmation ledger cleanup/retention automation is not yet scheduled.
- Account invitation, password reset and role-management screens are not implemented.
- Automated discovery, OpenAI enrichment, external scraping and scheduled jobs are not implemented.
- Dashboard metrics remain placeholders until lead-management workflows are delivered.

## Recommended next sprint

Plan the separately scoped Leads CRM foundation without adding messaging,
discovery, AI enrichment or unrelated Contacts features.
