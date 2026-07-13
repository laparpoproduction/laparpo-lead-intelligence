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
5. Apply migrations in filename order:
   - `202607110001_sprint_1_core_schema.sql`
   - `202607110002_align_foundation_schema.sql`
   - `202607110003_crm_companies_foundation.sql`
   - `202607110004_companies_soft_delete.sql`
   - `202607110005_companies_rls_and_duplicate_candidates.sql`
   - `202607110006_company_mutation_idempotency.sql`
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
| `OPENAI_API_KEY` | Server only | No | Reserved for a later AI sprint |
| `LOG_LEVEL` | Server only | No | Logging threshold; defaults to `info` |

Never expose the OpenAI API key or a Supabase service-role key through a `NEXT_PUBLIC_` variable.
Production builds fail during Next.js configuration when
`COMPANY_DUPLICATE_CONFIRMATION_SECRET` is missing or shorter than 32 characters.
Tests and local development may omit it until duplicate confirmation is exercised;
production-like local builds must provide an explicit test-only value.

## Database architecture

The migrations provide:

- `profiles` with CEO/Admin, Sales Manager and Sales Representative roles
- `companies` with public source metadata, normalized contact fields, social URLs,
  full address, location and fingerprint
- `contacts` with public contact details and evidence URL
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
The list uses a configurable 25-record page size and carries pagination metadata
for a later controls task. Company rows open a protected details route with a
verified-record placeholder; timeline, analytics and contact workflows remain
separately scoped.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

GitHub Actions applies all migrations to PostgreSQL and runs the general RLS test
plus `supabase/tests/companies_smoke.sql`. The company test verifies normalization,
source provenance, management creation, representative ownership and isolation.

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

## Known limitations

- Companies listing currently shows the first 25 active records without search,
  filters or pagination controls; those workflows are intentionally deferred.
- The company details route is a protected placeholder only; timeline, analytics
  and contact workflows are not implemented.
- Account invitation, password reset and role-management screens are not implemented.
- Automated discovery, OpenAI enrichment, external scraping and scheduled jobs are not implemented.
- Dashboard metrics remain placeholders until lead-management workflows are delivered.

## Recommended next sprint

Add Companies search and pagination before beginning the separately scoped Contacts
and Leads modules.
