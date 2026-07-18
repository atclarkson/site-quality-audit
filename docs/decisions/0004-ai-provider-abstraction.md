# ADR 0004: AI Provider Abstraction

## Status

Proposed.

## Context

The product will initially use Anthropic for qualitative content review, but provider capabilities, model quality, pricing, batch APIs, structured-output support, and availability will change. Domain logic must not depend directly on one vendor's SDK or response format.

## Decision

Introduce a provider-neutral AI interface. Domain requests define analysis purpose, validated input, prompt version, expected schema, budget limits, and analysis mode. Provider adapters translate those requests into vendor-specific API calls and normalize usage, cost, latency, and failure data.

Persist the provider, model identifier, prompt version, schema version, request configuration, usage, cost, and validated output for every analysis run.

Scoring and recommendation logic consume validated domain findings, not raw provider responses.

## Alternatives considered

- Integrate Anthropic directly throughout the worker: faster initially but creates widespread coupling.
- Use a generic third-party AI gateway as the only abstraction: may simplify routing but adds dependency and does not replace domain-level contracts.
- Support multiple providers in the first implementation: unnecessary scope; the abstraction can exist while only one adapter is implemented.

## Consequences

- Slightly more initial design work.
- Easier provider replacement, comparison, and testing.
- Provider-specific features can still be exposed through declared capabilities.
- Structured validation and failure normalization become mandatory.
- The first implementation may support only Anthropic despite the abstraction.

## Revisit conditions

Revisit if provider differences make the common interface too restrictive, or if a routing gateway becomes operationally preferable.