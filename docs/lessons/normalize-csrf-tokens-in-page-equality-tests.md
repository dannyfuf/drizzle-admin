---
id: normalize-csrf-tokens-in-page-equality-tests
date: 2026-07-03
scope: project
tags: [testing, csrf, timing-oracle, vitest, security]
source: retrospective
confidence: 0.3
related: []
---

# Assert anti-enumeration responses are identical after normalizing per-response CSRF tokens; assert cost with spies, not wall-clock

## Context
Closing the email-enumeration oracle in drizzle-admin login: unknown-email and wrong-password failures must be indistinguishable in both response body and CPU cost.

## Mistake
A naive `expect(bodyA).toBe(bodyB)` can never pass because each re-rendered login page legitimately embeds a fresh CSRF token — and wall-clock timing assertions for the bcrypt cost flake in CI.

## Lesson
- Compare failure pages after stripping the only legitimate difference: `html.replace(/name="_csrf" value="[^"]*"/g, 'name="_csrf" value=""')`; anything else that differs is a real leak.
- Prove timing uniformity with a spy on `bcrypt.compare` asserting exactly one call per failure branch (including the dummy-hash branch), instead of measuring elapsed time.
- Keep a module-level pre-generated dummy bcrypt hash for the "no usable stored hash" branch so unknown emails and null/corrupt hashes cost one compare like real ones.

## When to Apply
Testing any "generic error" / anti-enumeration requirement where responses embed per-request tokens (CSRF, nonces), or any test tempted to assert on elapsed milliseconds.
