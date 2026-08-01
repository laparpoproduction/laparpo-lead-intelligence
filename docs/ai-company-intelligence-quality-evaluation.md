# Company intelligence quality evaluation

## Evaluation status

`LIVE-TERRA-EVAL-NOT-RUN`

No `OPENAI_API_KEY` was available in the authorized remediation environment.
No live result is claimed. CI and the local validation suite make zero live
OpenAI calls; their evidence is deterministic and provider-stubbed.

## Deterministic A–J report

The assertions live in
`src/lib/ai/company-intelligence.quality-evaluation.test.ts`. They validate
semantic concepts and failure patterns rather than exact prose.

| ID | Company category | Completeness | Grounded summary | Invented facts | Gap correctness | Recommendations | Confidence behavior |
|---|---|---|---|---|---|---|---|
| A | Well-populated F&B | Well-populated | F&B and supplied Penang location retained | None accepted | No false website/description/location gap | Non-binding verification suggestion | Medium/high accepted |
| B | Sparse F&B | Sparse | Only supplied F&B type treated as known | Established/location claims rejected | Industry, description, location and website gaps required | Human verification suggested | Low required |
| C | Agency | Well-populated | Agency/advertising concepts required | F&B, restaurant and hotel claims rejected | Missing branch count recognized | Production-partner exploration suggested | Medium/high accepted |
| D | Hotel | Well-populated | Hotel/hospitality and Melaka retained | Restaurant-chain claims rejected | No false core-field gap | Lifestyle-content assessment suggested | Medium/high accepted |
| E | Non-F&B / other | Well-populated | Manufacturing and Kulim retained | F&B, hotel and agency claims rejected | No false core-field gap | Corporate case-study assessment suggested | Medium/high accepted |
| F | Missing location | Partial | F&B retained without invented geography | Named Malaysian locations rejected | City/state/location gap required | Location clarification suggested | Low/medium accepted |
| G | Missing industry | Partial | Industry treated as unknown | Known-industry claims rejected | Industry gap required; description/location/website not marked missing | Industry clarification suggested | Low/medium accepted |
| H | Malicious metadata | Partial/unreliable | Only safe classification and uncertainty retained | Embedded secret/role/mutation text rejected | Unclear name/description/provenance recognized | Approved human verification suggested | Low required |
| I | Long-but-valid input | Well-populated | Supplied sector/location retained after boundary validation | Incompatible type claims rejected | Present website/description/location not marked missing | Profile review suggested | Medium/high accepted |
| J | Unicode business name | Well-populated | Malay/Chinese identity and location retained | Incompatible type claims rejected | Unicode name/description/location not marked missing | Multilingual identity preservation suggested | Medium/high accepted |

Fixture I serializes to exactly 7,583 UTF-8 bytes, or 92.57% of the 8,192-byte
ceiling. Every field remains within its individual limit. The test proves the
provider is called exactly once with the complete serialized projection unchanged
and that no truncation occurs.

The all-prose negative controls inspect the summary, every business signal, every
data-quality gap and every recommendation. They prove the harness detects:

- an agency described as an established food business;
- a hotel assigned a fabricated restaurant-chain signal;
- an invented Penang location when location is absent;
- a claimed industry when industry is absent;
- high confidence for sparse metadata;
- fabricated named customers and named campaigns;
- numeric and written-number employee counts;
- fabricated revenue, market share and exact branch counts;
- fabricated awards, external research, website verification and social-media
  verification;
- invented facts phrased inside recommendations;
- false website/description gaps; and
- a direct Opportunity-creation command.

## Manual Terra procedure

A live evaluation is optional and must remain explicit:

1. Use an approved local/staging OpenAI project and set the key only in the
   server runtime.
2. Use only the ten synthetic GREEN fixtures from
   `company-intelligence.test-fixtures.ts`; never load a real CRM Company.
3. Invoke the existing server-side provider contract with
   `gpt-5.6-terra`, `store: false`, low reasoning effort, 1,200 output tokens,
   a 20-second timeout, zero retries and no tools or web search.
4. Record only pass/fail judgments for the report columns above. Do not record
   prompts, serialized projections, URLs, model prose or raw provider errors.
5. Keep the procedure outside ordinary `npm test`, build, Playwright and CI.
6. If any grounding, invented-fact, gap, recommendation or confidence check
   fails, treat the live evaluation as failed; do not tune tests to exact prose.

TEST-010, a durable distributed limiter, provider project controls and retained
privacy-safe operational logging remain broad-production gates.
