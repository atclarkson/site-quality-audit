# ADR 0003: Credential Storage

## Status

Proposed.

## Context

Users will connect external services such as Anthropic, Google Search Console, GA4, CMS platforms, and custom MCP or evidence providers. These connections may require API keys, OAuth refresh tokens, client secrets, or credential-bearing endpoints. The application must support configuration through the web interface without exposing stored