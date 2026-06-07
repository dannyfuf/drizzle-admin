# Implementation Plan: Declared Table Filters
Generated: 2026-04-13
Tracker: `./plans/plan-declared-table-filters-2026-04-13-tracker.md`

## Summary

Add an opt-in filter system for resource index pages so each table can declare which column-based filters should be shown and applied. The goal is to keep the feature explicit and predictable: resources without declared filters render no filter UI, and resources with declared filters render only the declared subset.

The smallest correct public API is to extend `resource.options.index` with `filters?: string[]`, where each string is a Drizzle table property name. Filter values should travel through the existing index GET route as query params, be applied server-side in `createCrudRoutes()`, and round-trip through the index UI and pagination links.

Affected files and directories:
- `src/resources/types.ts`
- `src/resources/filters.ts` (new, recommended)
- `src/resources/__tests__/filters.test.ts` (new, recommended)
- `src/DrizzleAdmin.ts`
- `src/routes/crud.ts`
- `src/routes/__tests__/crud.test.ts`
- `src/views/index.ts`
- `src/views/__tests__/index.test.ts`
- `src/views/components/pagination.ts`
- `src/__tests__/routing-integration.test.ts`
- `src/resources/__tests__/define.test.ts`
- `README.md`

In scope:
- Add resource-level declaration for index filters.
- Render filter controls only on resources that declare filters.
- Only parse and apply declared filters.
- Apply filters server-side to both the count query and the data query.
- Preserve active filters in the URL and pagination links.
- Document the API and cover the behavior with tests.

Out of scope:
- Global filters shared across resources.
- Custom SQL filters, relationship filters, or cross-table joins.
- Saved filter presets.
- Advanced operators or range builders in v1.
- Auto-generating filters for every visible column.

## Prerequisites

Environment and tools:
- Use Node.js 22 to match `.github/workflows/ci.yml`.
- Install dependencies with `npm install` or `pnpm install`.
- Tests run with Vitest via `npm test`.
- Type checking and build both use TypeScript via `npm run typecheck` and `npm run build`.
- The repo also publishes to Deno via `deno.json`, so avoid Node-only APIs in shared runtime code unless they are already used there.

Relevant project structure:
- Resource declarations flow through `defineResource()` in `src/resources/define.ts` and are loaded by `loadResources()` in `src/resources/loader.ts`.
- User-facing resource configuration lives in `ResourceOptions` and nested `IndexConfig` in `src/resources/types.ts`.
- `DrizzleAdmin.initialize()` in `src/DrizzleAdmin.ts` is the right place for fail-fast validation of declared filters.
- `createCrudRoutes()` in `src/routes/crud.ts` already has both table metadata sources needed for filtering:

```ts
const cols = getTableColumns(resource.table)
const columns = adapter.extractColumns(resource.table)
```

- `indexView()` in `src/views/index.ts` renders the index page, and `renderPagination()` in `src/views/components/pagination.ts` currently hardcodes `?page=` links.

Coding conventions to follow:
- Keep the public API small and consistent with existing resource options.
- Use ESM imports with the `@/` alias and explicit `.ts` extensions.
- Keep server-rendered HTML in view files as template strings, following the current pattern in `src/views/index.ts`, `src/views/show.ts`, and `src/views/form.ts`.
- Add focused Vitest tests next to the existing test suites under `src/**/__tests__`.
- Reuse existing helpers like `adminUrl()` and existing style tokens from `src/views/styles.ts` instead of inventing a second path or styling system.

Background reading before implementation:
- `README.md` resource options and index page documentation.
- `src/resources/types.ts`
- `src/DrizzleAdmin.ts`
- `src/routes/crud.ts`
- `src/views/index.ts`
- `src/views/components/pagination.ts`
- `.github/workflows/ci.yml`

Linting note:
- This repo does not currently expose `npm run lint` and no ESLint config was detected at plan creation time.
- Treat `npm run typecheck`, `npm test`, and `npm run build` as the mandatory repository checks.
- If a linter is introduced during implementation, run `npm run lint` or `npx eslint .` before closing the work.

## Task Breakdown

1. `T01` Define the public filter declaration API on resources.
   Depends on: `none`.
   Files: `src/resources/types.ts`, `src/resources/__tests__/define.test.ts`, `README.md`.
   Work: add `index.filters?: string[]` to `IndexConfig`, document that the list is optional and order-sensitive, and add a README example such as `index: { filters: ['title', 'status', 'featured'] }`.
   Acceptance criteria: resources compile with the new option; resources without `index.filters` still behave exactly as they do today; docs show that no filters render unless declared.
   Complexity: `Low`.

2. `T02` Normalize and validate declared filters against table metadata.
   Depends on: `T01`.
   Files: `src/resources/filters.ts` (new), `src/resources/__tests__/filters.test.ts` (new), `src/DrizzleAdmin.ts`.
   Work: create a small helper module that takes `ResourceDefinition` plus `ColumnMeta[]` and returns the declared filter metadata in declaration order. Validate unknown column names, duplicate declarations, password columns, and unsupported types with actionable startup errors. Wire this validation into `DrizzleAdmin.initialize()` after resource loading succeeds.
   Acceptance criteria: startup fails fast for invalid filter declarations; valid declarations return normalized metadata with a stable query key such as `filter_<columnName>`; no runtime filtering logic is duplicated between route and view layers.
   Complexity: `Medium`.

