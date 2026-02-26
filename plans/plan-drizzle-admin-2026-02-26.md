# Implementation Plan: DrizzleAdmin

Generated: 2026-02-26

## Summary

DrizzleAdmin is a server-rendered admin panel for Drizzle ORM applications. It provides automatic CRUD interfaces for database tables with minimal configuration. The system uses a standalone Hono server, JWT authentication, file-system based resource registration, and supports multiple database dialects (PostgreSQL first).

This plan is divided into **6 stages**, each in its own file for focused implementation.

## Stages Overview

| Stage | Name | Description | Depends On |
|-------|------|-------------|------------|
| 1 | [Foundation](./plan-stage-1-foundation.md) | Project setup, types, config system, dialect adapters | — |
| 2 | [Authentication](./plan-stage-2-authentication.md) | Admin users, JWT, login/logout, password hashing | Stage 1 |
| 3 | [Resource System](./plan-stage-3-resources.md) | File-based registration, defineResource, route generation | Stage 1 |
| 4 | [View Layer](./plan-stage-4-views.md) | Layout, templates, Tailwind styling, flash messages | Stage 2-3 |
| 5 | [CRUD Operations](./plan-stage-5-crud.md) | Index, show, create, edit, delete routes with forms | Stage 4 |
| 6 | [Custom Actions](./plan-stage-6-actions.md) | Member actions, collection actions, confirmation modals | Stage 5 |

## Architecture Diagram

```
drizzle-admin/
├── src/
│   ├── index.ts                 # Main export: DrizzleAdmin class
│   ├── config.ts                # defineConfig helper + types
│   ├── dialects/
│   │   ├── types.ts             # ColumnMeta, DialectAdapter interface
│   │   └── postgresql.ts        # PostgreSQL adapter
│   ├── auth/
│   │   ├── middleware.ts        # JWT verification middleware
│   │   ├── jwt.ts               # Token creation/verification
│   │   ├── password.ts          # bcrypt hashing/comparison
│   │   └── csrf.ts              # CSRF token handling
│   ├── resources/
│   │   ├── loader.ts            # File-system scanner
│   │   ├── types.ts             # ResourceDefinition types
│   │   └── define.ts            # defineResource helper
│   ├── routes/
│   │   ├── auth.ts              # Login/logout routes
│   │   ├── crud.ts              # CRUD route generator
│   │   └── actions.ts           # Custom action routes
│   ├── views/
│   │   ├── layout.ts            # Main layout with sidebar
│   │   ├── login.ts             # Login page
│   │   ├── index.ts             # Table listing view
│   │   ├── show.ts              # Record detail view
│   │   ├── form.ts              # Create/edit form
│   │   ├── components/
│   │   │   ├── flash.ts         # Flash message banner
│   │   │   ├── pagination.ts    # Pagination controls
│   │   │   ├── modal.ts         # Confirmation modal
│   │   │   └── field.ts         # Form field renderers
│   │   └── styles.ts            # Shared Tailwind class utilities
│   └── utils/
│       ├── flash.ts             # Flash message cookie handling
│       └── table.ts             # Table name utilities
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Prerequisites (All Stages)

### Environment Setup
- Node.js 20+
- pnpm (preferred) or npm
- PostgreSQL database for testing

### Key Dependencies
```json
{
  "dependencies": {
    "hono": "^4.x",
    "drizzle-orm": "^0.35.x",
    "bcrypt": "^5.x",
    "jose": "^5.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vitest": "^2.x",
    "@types/bcrypt": "^5.x",
    "drizzle-kit": "^0.27.x",
    "pg": "^8.x"
  }
}
```

### Coding Conventions
- TypeScript strict mode
- ESM modules only
- Template literal functions for HTML (no JSX)
- No frontend build step
- All exports from `src/index.ts`

## Definition of Done (All Stages)

- [ ] All subtasks in the stage completed
- [ ] Unit tests passing: `pnpm test`
- [ ] TypeScript compiles: `pnpm tsc --noEmit`
- [ ] No linter errors: `pnpm eslint .`
- [ ] Integration tested manually against test database

## Quick Links

- [Stage 1: Foundation](./plan-stage-1-foundation.md)
- [Stage 2: Authentication](./plan-stage-2-authentication.md)
- [Stage 3: Resource System](./plan-stage-3-resources.md)
- [Stage 4: View Layer](./plan-stage-4-views.md)
- [Stage 5: CRUD Operations](./plan-stage-5-crud.md)
- [Stage 6: Custom Actions](./plan-stage-6-actions.md)
