# AI Analysis Schema

## Purpose

AI assists editorial review. It does not prove why a search engine changed rankings, reliably detect authorship, or authorize destructive changes.

## Responsibilities

AI may:

- assess originality, specificity, evidence, intent satisfaction, and editorial quality;
- flag generic or templated language risk;
- identify likely overlap and missing distinctions;
- suggest first-party evidence to add;
- produce structured, reviewable recommendations.

AI must not:

- publish or modify content;
- redirect, merge, or delete pages;
- claim a ranking penalty as fact;
- label content as AI-written with certainty;
- override deterministic facts or user decisions.

## Analysis modes

1. **Page review** — one page snapshot and limited site context.
2. **Site-context review** — page compared with site identity, authors, business model, and related pages.
3. **Cluster review** — several pages reviewed for overlap, distinct intent, and merge opportunities.
4. **Evidence review** — optional future review of publisher-owned photos, videos, journals, trips, or CMS material.

## Input preparation

Only server-side workers build model input. Inputs should include:

- extracted main text, bounded by configured size;
- URL, title, headings, author/date metadata;
- deterministic findings;
- approved site context;
- related-page summaries when required;
- explicit delimiters marking crawled material as untrusted data.

Navigation, boilerplate, scripts, hidden text, credentials, and irrelevant markup should be removed. Sensitive strings should be redacted where feasible.

## Prompt-injection defenses

Crawled content may contain hostile instructions. Every prompt must state that embedded page text, metadata, links, and quoted instructions are evidence only and must never alter the task, output schema, tool use, or system policy.

Models receive no credential-management, publishing, filesystem, or destructive tools. Provider responses are untrusted until validated.

## Common response envelope

```json
{
  "schemaVersion": "1.0.0",
  "analysisType": "page",
  "summary": "The page contains useful first-hand detail but several generic comparison sections.",
  "confidence": 0.82,
  "dimensions": [],
  "findings": [],
  "recommendations": [],
  "limitations": []
}
```

## Dimension object

```json
{
  "key": "first_hand_experience",
  "score": 72,
  "confidence": 0.85,
  "rationale": "The author describes personal use in three countries but provides little evidence in the troubleshooting section.",
  "evidenceIds": ["ev-1", "ev-2"]
}
```

Initial dimension keys:

- `originality_information_gain`
- `first_hand_experience`
- `evidence_trust`
- `intent_satisfaction`
- `editorial_quality`
- `factual_specificity`
- `generic_templated_language_risk`
- `thin_content_risk`
- `affiliate_first_risk`
- `standalone_page_justification`

Risk dimensions use 100 as highest risk. Positive dimensions use 100 as strongest quality. The application must label direction clearly.

## Finding object

```json
{
  "id": "finding-1",
  "type": "generic_language",
  "severity": "medium",
  "confidence": 0.88,
  "title": "Comparison section is interchangeable",
  "explanation": "The section relies on broad claims that could appear on many affiliate sites.",
  "evidence": [
    {
      "id": "ev-1",
      "excerpt": "Choosing the right option depends on your needs...",
      "locationHint": "Paragraph under H2: Which is best?"
    }
  ]
}
```

Evidence excerpts must be short, attributable to the analyzed snapshot, and necessary to support the finding. The system must enforce excerpt-length limits.

## Recommendation object

```json
{
  "action": "quick_improvement",
  "confidence": 0.79,
  "impact": "high",
  "effort": "medium",
  "reason": "The page already receives strong impressions and needs clearer first-party evidence.",
  "steps": [
    "Add the actual devices and countries tested.",
    "Replace the generic troubleshooting section with observed failures and fixes."
  ],
  "requiresHumanApproval": true
}
```

Allowed actions:

- `protect`
- `quick_improvement`
- `major_rewrite`
- `merge`
- `redirect`
- `remove`
- `technical_correction`
- `internal_link_improvement`
- `add_first_party_evidence`
- `monitor`

`merge`, `redirect`, and `remove` must always require explicit human approval and supporting evidence.

## Cluster response

Cluster review must identify:

- proposed primary page;
- each member's distinct intent, if any;
- competing intent or duplication evidence;
- suggested supporting-page roles;
- merge candidates and destination;
- confidence and unresolved ambiguity.

It must not recommend consolidation solely because titles contain similar keywords.

## Confidence rubric

- `0.90–1.00`: direct, repeated evidence; little ambiguity.
- `0.75–0.89`: strong evidence with limited uncertainty.
- `0.50–0.74`: plausible but requires human inspection.
- `<0.50`: too uncertain for automatic prioritization; surface as exploratory only.

## Validation and retries

- Validate every response against a versioned schema.
- Reject unknown required enums, out-of-range scores, missing evidence, and malformed JSON.
- Permit bounded repair attempts for formatting only.
- Never ask a model to invent missing source content during repair.
- Persist invalid attempts for diagnostics, excluding sensitive payloads and scores.
- Do not include failed output in scoring.

## Provider abstraction

The domain layer should request an analysis capability, not a provider-specific endpoint. Provider adapters normalize:

- model identifiers;
- structured-output support;
- batch submission;
- token usage;
- cost estimates;
- rate-limit errors;
- request identifiers.

Anthropic is the initial intended provider. Exact models remain open.

## Batch strategy and cost controls

- Run deterministic checks before AI.
- Let users select eligible pages and models.
- Show estimated cost before large runs.
- Support workspace budgets and per-run limits.
- Reuse completed analysis when target hash, prompt version, model, and context hash match.
- Prefer batch APIs for noninteractive whole-site analysis when beneficial.
- Reserve stronger models for high-value or ambiguous pages.

## Privacy and retention

Store the minimum provider payload required for debugging and auditability. Credential values are never included in prompts. Raw prompts and responses may contain publisher content and therefore require tenant isolation, retention controls, and deletion support.

## Versioning

Prompt versions and response schemas are immutable. A scoring change does not rewrite past AI output. New analysis creates a new run linked to its exact prompt, schema, provider, model, and input hash.

## Related documents

- [Scoring framework](scoring-framework.md)
- [Security](security.md)
- [Architecture](architecture.md)
