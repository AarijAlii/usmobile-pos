-- USMobile POS — Row Level Security policies
--
-- This file is NOT run by `prisma migrate dev` automatically. Once a real
-- Supabase project is connected, fold this into a migration with:
--   npx prisma migrate dev --create-only --name rls_policies
-- then paste this file's contents into the generated migration.sql before
-- running `npx prisma migrate deploy`.
--
-- Design: every tenant table carries organization_id (and store_id where
-- applicable) directly (denormalized) so policies are simple index lookups,
-- not multi-hop joins. Helper functions below resolve the current staff
-- member's org/role/store from auth.uid() and are SECURITY DEFINER so they
-- can read the `staff` table even though `staff` itself has RLS enabled —
-- without this, policies on `staff` referencing these functions would
-- recurse into RLS on `staff` again and either deadlock or reject everything.

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

create or replace function public.current_staff_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.staff where id = auth.uid()
$$;

create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.staff where id = auth.uid()
$$;

create or replace function public.current_staff_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select store_id from public.staff where id = auth.uid()
$$;

-- OWNER/ADMIN can access every store in their org; STAFF only their assigned store.
create or replace function public.can_access_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when public.current_staff_role() in ('OWNER', 'ADMIN') then true
      else public.current_staff_store_id() = target_store_id
    end
$$;

