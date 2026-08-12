# Opportunity pipeline summary quality evaluation

## Evaluation status

`LIVE-TERRA-EVAL-NOT-RUN`

CI and ordinary local validation make zero live OpenAI calls. Provider behavior
is tested through captured request objects and a deterministic server-only E2E
provider; no live Terra model quality is claimed.

## Deterministic A–M matrix

The unit quality matrix plus the authenticated L/M browser journey cover:

| ID | Portfolio | Grounded behavior |
| --- | --- | --- |
| A | Empty active pipeline | Empty overview; no invented focus |
| B | New only | No invented attention facts when metadata is complete |
| C | Passed expected-close date | Server-date-derived overdue code |
| D | Multiple unassigned | Every null owner is identified |
| E | Recorded MYR values | NULL, RM0, RM1, equal and large values create no value-based focus |
| F | Quotation Sent | Quotation follow-up code |
| G | Negotiation | Negotiation follow-up code |
| H | Probability override | Persisted value preserved; human-review code only |
| I | Missing expected close | Null preserved; missing-date code |
| J | Mixed portfolio | Multiple compatible grounded facts |
| K | Terminal only | Won/Lost represented only through counts |
| L | Representative RLS | Real Auth/read-model journey proves inaccessible rows affect neither details nor counts |
| M | 120 active rows | Real database path analyzes 75, keeps full counts and renders limited coverage |

Strict-schema tests reject unknown enums, free-form text, URLs, commands,
confidence, probability recommendations, extra nested properties, more than
three focus areas and more than five UUIDs per focus. Semantic tests reject
invented/inaccessible/terminal/wrong-predicate UUIDs, duplicate focus codes,
duplicate UUIDs and a model-controlled overview classification. Invalid output
is rejected as a whole rather than partially filtered into a success result.
Before Zod normalization, the provider's raw structured text is independently
JSON-parsed and recursively inspected through own property names. Top-level and
nested `__proto__`, `constructor`, `prototype`, accessors and non-standard
prototypes fail closed; malformed raw JSON is never rendered or logged.

The provider projection has a 75-row database/query ceiling and a 32,768-byte
UTF-8 ceiling. Six fixed category queries contribute at most 10 new unique rows
each, in this order: overdue by expected-close/update/UUID; then unassigned,
Quotation Sent, Negotiation, probability override and missing close by
update/UUID. Every query excludes already-selected IDs. A final update/UUID
fallback requests only the remaining capacity. The projection contains no
recorded value, Company name, Lead title, Contact PII, notes, Profile identity,
auth/session value or H7 audit data. Exact six-stage counts remain separate and
cover the actor's full RLS-authorized dataset.

The authenticated TEST-010 lane seeds synthetic rows only in disposable local
Supabase. The management browser proof remains read-only. A separate real Sales
Representative fixture has exactly 120 readable active Opportunities, two
readable terminal rows and six RLS-inaccessible active rows. Its recently updated
overdue, unassigned, Quotation Sent, Negotiation, override and missing-close rows
would be missed by the former oldest-only query. The browser traverses real Auth,
SSR, server action, repository, security-invoker view and RLS; the deterministic
provider observes exactly 75 rows, full stage counts remain 116/2/1/1/1/1,
`limited_pipeline_data` and 75-of-120 coverage are visible, the forbidden row is
absent, database/H7 state is unchanged and reload removes the result. The
original Company journey is retained unchanged and no live OpenAI call occurs.

## Remaining production gates

The five-second cooldown and five-request/minute actor window are enforced by
the shared migration-024 database RPC for Phase 1A and 1B. The zero-argument RPC
derives the active actor from authenticated database context, uses database time
and atomically locks bounded per-actor state. Broad production rollout still
requires retained privacy-safe operational logging, provider privacy and
project approval, provider spend controls/alerts, a `safety_identifier` policy,
Contact PII policy and future URL-ingestion/SSRF policy. Phase 1B does not claim
sales prediction, AI probability, revenue forecasting or full AI production
readiness.
