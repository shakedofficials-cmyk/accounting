# Architecture Notes

## Deployment shape

- Single Next.js monolith
- Server-rendered admin UI and API routes in one deployable app
- PostgreSQL as system of record
- Prisma for schema, client, and migrations

## Domain modules

### Auth

- Email/password auth
- Session tokens stored hashed in the database
- Middleware protects internal routes
- Permission checks happen server-side per page/action

### Catalog

- `Product` is the commercial family
- `ProductVariant` is the actual SKU / stock or bundle identity
- Flavors are first-class records
- Bundle definitions decompose commercial bundles into finished sachet SKUs

### Inventory

- Append-only `InventoryMovement`
- Current stock stored in `InventoryBalance`
- Lot/expiry/QC status on `InventoryLot`
- Multi-location from day one
- Sellable deductions happen from released lots only

### Production

- Flavor-specific BOMs
- Production runs link BOM, output lot, raw consumption, and batch costing
- Output lots can be held/released/quarantined

### Orders

- `SalesOrder` is the normalized commercial order
- `ManualOrder` and `ShopifyOrder` are source-specific extensions
- Order lines support flavor mix JSON for custom/flexible bundles
- Manual order service posts:
  - order + lines
  - fulfillment record
  - optional payment
  - inventory deduction
  - journal entries
  - audit event

### Accounting

- `JournalEntry` + `JournalEntryLine` are the accounting source of truth
- Financial summaries are derived from posted lines
- Manual order and expense flows post through explicit services
- Natural balance handling treats contra-revenue as debit-normal for reporting/export consistency

### Settlements

- Settlement config is versioned, not mutated in place
- Included opex categories are stored in config JSON
- Settlement periods are immutable and versioned by `periodKey + periodType + version`
- Reruns generate new versions from ledger data

### Audit and files

- Sensitive actions write to `AuditLog`
- File references are modeled now with local/object-storage abstraction room later

### Reporting and settings

- Reporting exports are server-side and derived from ledger or inventory state, not UI calculations
- Current CSV routes cover sales, stock, expiry, inventory movements, P&L, trial balance, and settlement statements
- Company defaults are editable from settings and changes are audited

## Folder layout

- `src/app`: routes, layouts, server actions
- `src/components`: shared UI and layout components
- `src/lib`: infrastructure helpers
- `src/modules/*/domain`: pure business logic
- `src/modules/*/server`: Prisma-backed services
- `prisma`: schema, seed, migrations
- `tests/domain`: calculation-heavy unit tests
- `tests/e2e`: smoke coverage

## Current vertical slices

- Auth + RBAC shell
- Dashboard with KPIs, stock alerts, expiries, and recent activity
- Manual order entry with real stock/journal posting
- Inventory lot and location overview
- Product / bundle / BOM visibility
- Production run overview
- Expense and vendor bill overview
- Accounting trial balance and P&L
- Settlement history + rerun
- Company settings + settlement config admin surfaces
- Expanded CSV export routes for operations and finance

## Next recommended build-out

1. Shopify Admin API sync jobs and webhook ingestion
2. Vendor bill create/edit/post workflow
3. Stronger fulfillment states and reservation vs deduction separation
4. Period close workflow and balance sheet / cash flow reports
5. Attachment upload endpoints and local storage abstraction
6. PDF/print settlement statements
