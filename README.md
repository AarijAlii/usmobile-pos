# USMobile POS

A point-of-sale system for mobile phone stores in the USA — sell devices and accessories, buy back/trade in used phones, track repair tickets from intake to pickup, and hold a device on layaway with a deposit.

Built for a take-home interview round. Scoped deliberately: the core POS loop (sell / buy-back / repair) is fully built and demoable end to end; wholesale, device leasing, and a full analytics suite (all part of the longer-term product vision) are explicitly out of scope for this round. See [Scope & tradeoffs](#scope--tradeoffs) below.

## Stack

TypeScript · Next.js (App Router) · React · Supabase (Postgres + Auth + RLS) · Prisma · Express.js · Redis (Upstash) · Stripe · Groq · Tailwind CSS + shadcn/ui · Docker · Vercel

> The role's stack listed Gemini for the AI integration; this build uses Groq instead, by request. The integration point (`lib/groq.ts`) is a single isolated function behind a REST call — swapping to Gemini, or to any other provider, is a same-shaped change.

## How the job requirements map to this repo

| Requirement | Where |
|---|---|
| Modern frontend with React/Next.js | `app/`, App Router, Server Components + Server Actions, Tailwind + shadcn/ui |
| Secure backend APIs & business logic | Server Actions in each feature's `actions.ts`, `app/api/stripe/webhook`, `app/api/ai/diagnose` |
| PostgreSQL design via Supabase | [`prisma/schema.prisma`](prisma/schema.prisma) |
| Auth, authorization, RLS | Supabase Auth (`lib/supabase/*`), [`prisma/rls_policies.sql`](prisma/rls_policies.sql) |
| Build features from requirements | Inventory, POS checkout, trade-in, repair tickets, layaway, dashboard |
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

**Buy-back atomicity**: accepting a trade-in creates a `BuybackTransaction`, a new `InventoryUnit`, and a `StockMovement` together or not at all. This is done via a Postgres function (`prisma/buyback_function.sql`) rather than sequential app-side inserts, called through the RLS-scoped client — `SECURITY INVOKER` means RLS still applies to every insert inside it; the function only buys atomicity, not a privilege escalation.

**Layaway**: a customer reserves one specific `InventoryUnit` with a deposit and pays off the rest over time — store-issued credit against the store's own inventory, not third-party lending, so there's no consumer-credit compliance surface to build against. Opening one is atomic the same way buy-back is (`prisma/layaway_function.sql`'s `create_layaway`, with a `for update` row lock so two staff can't reserve the same unit in a race). Each payment (deposit or installment) is a real Stripe Checkout Session; the webhook route branches on `session.metadata` to tell a layaway installment apart from a normal sale, and once the balance is fully paid, finalization (mark the unit `SOLD`, create a real `Sale` + `SaleLineItem` + `StockMovement`, link `Layaway.resultingSaleId`) happens with the same service-role client the sale webhook already uses. "Overdue" is computed at render time (`lib/layaway.ts`), not a stored status — there's no background job in this app, so staff act on it manually (collect a payment, or mark it forfeited) rather than it silently auto-expiring.

## Local setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com). From Project Settings:
   - **API**: copy the project URL, `anon` key, and `service_role` key.
   - **Database**: copy the pooled connection string (port 6543) and the direct connection string (port 5432).

3. **Copy `.env.example` to `.env.local`** and fill in Supabase, Stripe (test mode), Groq, and Upstash values.

4. **Apply the schema, RLS policies, and buy-back function** to your Supabase project:
   ```bash
   npm run db:migrate      # creates the initial migration from prisma/schema.prisma
   ```
   Then, in the Supabase SQL editor (or by folding into a migration file), run the contents of:
   - [`prisma/rls_policies.sql`](prisma/rls_policies.sql)
   - [`prisma/buyback_function.sql`](prisma/buyback_function.sql)
   - [`prisma/layaway_function.sql`](prisma/layaway_function.sql)

5. **Seed demo data** (creates two demo organizations, staff logins, products, inventory, sales, buy-backs, repair tickets, and one active layaway):
   ```bash
   npm run db:seed
   ```
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

24 unit tests covering the pure business-logic functions most likely to be checked for correctness: tax/total calculation (`lib/money.ts`), the repair-ticket status state machine (`lib/repair-status.ts`), the inventory quantity guard used by both checkout and repair-parts consumption (`lib/inventory.ts`), and layaway overdue/remaining-balance logic (`lib/layaway.ts`). These are plain Vitest unit tests on extracted pure functions rather than end-to-end tests — deliberate, given the time box (see tradeoffs below).

### Verifying RLS actually works

1. Log in as `owner@usmobile.demo`.
2. Confirm you see USMobile's products, customers, sales, etc. — never Acme Wireless's seeded product (`ACME-IP13-128`), even though both organizations exist in the same database.
3. For a stronger proof, query the `sales` table directly via the Supabase client with each user's session and confirm the other organization's rows never come back — not because the app filtered them client-side, but because Postgres itself refuses to return them.

## Scope & tradeoffs

Deliberately **out of scope** for this round: wholesale management, device leasing, a full analytics/reporting suite, and broader AI automation beyond one feature. These are real parts of the longer-term product vision but would have diluted focus and time away from a fully-working core loop.

Within the core POS scope, specific simplifications:
- **Single store per demo organization**, though the schema supports `Organization → many Stores → Staff` — multi-store UI (a store switcher) wasn't built.
- **Stripe Checkout (hosted)**, not embedded Elements — no physical card-present hardware exists for a take-home, and Checkout is the lower-risk integration to get genuinely working end to end.
- **No inventory reservation/hold during checkout** — stock is decremented on webhook confirmation, not when an item is added to a cart. Two staff members checking out the last unit of the same item concurrently is a real (if unlikely) race in this design; a production version would mark items `RESERVED` with a short expiry at cart-add time.
- **Buy-back pricing is manual** (staff enters the offer), not an algorithm — matches how small phone stores actually price trade-ins today.
- **Repair status is a flat list with a server-enforced transition guard**, not a drag-and-drop kanban board — the state machine correctness is the same either way, and the list view is less likely to break under time pressure.
- **Customer notification is a manual "mark notified" timestamp**, not real SMS/email — avoids pulling in a messaging provider for a cosmetic requirement.
- **One AI feature** (Groq-assisted repair diagnosis notes from the customer's reported issue) rather than several — chosen because it's the clearest, lowest-risk value-add for a repair tech's actual workflow; it's also non-blocking by design (an AI provider outage never blocks ticket creation or advancement).
- **Cash payments and refunds are not implemented** — Stripe checkout is the only payment path in this build.
- **Layaway overdue detection is computed at render time**, not a stored status with automatic expiry — there's no background job/cron in this app, so staff see "Overdue" as a derived flag and act on it manually (collect a payment, or mark it forfeited) rather than it silently transitioning on its own. (Layaway is also where `InventoryUnitStatus.RESERVED` actually gets used — regular POS checkout doesn't reserve stock at cart-add time, see above.)

## What I'd do with more time

- A scheduled job (Vercel Cron) to auto-flag overdue layaways instead of computing it at render time, and to send a reminder before the due date.
- Multi-store switcher UI and a `StaffStore` many-to-many table (currently simplified to a nullable `Staff.storeId`).
- Inventory holds/reservations during an open cart to eliminate the checkout race above.
- Real customer notifications (Twilio SMS or email) triggered on repair status changes.
- A `custom_access_token_hook` in Supabase to stamp `organization_id`/`role` directly into the JWT, removing the extra `staff` table lookup on every RLS check.
- Refunds/voids, split/cash tender at checkout.
- A public, unauthenticated repair-status lookup page (QR code on the printed ticket).
- CI (lint + test on PR) via GitHub Actions.
- End-to-end tests (Playwright) covering the three core flows, on top of the current unit tests.
