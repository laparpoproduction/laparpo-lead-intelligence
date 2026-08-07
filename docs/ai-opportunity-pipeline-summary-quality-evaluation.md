# Opportunity pipeline summary quality evaluation

## Evaluation status

`LIVE-TERRA-EVAL-NOT-RUN`

CI and ordinary local validation make zero live OpenAI calls. Provider behavior
is tested through captured request objects and a deterministic server-only E2E
provider; no live Terra model quality is claimed.

## Deterministic A–M matrix

`src/lib/ai/opportunity-pipeline-summary.quality-evaluation.test.ts` covers:

| ID | Portfolio | Grounded behavior |
| --- | --- | --- |
| A | Empty active pipeline | Empty overview; no invented focus |
| B | New only | No invented attention facts when metadata is complete |
| C | Passed expected-close date | Server-date-derived overdue code |
| D | Multiple unassigned | Every null owner is identified |
| E | Recorded MYR values | Deterministic top-five ranking; null is never RM0 |
| F | Quotation Sent | Quotation follow-up code |
| G | Negotiation | Negotiation follow-up code |
| H | Probability override | Persisted value preserved; human-review code only |
| I | Missing expected close | Null preserved; missing-date code |
| J | Mixed portfolio | Multiple compatible grounded facts |
| K | Terminal only | Won/Lost represented only through counts |
| L | Representative subset | Omitted/RLS-inaccessible UUID cannot enter projection |
| M | Above row limit | More than 75 candidates rejected before provider use |

Strict-schema tests reject unknown enums, free-form text, URLs, commands,
confidence, probability recommendations, extra nested properties, more than
three focus areas and more than five UUIDs per focus. Semantic tests reject
invented/inaccessible/terminal/wrong-predicate UUIDs, duplicate focus codes,
duplicate UUIDs and a model-controlled overview classification. Invalid output
is rejected as a whole rather than partially filtered into a success result.

The provider projection has a 75-row database/query ceiling and a 32,768-byte
UTF-8 ceiling. It contains no Company name, Lead title, Contact PII, notes,
Profile identity, auth/session value or H7 audit data. Application tests prove
that the browser supplies no dataset and that only the server-authorized read
model builds the projection. Renderer tests prove visible language comes from
fixed application templates and that authorized labels are resolved after
semantic validation.

The authenticated TEST-010 lane seeds synthetic rows only in disposable local
Supabase. A second browser proof logs in normally, visits the real pipeline,
triggers the action, validates grounded application-rendered categories, proves
archived/terminal detail rows are absent, compares database state and H7 counts
before/after, reloads to prove transience and asserts exactly one deterministic
provider call with zero live OpenAI traffic. The original Company journey is
retained unchanged.

## Remaining production gates

The five-second cooldown and five-request/minute actor window are local
in-runtime controls, not durable distributed limiting. Broad production rollout
still requires retained privacy-safe operational logging, provider privacy and
project approval, provider spend controls/alerts, a `safety_identifier` policy,
Contact PII policy and future URL-ingestion/SSRF policy. Phase 1B does not claim
sales prediction, AI probability, revenue forecasting or full AI production
readiness.