3. `T03` Apply declared filters in the index route and keep pagination correct.
   Depends on: `T02`.
   Files: `src/routes/crud.ts`, `src/routes/__tests__/crud.test.ts`.
   Work: parse only declared query params from the index GET request, coerce values by column type, build a shared Drizzle `where` condition, and apply that same condition to both the `count(*)` query and the paginated record query. Preserve only active filter params when building pagination data.
   Acceptance criteria: undeclared query params are ignored; blank or invalid filter values do not throw; text filters use contains matching; boolean, enum, integer, and timestamp filters use exact matching; pagination reflects the filtered result set rather than the full table.
   Complexity: `High`.

4. `T04` Render the filter UI on index pages only when filters are declared.
   Depends on: `T03`.
   Files: `src/views/index.ts`, `src/views/__tests__/index.test.ts`, `src/views/components/pagination.ts`, `src/views/styles.ts` if extra layout classes are needed.
   Work: add a GET filter form to the index page, keep the existing action bar, and render controls in declared order only. Use type-aware controls inferred from `ColumnMeta`: text input for text, number input for integer, select for enum, select for boolean with blank/true/false, and `datetime-local` for timestamp if the column is declared. Add a clear action that removes filter params entirely.
   Acceptance criteria: no filter UI renders when `index.filters` is absent or empty; active values are shown back in the form; pagination links preserve active filters; the clear action returns to the bare index URL.
   Complexity: `Medium`.

5. `T05` Add regression coverage across resource config, route logic, and rendering.
   Depends on: `T02`, `T03`, `T04`.
   Files: `src/resources/__tests__/define.test.ts`, `src/resources/__tests__/filters.test.ts`, `src/routes/__tests__/crud.test.ts`, `src/views/__tests__/index.test.ts`, `src/__tests__/routing-integration.test.ts`.
   Work: extend existing tests instead of creating a new test strategy. Add unit coverage for declaration pass-through and validation, route-level coverage for filter parsing/coercion/ignored params, view coverage for conditional rendering and query preservation, and one integration assertion that filtered index URLs still render successfully under `basePath`.
   Acceptance criteria: the new test suite proves that filter declarations are opt-in, invalid declarations fail fast, UI state round-trips, and pagination URLs keep active filters.
   Complexity: `Medium`.

6. `T06` Finalize docs, run validation, and close out the tracker.
   Depends on: `T05`.
   Files: `README.md`, `./plans/plan-declared-table-filters-2026-04-13-tracker.md`.
   Work: ensure README examples match the shipped API, run the repository checks, record results in the tracker, and mark every task `done` or `cancelled` before ending the session.
   Acceptance criteria: the tracker contains the final verification commands and results; docs and tests agree on the feature behavior; no pending implementation task remains.
   Complexity: `Low`.

## Execution Tracking

Working agreement:
- Read `./plans/plan-declared-table-filters-2026-04-13-tracker.md` first when resuming.
- Update the tracker every time a task starts, completes, blocks, unblocks, or verification runs.
- Keep this plan mostly immutable after creation. Put live state, changed files, verification evidence, and scope drift into the tracker instead.

Tracker protocol for this feature:
- Only one task should be `in_progress` at a time.
- Use the stable IDs `T01` through `T06` exactly as written here.
- Keep the tracker snapshot short enough to scan in under a minute.
- If scope expands beyond declared column filters, record the scope change in the tracker before editing code.

## Implementation Details

Recommended public API:

```ts
export default defineResource(posts, {
  index: {
    perPage: 25,
    columns: ['id', 'title', 'status', 'featured'],
    filters: ['title', 'status', 'featured'],
  },
})
```

Recommended v1 behavior:
- `index.filters` is optional and order-sensitive.
- If `filters` is omitted or `[]`, the index page shows no filter UI.
- Only declared filters are rendered and only declared query params are applied.
- Query params should be namespaced as `filter_<columnName>` to avoid collisions with `page` and future reserved params.
- Text filters use case-insensitive contains matching via `ilike`.
- Integer, enum, boolean, and timestamp filters use exact matching via `eq`.
- Password columns and JSON columns should be rejected during validation in v1.
- Do not add custom operators, custom labels, or date ranges in this change.

Major implementation guidance by area:

`src/resources/types.ts`
- Extend `IndexConfig` with `filters?: string[]`.
- Keep the public type minimal. If richer operators or labels are needed later, add a new descriptor type in a separate change rather than broadening this first version.

`src/resources/filters.ts` (new)
- Create a small internal helper module that normalizes declared filters into a structure the route and view can share.
- Suggested internal shape: column name, label, query key, and source `ColumnMeta`.
- Reuse the same column naming conventions already used in the repo. Do not introduce a second source of truth for column labels.

