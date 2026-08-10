# Lead Follow-up Queue quality evaluation

## Scope and status

The Lead Follow-up Queue is a deterministic, permission-aware, read-only CRM
view. It is not an AI feature and does not invoke OpenAI or any other model.
Model-backed AI Phase 1C remains **NO-GO**. `LIVE-TERRA-EVAL-NOT-RUN` is
unchanged and is not relevant to this queue's deterministic correctness.

The queue is generated only after an actor selects **Review follow-up
priorities** on `/leads`. Results exist only in React action state and disappear
on reload. No PostgreSQL row, cache history, cookie, browser storage, URL state,
Activity or H7 mutation event is created.

## Authorization and data boundary

The server derives the active authenticated Profile and creates the ordinary
session Supabase client. Existing Lead RLS determines all parent rows. A
PostgREST empty embedded relation uses the named
`opportunities_lead_id_fk` relationship and `is.null` filtering to exclude any
Lead with an Opportunity visible through the same session. Opportunity SELECT
RLS uses `can_access_lead(lead_id)`, so a readable Lead's related Opportunities
share the Lead authorization boundary. The embedded relation returns no
Opportunity fields to application code.

Both exact full-dataset counts and every bounded category query share the same
base filters and anti-join. Base eligibility requires an active, non-archived,
non-unqualified Lead in one of `new`, `researching`, `ready_to_contact`,
`contacted`, `replied`, `qualified`, `meeting_scheduled` or
`quotation_requested`. Existing RLS hides inaccessible Leads, archived Leads and
Leads whose Company is archived. Paused/closed Leads, terminal stages,
`quotation_sent`, `negotiation` and Leads with active or terminal Opportunities
are excluded.

## Closed attention taxonomy

The seven application-owned categories, in priority order, are:

1. `overdue_follow_up`
2. `expected_close_passed`
3. `replied_needs_review`
4. `ready_to_contact_without_contact_record`
5. `qualified_needs_progress`
6. `missing_follow_up`
7. `unassigned_active`

Timestamp predicates use one authoritative server `Date` per request. Timestamp
comparison is by instant; expected-close comparison uses the UTC date derived
from that same `Date`. Due-now follow-ups are not overdue. Today is not a passed
expected-close date.

Each category contributes at most six new unique Leads. Already-selected UUIDs
are excluded from every later database query. An oldest-`updated_at` fallback
requests only remaining capacity, contains only Leads with at least one
configured signal and cannot increase the candidate set above 50. Application
classification uses the same fixed category priority, displays at most three
categories and at most five Leads per displayed category.

## Counts and coverage honesty

The repository returns exactly:

- `eligibleAccessibleLeadCount` for the full RLS-authorized eligible dataset;
- `configuredAttentionLeadCount` for the full eligible dataset matching at least
  one of the seven predicates.

Neither count is derived from the bounded candidates. If the configured count
exceeds the analyzed candidate count, the UI reports the exact X-of-Y coverage
and states that the category-aware review may omit other matching Leads. It does
not infer full-dataset absence from the candidate sample.

## Privacy and prioritization boundary

The explicit read projection contains only Lead ID, title, stage, operational
status, qualification status, human priority, service interest, assignee
presence, next follow-up timestamp, last-contacted timestamp, expected-close
date and update timestamp. Display data is derived only from those already
authorized candidates.

The queue does not retrieve Contact identity or PII, Lead free-form notes,
business/budget/timeline/decision-maker prose, next-step prose, source metadata,
Activity rows or prose, lead score, estimated value, currency or reasons for
lost/disqualified state. Human priority may be displayed but never affects base
eligibility, category membership, query order, candidate order or wording.
Money and lead score never affect the queue.

## Automated evidence

Unit/repository/component tests cover base exclusions, all seven predicates,
boolean grouping, overlap priority, deduplication, six-per-category allocation,
remaining-capacity fallback, the 50-row maximum, overview precedence,
RFC3339 offsets and fractions, yesterday/today/tomorrow boundaries, strict row
shape, safe errors, escaped script-like titles, Unicode, no mutation controls and
forbidden prose rejection.

The authenticated disposable-Supabase journey adds a real representative
fixture with direct, assigned and Company-derived readable Leads, an inaccessible
Lead, every excluded state, active and terminal Opportunity parents, all seven
attention categories, malicious excluded prose, one Activity and 80 accessible
configured-attention Leads. An ordinary authenticated session client proves the
relationship anti-join, exact 81 eligible/80 attention counts, 50 unique bounded
candidates and presence of all seven recent category representatives. The browser
then traverses real Auth, SSR/server action, Lead service, Lead repository,
PostgREST and RLS. Lead, Opportunity, Activity and H7 state hashes remain
unchanged, no OpenAI request occurs and reload removes the result.

Migrations remain exactly 001–023. Migration 024 is absent. RLS, schema, SQL,
RPCs, SECURITY DEFINER functions, package manifests and dependencies are
unchanged.
