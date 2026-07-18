# Scoring Framework

## Purpose

Scores help order work; they do not prove why a page ranks or fails to rank. Every score must be explainable, versioned, and reproducible from stored inputs.

## Separate concepts

The application must not collapse these into one opaque number:

1. Quality risk
2. Traffic opportunity
3. Business importance
4. Recommendation confidence
5. Estimated effort
6. Work priority

## Page-level dimensions

Each dimension is normalized to 0–100. Higher is better for positive dimensions and worse for explicit risk dimensions.

### Positive dimensions

- Technical health
- Indexability health
- Originality and information gain
- First-hand experience
- Evidence and trust
- Search-intent satisfaction
- Editorial quality
- Internal-linking health
- Organic visibility opportunity

### Risk dimensions

- Thin-content risk
- Generic or templated language risk
- Affiliate-first risk
- Topic-overlap risk
- Duplication risk

The UI must label direction clearly so users never need to guess whether a high number is good or bad.

## Inputs

### Deterministic inputs

Examples:

- Status and redirect behavior
- Canonical and robots state
- Main-content length
- Template-to-content ratio
- Metadata completeness
- Internal links in and out
- Broken links
- Affiliate-link count and placement
- Image and video evidence
- Author/date/schema signals
- Content similarity
- Sitemap consistency

### Search-performance inputs

Examples:

- Clicks and impressions
- CTR and average position
- Trend versus prior period
- Historical peak versus current performance
- Shared queries across pages

### AI inputs

Examples:

- Originality assessment
- First-hand-experience assessment
- Evidence quality
- Generic-language risk
- Intent satisfaction
- Standalone-page justification
- Recommendation confidence

AI scores are advisory inputs, not the final formula.

## Normalization

Raw metrics are converted to 0–100 through versioned functions. Avoid arbitrary universal thresholds where site-relative distributions are more appropriate.

Use a mix of:

- Absolute rules for clear failures, such as noindex conflicts
- Bounded curves for metrics such as broken-link ratio
- Site-relative percentiles for metrics such as inbound internal links
- Historical comparisons for traffic decline

Every normalized value stores:

- Formula version
- Raw value
- Normalized value
- Applicable thresholds
- Data timestamp

## Confidence

Each dimension also receives a confidence value from 0–1.

Confidence considers:

- Data completeness
- Crawl freshness
- Search-data coverage
- AI response confidence
- Agreement between deterministic and AI evidence
- Sample size

Low confidence should reduce recommendation priority and trigger a visible “needs evidence” state. It must not silently convert uncertainty into a poor score.

## Missing data

- Missing data is not automatically bad data.
- The score response must identify unavailable inputs.
- Dimensions with insufficient data may be marked `not_scored`.
- Aggregations reweight only across eligible inputs and display coverage.
- A site score without Search Console must state that organic-opportunity coverage is absent.

## Quality risk

Quality risk is an aggregate of negative signals such as thinness, templating, duplication, weak evidence, intent mismatch, and technical/indexability problems.

Initial conceptual formula:

```text
quality_risk = weighted_mean(applicable_risk_dimensions, confidence_adjusted)
```

Weights are provisional and must not be embedded without a score-version record.

## Traffic opportunity

Traffic opportunity estimates the upside of improving a page, not its current quality.

Candidate inputs:

- Impressions
- Ranking positions near meaningful thresholds
- Historical traffic loss
- Query breadth
- CTR gap
- Topic demand proxy
- Internal-link potential

A page with no performance data can still have opportunity, but confidence will be lower.

## Business importance

Business importance is explicitly separate because traffic is not equal to value.

Inputs may include:

- Manual site-owner rating
- Revenue or conversion data, when connected
- Strategic topic designation
- Funnel role
- Brand/legal importance
- Dependency from other pages

Manual overrides require a reason and audit trail.

## Estimated effort

Effort uses coarse, explainable bands rather than fake precision:

- 1: minutes
- 2: under two hours
- 3: half day
- 4: one to two days
- 5: multi-day or cross-team

The system may suggest effort, but users can override it.

## Work priority

Initial conceptual formula:

```text
priority = (expected_impact * business_importance * confidence) / effort
```

Where expected impact combines quality risk and traffic opportunity based on recommendation type.

Examples:

- Technical fix: impact may depend heavily on indexability and affected traffic.
- Rewrite: impact may combine quality gap and organic opportunity.
- Removal: impact may depend on site-wide risk contribution, low value, and confidence.
- Protect: high business importance and performance produce a protection flag, not a destructive priority.

The exact formula remains open until real-site calibration.

## Protection rules

Important pages must not be hidden by averages.

Flag a page as protected when combinations of the following are present:

- High current or historical clicks
- High revenue or strategic importance
- Strong backlinks, when data exists
- Critical navigational role
- Strong first-party evidence
- Explicit owner protection

Protected pages can still receive improvement recommendations, but destructive recommendations require stronger confidence and a prominent warning.

## Site-level aggregation

Site scores should be weighted by meaningful exposure while still surfacing long-tail risk.

Use at least two views:

1. Exposure-weighted score: emphasizes pages users and search engines encounter most.
2. Inventory-risk score: shows the proportion and severity of weak pages across the corpus.

This prevents hundreds of zero-traffic pages from overwhelming the main health score while ensuring they remain visible as an inventory problem.

Display:

- Score
- Coverage
- Formula version
- Change since prior audit
- Top contributing positive and negative pages

## Example

### Page A

- Quality risk: 45
- Traffic opportunity: 92
- Business importance: 90
- Confidence: 0.9
- Effort: 2

This page may be the top priority even though it is not the worst page, because it has strong upside and manageable effort.

### Page B

- Quality risk: 88
- Traffic opportunity: 8
- Business importance: 10
- Confidence: 0.6
- Effort: 4

This page is a serious quality concern but may rank below Page A. It may enter a site-cleanup batch or require evidence before removal.

### Page C

- Quality risk: 20
- Traffic opportunity: 85
- Business importance: 100
- Confidence: 0.95
- Effort: 3

This page should be protected and optimized carefully, not rewritten merely because another page has a higher editorial score.

## Versioning

Every score snapshot records:

- Score version
- Component formula versions
- Weights
- Raw inputs
- Normalized inputs
- Confidence
- Missing inputs
- Human overrides

Changing scoring logic creates a new version. Historical scores remain interpretable under their original version.

## Human override

Users may override:

- Business importance
- Effort
- Recommendation status
- Priority order
- Protection status

Overrides require a reason, actor, timestamp, and previous value.

## Provisional initial weighting guidance

These are calibration starting points, not accepted production weights:

- Deterministic evidence should outweigh AI opinion when measuring technical and structural health.
- AI may carry more weight for originality, intent satisfaction, and editorial quality.
- Search opportunity should heavily influence work order but not quality score.
- Low-confidence destructive recommendations should be suppressed rather than merely ranked lower.

Exact weights remain open until the first full audit is compared against human review.