`src/DrizzleAdmin.ts`
- Validate declared filters during `initialize()` so broken resource declarations fail before the app starts serving requests.
- Follow the same fail-fast pattern already used for resource loading and route-path validation.

Pattern to follow from current code:

```ts
const { resources, errors } = await loadResources(this.config.resourcesDir)
const validationErrors = validateResources(resources)
```

- Add the filter validation alongside this existing startup validation flow instead of delaying errors until the first index request.

`src/routes/crud.ts`
- This is the right place to build SQL predicates because it already has both extracted metadata and actual Drizzle columns.
- Keep the filter parsing logic separate from `parseFormValues()`. Form parsing handles POST bodies; index filtering should operate on GET query params only.
- Build one `where` condition and reuse it for both queries so the count and visible rows stay aligned.

Pattern to follow from current code:

```ts
const [{ count }] = await db.select({ count: sql`count(*)` }).from(pgTable)
const records = await db.select().from(pgTable).limit(perPage).offset(offset)
```

- Keep this structure, but thread the same optional `where(...)` into both queries.

`src/views/index.ts`
- Keep filter rendering local to the index page. This feature does not need a global layout change.
- Do not auto-derive filters from `getVisibleColumns()`. Visible columns and filterable columns are related but not identical concerns.
- Keep collection actions and the `Create New` button intact. The filter form should sit alongside or immediately below the existing action bar, not replace it.
- Prefer a dedicated filter rendering helper in this file over reusing `renderField()`. `renderField()` is tuned for create/edit forms, required markers, and checkbox semantics, which are not a good fit for optional GET filters.

Pattern to preserve from current code:

```ts
const visibleColumns = getVisibleColumns(columns, resource.options.index)
const collectionActions = renderCollectionActions({ resource, csrfToken, basePath })
```

- Keep column visibility and action rendering intact, then layer filter UI around them.

`src/views/components/pagination.ts`
- Replace raw string concatenation with `URLSearchParams` so page links preserve active filters safely.
- Extend `PaginationProps` with either a query object or a prebuilt query string. Prefer an object to avoid manual escaping bugs.

Current code to replace carefully:

```ts
return `<a href="${baseUrl}?page=${page}" class="${className}">${page}</a>`
```

- All pagination links, including previous and next, must preserve active filters.

Potential gotchas and edge cases:
- Blank values should behave as "filter not applied", but boolean `false` is a real value and must not be dropped.
- Invalid integers or timestamps should not throw a 500. Ignore them or treat them as inactive filters.
- Timestamp exact matching is intentionally narrow in v1. If product requirements shift to ranges, pause and record the scope change in the tracker before implementing it.
- A resource may declare a filter for a column that is not visible in the table. Allow that if the declaration is intentional; the filter contract should validate against the actual table schema, not the visible column list.
- Preserve declaration order. Do not sort filters alphabetically unless that becomes an explicit product requirement.
- Ignore undeclared query params even if they happen to match real column names.

## Testing Strategy

Unit and focused integration coverage:
- `src/resources/__tests__/define.test.ts`: assert that `defineResource()` accepts and preserves `index.filters`.
- `src/resources/__tests__/filters.test.ts`: cover unknown columns, duplicates, password columns, unsupported types, and normalized query-key generation.
- `src/routes/__tests__/crud.test.ts`: cover parsing and coercion rules for text, integer, boolean, enum, and timestamp filters, plus the rule that undeclared params are ignored.
- `src/views/__tests__/index.test.ts`: cover conditional filter form rendering, active value round-trip, clear link behavior, and pagination query preservation.
- `src/__tests__/routing-integration.test.ts`: add at least one authenticated index request with active filter params to confirm the index route still renders correctly under `basePath`.

Manual validation steps:
1. In a local consumer or temporary scratch resource, declare filters on one resource and leave another resource without `index.filters`.
2. Start the admin panel and verify the filtered resource shows the new GET filter form while the undeclared resource shows no filter UI.
3. Apply a text filter and confirm the URL includes only namespaced filter params plus `page`.
4. Apply boolean or enum filters and confirm the control state round-trips after submit.
5. Move between pages and confirm pagination retains active filters.
6. Use the clear action and confirm the URL returns to the bare index route with no filter params.

Repository validation commands:
- `npm test`
- `npm run typecheck`
- `npm run build`
- Lint check: no repo linter is currently configured; if one is added during implementation, run `npm run lint` or `npx eslint .` and record the result in the tracker.

End-to-end verification expectation:
- A resource with no declared filters renders the current index experience unchanged.
- A resource with declared filters renders only those filters.
- Submitted filters affect both the visible rows and the total page count.
- Filter state survives refreshes and pagination because it is encoded in the URL.

## Definition of Done

- [ ] Tracker shows every planned task as `done` or `cancelled`
- [ ] Activity log records the final validation state
- [ ] Tests passing via `npm test`
- [ ] Type checks passing via `npm run typecheck`
- [ ] Build passing via `npm run build`
- [ ] No linter offenses, or tracker explicitly records that no repo linter is configured
- [ ] Code follows existing project conventions and keeps the public API limited to declared column filters
