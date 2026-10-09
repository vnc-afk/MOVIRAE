# MOVIRAE TDD Strategy

This document defines the test-driven development strategy for the MOVIRAE
application. New behavior should be implemented by writing a failing test
first, making the smallest implementation change that passes it, and then
refactoring while keeping the suite green.

## Test layers

| Layer | Location | Purpose | Command |
| --- | --- | --- | --- |
| Unit | `frontend/tests/unit` | Pure utilities, hooks, API contracts, service boundaries, and isolated route behavior | `npm test` |
| Database integration | `frontend/tests/database` | Prisma constraints, relations, cascading behavior, and persistence contracts | `npm run test:db` |
| Full automated suite | Unit + database tests | Regression coverage before merging | `npm run test:all` |
| End-to-end | `frontend/tests/e2e` | Browser navigation, authentication entry points, and unauthenticated API behavior | `npm run test:e2e` |
| Static validation | Frontend source | Type/lint regressions | `npm run lint` and `npm run build` |

## Feature coverage matrix

The existing suite is organized around the application's externally observable
features:

| Feature area | Primary test coverage |
| --- | --- |
| Discover search, filters, sorting, pagination, and errors | `tests/unit/discover-filters.test.ts`, `tests/unit/utils.test.ts` |
| Authentication, signup, sessions, and protected routes | `tests/unit/api-route-behaviors.test.ts`, `tests/e2e/smoke.spec.ts` |
| Watchlists, reviews, and API response contracts | `tests/unit/api-route-behaviors.test.ts`, `tests/unit/api-contracts.test.ts` |
| Groups, members, events, and discussions | `tests/unit/calendar-and-groups.test.ts` |
| Shared-list event propagation | `tests/unit/shared-list-events.test.ts` |
| Calendar URL state and event helpers | `tests/unit/calendar-and-groups.test.ts` |
| AI assistant tool and provider boundaries | `tests/unit/ai-assistant.test.ts` |
| Messaging and websocket behavior | `tests/unit/messages-websocket.test.ts` |
| Soundtracks and audio behavior | `tests/unit/soundtracks.test.ts` |
| Wrapped statistics, formatting, and badges | `tests/unit/wrapped-utils.test.ts` |
| Redis caching and rate limiting | `tests/unit/redis-cache.test.ts`, `tests/unit/api-contracts.test.ts` |
| Prisma schema constraints and relations | `tests/database/prisma.test.ts` |
| Public navigation and login smoke paths | `tests/e2e/smoke.spec.ts` |

## TDD checklist for new work

1. Identify the user-visible contract and the layer that owns it.
2. Add a focused failing test for the happy path.
3. Add boundary and failure tests for invalid input, authorization, provider
   failures, and persistence conflicts where applicable.
4. Implement only enough production code to make the tests pass.
5. Refactor shared behavior without changing the contract.
6. Run the smallest relevant test file, then `npm run test:all`.
7. Run `npm run lint`; run `npm run build` for changes affecting routes,
   configuration, or production bundling.
8. Add or update an end-to-end test when the behavior crosses page boundaries
   or depends on browser interaction.

## Definition of done

A feature is complete when its behavior is represented by executable tests,
failure behavior is explicit, related tests pass in isolation and as part of
the full suite, and the feature remains covered by the appropriate CI checks
in `.github/workflows/ci-cd.yml`.

