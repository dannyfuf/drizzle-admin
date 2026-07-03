---
id: rate-limit-null-client-identifier
date: 2026-07-03
scope: module
tags: [rate-limiting, security, hono, dos, auth]
source: retrospective
confidence: 0.3
related: []
---

# Skip the per-IP bucket when the client identifier is unavailable, never share an "unknown" bucket

## Context
Adding login throttling to drizzle-admin, a runtime-agnostic Hono library where the client IP is only available under some deployments (Node socket, trusted `x-forwarded-for`) and absent under others (mounted as a sub-app `fetch` handler).

## Mistake
The obvious fallback — keying undetectable clients under a shared `"unknown"` identifier — turns the per-IP limit into a global one: any attacker can trip 5 failures and 429 the login for every legitimate user (trivial lockout DoS).

## Lesson
- Model the client identifier as `string | null` in the limiter interface; when `null`, skip the per-identifier check entirely and rely on the per-email (per-account) window, which carries most of the protection.
- Only honor `x-forwarded-for` behind an explicit `trustProxyHeader` opt-in; it is spoofable otherwise.
- Fixed-window counters must prune expired entries on write, or the map grows unboundedly under bot traffic.

## When to Apply
Any rate limiter keyed by client IP in code that can run under multiple runtimes/mounting modes (Hono/fetch-handler libraries, edge runtimes), or whenever a "default bucket" fallback for missing keys is being considered.
