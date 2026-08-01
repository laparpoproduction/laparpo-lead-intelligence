# Company intelligence quality evaluation

## Evaluation status

`LIVE-TERRA-EVAL-NOT-RUN`

No `OPENAI_API_KEY` was available in the authorized remediation environment.
No live result is claimed. CI and the local validation suite make zero live
OpenAI calls; their evidence is deterministic and provider-stubbed.

## Deterministic A–J report

The assertions live in
`src/lib/ai/company-intelligence.quality-evaluation.test.ts`. They validate the
closed code/evidence contract and deterministic renderer. They do not compare or
scan arbitrary model prose because the provider schema contains no prose field.

| ID | Company category | Profile code | Accepted signal | Rejected example | Gap behavior | Recommendation | Confidence behavior |
|---|---|---|---|---|---|---|---|
| A | Well-populated F&B | Well populated | F&B/content fit | Agency | No false website gap | Content-fit assessment | Medium |
| B | Sparse F&B | Sparse | F&B only | Website present | Missing industry/description/location/website | Clarify industry/location | Low |
| C | Agency | Well populated | Agency/production fit | F&B | Missing branch count accepted | Production-fit assessment | Medium |
| D | Hotel | Well populated | Hotel/content fit | Agency | No false description gap | Content-fit assessment | Medium |
| E | Non-F&B / other | Well populated | Other profile | Content fit | No false city gap | Public-positioning review | Medium |
| F | Missing location | Partial | F&B | Location present | City/state gaps accepted | Clarify location | Medium |
| G | Missing industry | Partial | Description present | Agency | Industry gap accepted | Clarify industry | Medium |
| H | Arbitrary untrusted metadata | Partial | Other profile | Website present | Invalid website/source gaps accepted | Public-profile review | Medium from structure only |
| I | Long-but-valid input | Well populated | F&B/description/website | Agency | No false website gap | Public-positioning review | Medium |
| J | Unicode business name | Well populated | F&B/location | Hotel | No false description gap | Public-profile review | Medium |

Fixture I serializes to exactly 7,583 UTF-8 bytes, or 92.57% of the 8,192-byte
ceiling. Every field remains within its individual limit. The test proves the
provider is called exactly once with the complete serialized projection unchanged
and that no truncation occurs.

The deterministic negative controls prove that incompatible Company-category
codes, absent-field evidence, present-field gaps, duplicate or irrelevant
evidence and duplicate codes are rejected before rendering. Confidence is not a
provider field: the application derives Low for a validated sparse profile and
Medium for validated partial or well-populated profiles. Arbitrary free-form
metadata cannot change that structural rule, and High is unavailable in Phase
1A. The schema itself has no place to express free-form CRM/contact
commands, URLs, external-verification claims, named customers or campaigns,
revenue, staffing, awards or market share. Dedicated security tests inject
representative strings as extra properties, invalid enum values, invalid evidence
and invalid types and prove that strict parsing fails.

All visible text comes from application-owned templates. Renderer tests cover
every allowed profile, signal, gap and recommendation code; recommendations are
non-binding and the renderer produces no href, contact destination, CRM command,
generated URL or external-verification claim. These deterministic tests establish
schema safety and grounding constraints, not live-model code-selection quality.

## Manual Terra procedure

A live evaluation is optional and must remain explicit:

1. Use an approved local/staging OpenAI project and set the key only in the
   server runtime.
2. Use only the ten synthetic GREEN fixtures from
   `company-intelligence.test-fixtures.ts`; never load a real CRM Company.
3. Invoke the existing server-side provider contract with `gpt-5.6-terra`,
   `store: false`, low reasoning effort, 1,200 output tokens, a 20-second timeout,
   zero retries and no tools or web search.
4. Record only pass/fail judgments for valid code selection, relevant evidence,
   gap consistency and application-derived confidence. Do not record prompts,
   serialized projections, URLs, raw structured output or provider errors.
5. Keep the procedure outside ordinary `npm test`, build, Playwright and CI.
6. If any schema, evidence, gap, incompatible-code or confidence-derivation
   check fails, treat the live evaluation as failed; do not weaken the closed
   contract.

TEST-010, a durable distributed limiter, provider project controls and retained
privacy-safe operational logging remain broad-production gates.
