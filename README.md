# Laparpo Lead Intelligence

Sales-assistance software for Laparpo Production. The product is designed to turn legitimate public business signals into qualified conversations, appointments, quotations and deposits.

## Sprint 1 scope

- Next.js App Router with strict TypeScript and Tailwind CSS
- Supabase SSR authentication with protected routes
- Core PostgreSQL schema, duplicate protections and row-level security
- Responsive Laparpo dashboard shell with loading, empty and error states
- Zod validation for public lead inputs and environment variables
- Evidence-aware lead scoring foundation
- Vitest unit tests and a Playwright dashboard smoke test

The dashboard shows a safe setup preview when Supabase environment variables are absent in local development. When the variables are present, authentication is enforced.

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
5. Apply `supabase/migrations/202607110001_sprint_1_core_schema.sql` using the Supabase CLI or dashboard SQL editor.
6. Create the first user through Supabase Auth.
7. Start the app:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Visibility | Required now | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Yes for auth | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server | Yes for auth | Supabase publishable or legacy anon key |
| `OPENAI_API_KEY` | Server only | No | Reserved for an AI sprint |
| `LOG_LEVEL` | Server only | No | Logging threshold; defaults to `info` |

Never expose the OpenAI API key or a Supabase service-role key through a `NEXT_PUBLIC_` variable.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Playwright requires a browser once per environment:

```bash
npx playwright install chromium
```

## Database design notes

- Companies are deduplicated by normalized name and country, with an additional unique website-domain guard.
- Contacts are deduplicated by company plus normalized email or phone.
- Every lead requires a matching primary source URL and discovery timestamp.
- AI-inferred signals must be explicitly labelled with `ai_inferred` and include an evidence URL and confidence score.
- Row-level security restricts operational data to authenticated team members.

## Manual test checklist

1. With no Supabase variables, `/` displays the labelled setup preview.
2. With valid Supabase variables and no session, `/` redirects to `/login`.
3. Invalid login details show a generic error and never reveal whether an account exists.
4. A valid Supabase user can sign in and reach the dashboard.
5. Check the layout at mobile, tablet and desktop widths.
6. Confirm the dashboard contains explicit empty, loading and recoverable error states.

## Known Sprint 1 limitations

- The dashboard data is intentionally empty; lead CRUD and importing are not part of this sprint.
- Account invitation, password reset and role-management screens are not yet implemented.
- Lead scoring is a tested domain foundation but is not yet connected to persisted signals.
- Vercel deployment and scheduled discovery jobs will be added when a live Supabase project and discovery sprint are available.

## Recommended Sprint 2

Build lead management: add/edit forms, source capture, duplicate detection feedback, searchable lead table, contact management and pipeline status transitions.
