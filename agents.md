# SHAKED ERP / Finance OS - Project Instructions

You are building a production-grade internal operating system for SHAKED.

## Business context
SHAKED is a Lebanon-based FMCG nutrition brand selling protein sachets that also include creatine and milk.
Legal entity: Origins s.a.r.l.
Current sales channel: Shopify.
Manual non-Shopify orders also exist via WhatsApp / Instagram / manual entry.
Current payment methods: cash, Whish, and soon credit card.
Currency: USD only.
VAT: enabled.
Future channels: wholesale, and later international expansion.

A factory in Lebanon now handles production and takes 60% of net profit under a fixed settlement agreement. The software must calculate this automatically and generate partner-ready statements and bank-ready financial statements.

## Product catalog
Flavors:
- Chocolate
- Strawberry
- Vanilla
- Coffee

Sellable product types:
- Custom sachet orders: minimum 4 sachets, customer chooses flavor mix, $3 per sachet
- Discovery Pack: 1 sachet per flavor, 4 total, $10.99
- Training Box: 12 sachets, $30.99
- Monthly Bundle: 30 sachets, $65.99

## Core requirements
The system must cover:
- Full double-entry accounting
- Inventory
- Batch / lot tracking
- Expiry tracking
- Manufacturing / production runs
- Bills of materials
- Finished goods and raw material tracking
- Shopify sync
- Manual order entry
- Payment tracking
- Expenses and vendor bills
- Partner settlement engine
- Bank-ready and partner-ready statements
- Dashboards
- Audit logs
- Role-based access

## Architecture rules
- Build a single deployable full-stack monolith, not microservices
- Use TypeScript throughout
- Use a clean modular architecture by domain
- Favor boring, reliable tools over trendy complexity
- Every major business action must be traceable
- No fake or stubbed core logic if real implementation is possible
- Avoid hidden business rules in UI code
- Put all core calculations in tested server-side services
- Use explicit validation and typed boundaries
- No broad catch-and-ignore error handling
- Do not silently swallow failures
- Keep the codebase understandable for a founder-operated business

## UX rules
- Build a fast internal admin web app
- Prioritize clarity, speed, table density, and decision-making
- This is not a marketing website
- The UI should feel like a serious finance and operations console
- Responsive on laptop and desktop first
- Mobile can be passable but is not the main priority
- Use strong information hierarchy, filters, saved views, exports, and drill-downs

## Delivery rules
- Always start by reading the repo and understanding the existing code
- Then create a concrete phased implementation plan
- Then implement, not just plan
- Work autonomously using reasonable assumptions unless truly blocked
- Prefer vertical slices that are actually runnable
- Keep README, setup docs, and `.env.example` updated
- Add migrations and seed data
- Add tests for calculation-heavy logic
- Before finishing a task, verify what you built actually runs

## Done criteria
A task is not done unless:
- code compiles
- schema migrates
- seed data works
- primary flows work end-to-end
- key logic has tests
- docs explain how to run it