# SHAKED Finance OS

Production-minded internal ERP and finance console for SHAKED / Origins s.a.r.l.

## What is in this repo

- Next.js 16 App Router monolith in TypeScript
- Prisma data model for auth, catalog, inventory, production, orders, expenses, accounting, settlements, reports, files, and audit logs
- Secure email/password session auth with RBAC and middleware protection
- Operator UI for:
  - `Dashboard`
  - `Orders`
  - `Inventory`
  - `Production`
  - `Products`
  - `Expenses`
  - `Accounting`
  - `Settlements`
  - `Reports`
  - `Settings`
  - `Audit Log`
- Settings flow for editable company defaults and versioned settlement configuration
- Manual order posting flow with:
  - bundle/custom flavor decomposition
  - FEFO stock deduction from sellable lots
  - payment capture state
  - double-entry journal posting
  - audit logging
- Settlement rerun flow with immutable versioning
- CSV exports for sales by SKU, stock on hand, expiry, inventory movement ledger, P&L, trial balance, and settlement statements
- Seed script with realistic SHAKED demo data
- Domain tests for the core calculation-heavy services

## Stack

- Next.js 16
- React 19
- TypeScript
- PostgreSQL via Prisma
- Tailwind CSS
- shadcn-style UI primitives
- TanStack Table
- Recharts
- Zod
- Vitest
- Playwright

## Local setup

1. Copy envs:

```powershell
Copy-Item .env.example .env
```

2. Start PostgreSQL.

Docker is configured in `docker-compose.yml`, but Docker was not available in the execution environment used to build this repo, so database startup was not verified here.

3. Install dependencies:

```bash
npm install
```

4. Generate Prisma client:

```bash
npm run db:generate
```

5. Apply migrations:

```bash
npx prisma migrate deploy
```

6. Seed demo data:

```bash
npm run db:seed
```

7. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000/login`.

## Portable PostgreSQL on no-admin Windows laptops

This repo can run against a portable PostgreSQL instance stored under `%LOCALAPPDATA%\ShakedFinanceOS`.

Useful commands:

```bash
npm run db:portable:start
npm run db:portable:stop
```

## Seeded login users

- Founder admin: `founder@shaked.lb`
- Cofounder operator: `ops@shaked.lb`
- Default password: `ChangeMe123!`

Override these with `.env`.

## Verified in this environment

- `npx prisma generate`
- `npm run lint`
- `npm run test`
- `npm run build`

## Not fully verified here

- `docker compose up`
- `prisma migrate deploy` against a live PostgreSQL instance
- `npm run db:seed` against a live PostgreSQL instance
- `npm run test:e2e` with browser binaries installed

Those were blocked by the current machine setup rather than by app compile/runtime issues.

## Migrations

Initial SQL migration is generated at:

- `prisma/migrations/20260419_initial/migration.sql`

If your environment already has PostgreSQL running, `npx prisma migrate deploy` will apply it.

## Architecture docs

See [docs/architecture.md](docs/architecture.md).
