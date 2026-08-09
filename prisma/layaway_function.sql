-- USMobile POS — atomic layaway creation
--
-- Not run automatically; fold into a migration once applying against a live
-- Supabase project (same process as prisma/rls_policies.sql and
-- prisma/buyback_function.sql).
--
-- Opening a layaway must create the Layaway record, reserve the
-- InventoryUnit, and record the initial deposit as a pending payment
-- together or not at all — the same atomicity argument as
-- create_buyback_with_inventory. SECURITY INVOKER means this runs with the
-- CALLING user's privileges, so RLS policies on layaways/layaway_payments
-- still apply via their `with check` clauses; this is not a bypass.
--
-- The `for update` lock on the guard read prevents two staff members from
-- reserving the same IN_STOCK unit in a race — the second caller blocks
-- until the first's transaction commits (and then correctly sees RESERVED
-- and raises), rather than both reading IN_STOCK and both succeeding.

create or replace function public.create_layaway(
  p_organization_id text,
  p_store_id text,
  p_customer_id text,
  p_created_by_id text,
  p_inventory_unit_id text,
  p_subtotal_cents int,
  p_tax_cents int,
  p_total_cents int,
  p_deposit_cents int,
  p_due_date timestamptz
)
returns table (layaway_id text, layaway_payment_id text)
language plpgsql
security invoker
as $$
declare
  v_layaway_id text;
  v_payment_id text;
  v_unit_status text;
begin
  select status into v_unit_status
  from public.inventory_units
  where id = p_inventory_unit_id
  for update;

  if v_unit_status is distinct from 'IN_STOCK' then
    raise exception 'Inventory unit is not available for layaway (status: %)', v_unit_status;
  end if;

  if p_deposit_cents <= 0 or p_deposit_cents > p_total_cents then
    raise exception 'Deposit must be greater than 0 and no more than the total';
  end if;

  insert into public.layaways (
    organization_id, store_id, customer_id, created_by_id, inventory_unit_id,
    subtotal_cents, tax_cents, total_cents, due_date, status
  ) values (
    p_organization_id, p_store_id, p_customer_id, p_created_by_id, p_inventory_unit_id,
    p_subtotal_cents, p_tax_cents, p_total_cents, p_due_date, 'ACTIVE'
  )
  returning id into v_layaway_id;

  update public.inventory_units
  set status = 'RESERVED'
  where id = p_inventory_unit_id;

  insert into public.layaway_payments (layaway_id, amount_cents, status)
  values (v_layaway_id, p_deposit_cents, 'AWAITING_PAYMENT')
  returning id into v_payment_id;

  return query select v_layaway_id, v_payment_id;
end;
$$;

grant execute on function public.create_layaway(
  text, text, text, text, text, int, int, int, int, timestamptz
) to authenticated;

-- Cancelling or forfeiting a layaway must release the reserved unit back to
-- IN_STOCK together with the status change — a partial failure otherwise
-- leaves a unit stuck in RESERVED with no active layaway pointing at it.
-- SECURITY INVOKER: the layaways update still goes through its own RLS
-- policy, whose `with check` clause is what actually restricts CANCELLED/
-- FORFEITED to OWNER/ADMIN — this function does not relax that.

create or replace function public.release_layaway(
  p_layaway_id text,
  p_new_status text
)
returns void
language plpgsql
security invoker
as $$
declare
  v_unit_id text;
  v_status text;
begin
  if p_new_status not in ('CANCELLED', 'FORFEITED') then
    raise exception 'Invalid release status: %', p_new_status;
  end if;

  select inventory_unit_id, status into v_unit_id, v_status
  from public.layaways
  where id = p_layaway_id
  for update;

  if v_status is distinct from 'ACTIVE' then
    raise exception 'Layaway is not active (status: %)', v_status;
  end if;

  update public.layaways set status = p_new_status where id = p_layaway_id;
  update public.inventory_units set status = 'IN_STOCK' where id = v_unit_id;
end;
$$;

grant execute on function public.release_layaway(text, text) to authenticated;