grant execute on function public.current_staff_org_id() to authenticated;
grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.current_staff_store_id() to authenticated;
grant execute on function public.can_access_store(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;

create policy "organizations_select_own"
on public.organizations for select
using (id = public.current_staff_org_id());

-- ---------------------------------------------------------------------------
-- stores
-- ---------------------------------------------------------------------------

alter table public.stores enable row level security;

create policy "stores_select_scoped"
on public.stores for select
using (
  organization_id = public.current_staff_org_id()
  and public.can_access_store(id)
);

create policy "stores_write_admin_only"
on public.stores for all
using (
  organization_id = public.current_staff_org_id()
  and public.current_staff_role() in ('OWNER', 'ADMIN')
)
with check (
  organization_id = public.current_staff_org_id()
  and public.current_staff_role() in ('OWNER', 'ADMIN')
);

-- ---------------------------------------------------------------------------
-- staff
-- ---------------------------------------------------------------------------

alter table public.staff enable row level security;

create policy "staff_select_same_org"
on public.staff for select
using (organization_id = public.current_staff_org_id());

create policy "staff_write_admin_only"
on public.staff for insert
with check (
  organization_id = public.current_staff_org_id()
  and public.current_staff_role() in ('OWNER', 'ADMIN')
);

create policy "staff_update_admin_only"
on public.staff for update
using (
  organization_id = public.current_staff_org_id()
  and public.current_staff_role() in ('OWNER', 'ADMIN')
)
with check (organization_id = public.current_staff_org_id());

-- ---------------------------------------------------------------------------
-- customers, products — org-scoped (not store-specific)
-- ---------------------------------------------------------------------------

alter table public.customers enable row level security;

create policy "customers_all_same_org"
on public.customers for all
using (organization_id = public.current_staff_org_id())
with check (organization_id = public.current_staff_org_id());

alter table public.products enable row level security;

create policy "products_select_same_org"
on public.products for select
using (organization_id = public.current_staff_org_id());

create policy "products_write_admin_only"
on public.products for insert
with check (
  organization_id = public.current_staff_org_id()
  and public.current_staff_role() in ('OWNER', 'ADMIN')
);

create policy "products_update_admin_only"
on public.products for update
using (
  organization_id = public.current_staff_org_id()
  and public.current_staff_role() in ('OWNER', 'ADMIN')
)
with check (organization_id = public.current_staff_org_id());

-- ---------------------------------------------------------------------------
-- inventory_units, stock_levels — store-scoped
-- ---------------------------------------------------------------------------

alter table public.inventory_units enable row level security;

create policy "inventory_units_select_scoped"
on public.inventory_units for select
using (
  organization_id = public.current_staff_org_id()
  and public.can_access_store(store_id)
);

create policy "inventory_units_write_scoped"
on public.inventory_units for insert
with check (
  organization_id = public.current_staff_org_id()
  and public.can_access_store(store_id)
);

create policy "inventory_units_update_scoped"
on public.inventory_units for update
using (
  organization_id = public.current_staff_org_id()
  and public.can_access_store(store_id)
)
with check (
  organization_id = public.current_staff_org_id()
  and public.can_access_store(store_id)
);

alter table public.stock_levels enable row level security;

create policy "stock_levels_all_scoped"
on public.stock_levels for all
using (
  organization_id = public.current_staff_org_id()
  and public.can_access_store(store_id)
)
with check (
  organization_id = public.current_staff_org_id()
  and public.can_access_store(store_id)
);

-- ---------------------------------------------------------------------------
-- sales, sale_line_items
-- ---------------------------------------------------------------------------

alter table public.sales enable row level security;

create policy "sales_select_scoped"
on public.sales for select
using (
  organization_id = public.current_staff_org_id()
  and public.can_access_store(store_id)
);

create policy "sales_insert_scoped"
on public.sales for insert
with check (
  organization_id = public.current_staff_org_id()
  and public.can_access_store(store_id)
);

-- STAFF can update sales they can access, but cannot CANCEL/REFUND — only OWNER/ADMIN can.
create policy "sales_update_scoped"
on public.sales for update
using (
  organization_id = public.current_staff_org_id()
  and public.can_access_store(store_id)
)
with check (
  organization_id = public.current_staff_org_id()
  and (
    status not in ('CANCELLED', 'REFUNDED')
    or public.current_staff_role() in ('OWNER', 'ADMIN')
  )
);

alter table public.sale_line_items enable row level security;

create policy "sale_line_items_all_scoped"
on public.sale_line_items for all
using (
  exists (
    select 1 from public.sales s
    where s.id = sale_line_items.sale_id
      and s.organization_id = public.current_staff_org_id()
      and public.can_access_store(s.store_id)
  )
)
with check (
  exists (
    select 1 from public.sales s
    where s.id = sale_line_items.sale_id
      and s.organization_id = public.current_staff_org_id()
      and public.can_access_store(s.store_id)
  )
);

-- ---------------------------------------------------------------------------
-- buyback_transactions
-- ---------------------------------------------------------------------------

alter table public.buyback_transactions enable row level security;

create policy "buyback_transactions_all_scoped"
on public.buyback_transactions for all
using (
  organization_id = public.current_staff_org_id()
  and public.can_access_store(store_id)
)
with check (
  organization_id = public.current_staff_org_id()
  and public.can_access_store(store_id)
);

-- ---------------------------------------------------------------------------
-- repair_tickets, repair_parts_used
-- ---------------------------------------------------------------------------

alter table public.repair_tickets enable row level security;

create policy "repair_tickets_all_scoped"
on public.repair_tickets for all
using (
  organization_id = public.current_staff_org_id()
  and public.can_access_store(store_id)
)
with check (
  organization_id = public.current_staff_org_id()
  and public.can_access_store(store_id)
);

alter table public.repair_parts_used enable row level security;

create policy "repair_parts_used_all_scoped"
on public.repair_parts_used for all
using (
  exists (
    select 1 from public.repair_tickets rt
    where rt.id = repair_parts_used.repair_ticket_id
      and rt.organization_id = public.current_staff_org_id()
      and public.can_access_store(rt.store_id)
  )
)
with check (
  exists (
    select 1 from public.repair_tickets rt
    where rt.id = repair_parts_used.repair_ticket_id
      and rt.organization_id = public.current_staff_org_id()
      and public.can_access_store(rt.store_id)
  )
);

-- ---------------------------------------------------------------------------
-- stock_movements — append-only audit log (no update/delete policy => denied by default)
-- ---------------------------------------------------------------------------

alter table public.stock_movements enable row level security;

create policy "stock_movements_select_scoped"
on public.stock_movements for select
using (
  organization_id = public.current_staff_org_id()
  and public.can_access_store(store_id)
);

create policy "stock_movements_insert_scoped"
on public.stock_movements for insert
with check (
  organization_id = public.current_staff_org_id()
  and public.can_access_store(store_id)
);

-- ---------------------------------------------------------------------------
-- RLS proof (run manually against two seeded orgs to verify isolation):
--
--   1. Seed two organizations (Org A, Org B), each with a store and staff.
--   2. Log in as an Org A staff member; query `select * from sales` via the
--      Supabase client (not Prisma) — only Org A's sales should return.
--   3. Attempt an insert with a spoofed store_id belonging to Org B — the
--      `with check` clause rejects it even though the request is otherwise
--      well-formed, proving enforcement happens in Postgres, not just in
--      application-level filtering.
-- ---------------------------------------------------------------------------
