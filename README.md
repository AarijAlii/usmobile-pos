# USMobile POS

A point-of-sale system for mobile phone stores in the USA — sell devices and accessories, buy back/trade in used phones, track repair tickets from intake to pickup, hold a device on layaway with a deposit, park a cart mid-checkout, sell warranty plans and accessory bundles, and process returns for cash or store credit.

Built for a take-home interview round. Scoped deliberately: the core POS loop (sell / buy-back / repair / return) is fully built and demoable end to end; wholesale, device leasing, and a full analytics suite (all part of the longer-term product vision) are explicitly out of scope for this round. See [Scope & tradeoffs](#scope--tradeoffs) below.

## Stack

TypeScript · Next.js (App Router) · React · Supabase (Postgres + Auth + RLS) · Prisma · Express.js · Redis (Upstash) · Stripe · Groq · Tailwind CSS + shadcn/ui · Docker · Vercel

> The role's stack listed Gemini for the AI integration; this build uses Groq instead, by request. The integration point (`lib/groq.ts`) is a single isolated function behind a REST call — swapping to Gemini, or to any other provider, is a same-shaped change.

## Features

**Point of sale**
- Cart-based checkout across serialized devices (by IMEI) and quantity-tracked accessories, with real Stripe Checkout
- Warranty / protection plan add-ons — an intangible, never-out-of-stock product type sold alongside a device
- Accessory bundles (e.g. case + screen protector) sold as one catalog entry at a discounted fixed price, automatically expanded into correctly-priced individual line items at checkout for accurate per-item returns and restocking
- Store credit — apply a customer's balance toward a sale; when it fully covers the total, the sale completes with no Stripe step at all
- Held/parked sales — pause an in-progress cart to help another customer, resume it (or discard it) later the same day
- Returns & refunds — reverse a paid sale (partially or fully), refund to the original payment method or issue store credit, with inventory automatically restocked

**Inventory & catalog**
- Serialized devices tracked by IMEI/condition/status, accessories tracked by per-store quantity with reorder thresholds
- Full audit trail of every inventory-affecting event (`stock_movements`)

**Trade-in / buy-back**
- Intake a customer's device, set an offer price, choose cash or store credit payout — creates real inventory atomically

**Layaway**
- Reserve a device against a deposit, collect installment payments via Stripe; payoff produces a real `Sale`; forfeiture releases the unit back to stock

**Repairs**
- Ticket intake, a server-enforced status pipeline (Intake → Diagnosing → In Repair → Ready → Completed/Cancelled), labor + parts costing, AI-assisted diagnosis notes (Groq), manual "customer notified" tracking

**Account & platform**
- Self-service settings: edit display name, change password
- Multi-tenant orgs/stores with Postgres RLS enforcing every query — proven via a second, isolated demo organization
- Role model (OWNER/ADMIN vs STAFF) enforced at the database layer, not just the UI — e.g. only OWNER/ADMIN can process a refund that fully closes out a sale
- Dark, Apple/Stripe-inspired UI: page transitions, loading skeletons, animated navigation, rich hover states

## How the job requirements map to this repo

| Requirement | Where |
|---|---|
| Modern frontend with React/Next.js | `app/`, App Router, Server Components + Server Actions, Tailwind + shadcn/ui |
| Secure backend APIs & business logic | Server Actions in each feature's `actions.ts`, `app/api/stripe/webhook`, `app/api/ai/diagnose` |
| PostgreSQL design via Supabase | [`prisma/schema.prisma`](prisma/schema.prisma) |
| Auth, authorization, RLS | Supabase Auth (`lib/supabase/*`), [`prisma/rls_policies.sql`](prisma/rls_policies.sql) |
| Build features from requirements | Inventory, POS checkout, trade-in, repair tickets, layaway, returns, settings, dashboard |
| Clean, maintainable, scalable code | Pure business logic extracted to `lib/*.ts` and unit-tested (see [Tests](#tests)) |
| GitHub collaboration / code review | Feature-branch history (see commit log) |

## Architecture

```
Next.js (Vercel)                     Supabase                    External
┌─────────────────────────┐          ┌──────────────┐            ┌──────────┐
│ App Router UI            │  RLS-    │ Postgres      │            │ Stripe   │
│ Server Actions (CRUD)     │◄────────►│ + Auth        │            │ Groq     │
│ Route Handlers:          │  scoped  │ + RLS policies│            │ Upstash  │
│  /api/stripe/webhook     │  client  └──────────────┘            └──────────┘
│  /api/ai/diagnose        │
└─────────────────────────┘
            ▲
            │ (documented alternative topology — see below)
┌─────────────────────────┐
│ server/ — Express service │
│ Stripe webhook receiver  │
│ (Docker-deployable)      │
└─────────────────────────┘
```

**Next.js Route Handlers + Server Actions are the one primary API** — everything the UI calls directly. This is a deliberate choice: a second, duplicate REST surface (e.g. a parallel Express API for every resource) would double the code to build and secure for no functional gain in a project this size.

**Prisma is used only for schema authoring, migrations, and the seed script** — never to serve an authenticated request. At runtime, every read/write goes through the Supabase server client carrying the signed-in user's JWT (`lib/supabase/server.ts`), so Postgres RLS policies (keyed off `auth.uid()`) are actually enforced on every query, not just present as unused SQL. The one place Prisma's privileged connection would bypass RLS is exactly where that's expected: migrations and seeding.

**Express (`server/`)** demonstrates the Stripe webhook receiver as a standalone, Docker-deployable, always-on Node process — the shape it would take in a production topology with dedicated workers. For *this* deployed demo, Stripe's webhook is registered against the Next.js Route Handler instead (`app/api/stripe/webhook/route.ts`), so the live demo only depends on one deploy target. Run `server/` locally with the Stripe CLI to see the standalone version work (see below).

**Redis (Upstash)** backs rate limiting on login and the AI diagnosis route (`lib/redis.ts`) — a real, load-bearing use rather than a token integration. It fails open (allows the request) if unconfigured, so local dev without Upstash still works.

**Money** is stored and computed in integer cents everywhere (`lib/money.ts`), never floats — avoids rounding-error bugs in tax/total calculations.

**Buy-back atomicity**: accepting a trade-in creates a `BuybackTransaction`, a new `InventoryUnit`, and a `StockMovement` together or not at all. This is done via a Postgres function (`prisma/buyback_function.sql`) rather than sequential app-side inserts, called through the RLS-scoped client — `SECURITY INVOKER` means RLS still applies to every insert inside it; the function only buys atomicity, not a privilege escalation. Layaway (`create_layaway`/`release_layaway`), returns (`create_return`), and sale fulfillment (`finalize_sale_payment`) all follow the same pattern.

**Layaway**: a customer reserves one specific `InventoryUnit` with a deposit and pays off the rest over time — store-issued credit against the store's own inventory, not third-party lending, so there's no consumer-credit compliance surface to build against. Opening one is atomic the same way buy-back is, with a `for update` row lock so two staff can't reserve the same unit in a race. Each payment is a real Stripe Checkout Session; the webhook branches on `session.metadata` to tell a layaway installment apart from a normal sale. "Overdue" is computed at render time (`lib/layaway.ts`), not a stored status.

**Sale fulfillment is centralized**: `finalize_sale_payment()` (`prisma/sale_fulfillment_function.sql`) is the single place a sale actually gets marked `PAID` — it decrements inventory per line item (skipping intangible `SERVICE` products), logs `stock_movements`, and redeems any store credit that was applied at checkout. It's idempotent (a no-op unless the sale is still `AWAITING_PAYMENT`) and is called from two places: the Stripe webhook once payment confirms, and the checkout action directly when store credit alone covers the full total and no Stripe session is ever created. Centralizing this avoids two copies of the decrement logic drifting apart.

**Returns**: `create_return()` restocks the returned quantity (skipping `SERVICE` line items, which were never stocked to begin with) and issues either a real Stripe refund or store credit, all in one transaction. A return that would fully refund a sale requires OWNER/ADMIN — enforced by the same RLS policy that already restricts who may set `sales.status = 'REFUNDED'`, checked in the server action *before* Stripe is ever called so an unqualified request never moves money.

**Bundles**: a `Bundle` is a fixed-price kit of `QUANTITY`-tracked accessory products (serialized devices aren't supported as bundle components — picking which specific IMEI unit satisfies a bundle is a materially harder problem than bundling interchangeable accessory stock). At checkout, `lib/bundles.ts#allocateBundleDiscount` splits the bundle price across its components proportional to their individual prices, with the last component absorbing the rounding remainder so the parts always sum to exactly the bundle price — each component becomes its own `SaleLineItem`, so returns and restocking work per-component exactly like a normal sale.

## Local setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com). From Project Settings:
   - **API**: copy the project URL, `anon` key, and `service_role` key.
   - **Database**: copy the pooled connection string (port 6543) and the direct connection string (port 5432).

3. **Copy `.env.example` to `.env.local`** and fill in Supabase, Stripe (test mode), Groq, and Upstash values.

4. **Apply the schema and migrations** to your Supabase project:
   ```bash
   npm run db:migrate      # applies prisma/migrations/* to your database
   ```
   Then, in the Supabase SQL editor (or by folding into a migration file), run the contents of each — order matters, since later functions/policies reference earlier ones:
   - [`prisma/rls_policies.sql`](prisma/rls_policies.sql)
   - [`prisma/buyback_function.sql`](prisma/buyback_function.sql)
   - [`prisma/layaway_function.sql`](prisma/layaway_function.sql)
   - [`prisma/return_function.sql`](prisma/return_function.sql)
   - [`prisma/sale_fulfillment_function.sql`](prisma/sale_fulfillment_function.sql)
   - [`prisma/staff_function.sql`](prisma/staff_function.sql)

5. **Seed demo data** (creates two demo organizations, staff logins, products including warranty plans and a bundle, inventory, sales, buy-backs, repair tickets, and one active layaway):
   ```bash
   npm run db:seed
   ```
   Safe to re-run — every section looks up existing rows before inserting.

   Demo logins (password `Demo1234!`):
   - `owner@usmobile.demo` — OWNER
   - `admin@usmobile.demo` — ADMIN
   - `staff@usmobile.demo` — STAFF
   - `owner@acmewireless.demo` — a second organization, seeded only to prove RLS isolation (see below)

6. **Run the app**
   ```bash
   npm run dev
   ```

7. **Stripe webhooks locally** — forward events with the [Stripe CLI](https://stripe.com/docs/stripe-cli):
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Copy the printed webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

### Running the standalone Express webhook service (optional)

```bash
cd server
npm install
cp ../.env.local .env   # or set SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / STRIPE_* directly
npm run dev
stripe listen --forward-to localhost:4000/webhooks/stripe
```

Or via Docker Compose from the repo root: `docker compose up --build`.

### Tests

```bash
npm test
```

43 unit tests covering the pure business-logic functions most likely to be checked for correctness: tax/total calculation (`lib/money.ts`), the repair-ticket status state machine (`lib/repair-status.ts`), the inventory quantity guard used by checkout and repair-parts consumption (`lib/inventory.ts`), layaway overdue/remaining-balance logic (`lib/layaway.ts`), return quantity/proportional-tax logic (`lib/returns.ts`), store credit application (`lib/store-credit.ts`), and bundle discount allocation including its rounding edge case (`lib/bundles.ts`). These are plain Vitest unit tests on extracted pure functions rather than end-to-end tests — deliberate, given the time box (see tradeoffs below).

### Verifying RLS actually works

1. Log in as `owner@usmobile.demo`.
2. Confirm you see USMobile's products, customers, sales, etc. — never Acme Wireless's seeded product (`ACME-IP13-128`), even though both organizations exist in the same database.
3. For a stronger proof, query the `sales` table directly via the Supabase client with each user's session and confirm the other organization's rows never come back — not because the app filtered them client-side, but because Postgres itself refuses to return them.
4. Try processing a return that would fully refund a sale while logged in as `staff@usmobile.demo` — it's rejected with "Only an owner or admin can process a full refund," enforced by the same RLS policy that gates `sales.status = 'REFUNDED'`.

## Scope & tradeoffs

Deliberately **out of scope** for this round: wholesale management, device leasing, a full analytics/reporting suite, and broader AI automation beyond one feature. These are real parts of the longer-term product vision but would have diluted focus and time away from a fully-working core loop.

Within the core POS scope, specific simplifications:
- **Single store per demo organization**, though the schema supports `Organization → many Stores → Staff` — multi-store UI (a store switcher) wasn't built.
- **Stripe Checkout (hosted)**, not embedded Elements — no physical card-present hardware exists for a take-home, and Checkout is the lower-risk integration to get genuinely working end to end.
- **No inventory reservation/hold during checkout** — stock is decremented on payment confirmation (or immediately, for a store-credit-only sale), not when an item is added to a cart. Two staff members checking out the last unit of the same item concurrently is a real (if unlikely) race in this design; a production version would mark items `RESERVED` with a short expiry at cart-add time.
- **Buy-back pricing is manual** (staff enters the offer), not an algorithm — matches how small phone stores actually price trade-ins today.
- **Repair status is a flat list with a server-enforced transition guard**, not a drag-and-drop kanban board — the state machine correctness is the same either way, and the list view is less likely to break under time pressure.
- **Customer notification is a manual "mark notified" timestamp**, not real SMS/email — avoids pulling in a messaging provider for a cosmetic requirement.
- **One AI feature** (Groq-assisted repair diagnosis notes from the customer's reported issue) rather than several — chosen because it's the clearest, lowest-risk value-add for a repair tech's actual workflow; it's also non-blocking by design (an AI provider outage never blocks ticket creation or advancement).
- **Cash payments are not implemented** — Stripe checkout (or store credit alone) are the only ways to close a sale in this build.
- **Layaway overdue detection is computed at render time**, not a stored status with automatic expiry — there's no background job/cron in this app, so staff see "Overdue" as a derived flag and act on it manually.
- **Held sales don't expire** — a parked cart sits until a staff member resumes or discards it; there's no automatic end-of-day cleanup job.
- **Store credit has a documented, accepted race**: it's applied to a `Sale` at checkout time but only actually redeemed (balance decremented, ledger written) when the sale is finalized as paid, to avoid burning a customer's credit on an abandoned checkout. Two staff completing overlapping store-credit checkouts for the *same* customer at the *same* instant could both read the same starting balance — acceptable for a single-cashier demo store, called out here rather than silently shipped.
- **Bundles only support `QUANTITY`-tracked accessory components**, not serialized devices — see the architecture note above.

## What I'd do with more time

- A scheduled job (Vercel Cron) to auto-flag overdue layaways and expire stale held sales, instead of computing/leaving them open indefinitely.
- Multi-store switcher UI and a `StaffStore` many-to-many table (currently simplified to a nullable `Staff.storeId`).
- Inventory holds/reservations during an open cart to eliminate the checkout race above.
- Real customer notifications (Twilio SMS or email) triggered on repair status changes, and a receipt emailed at checkout.
- A `custom_access_token_hook` in Supabase to stamp `organization_id`/`role` directly into the JWT, removing the extra `staff` table lookup on every RLS check.
- Cash and split-tender payment methods at checkout.
- Staff invitation/management UI (staff currently only exist via the seed script or direct DB access) and store settings (name/address/tax rate currently have no UI).
- A public, unauthenticated repair-status lookup page (QR code on the printed ticket).
- CI (lint + test on PR) via GitHub Actions.
- End-to-end tests (Playwright) covering the core flows, on top of the current unit tests.
