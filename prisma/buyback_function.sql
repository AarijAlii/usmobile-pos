-- USMobile POS — atomic buy-back completion
--
-- Not run automatically; fold into a migration once a live Supabase project
-- is connected (same process as prisma/rls_policies.sql).
--
-- Accepting a trade-in must create a BuybackTransaction, a new InventoryUnit,
-- and a StockMovement together or not at all — a partial write would leave a
-- payout on record with no corresponding stock, or vice versa. Wrapping all
-- three inserts in one PL/pgSQL function call is what gives that atomicity:
-- if any insert raises, Postgres rolls back the whole function's effects.
--
-- SECURITY INVOKER (the default, stated explicitly here) means this runs
-- with the CALLING user's privileges, not a superuser's — so the RLS
-- policies on buyback_transactions, inventory_units, and stock_movements
-- still apply to every insert below via their `with check` clauses. This is
-- not a bypass; it's atomicity without weakening RLS.

create or replace function public.create_buyback_with_inventory(
  p_organization_id uuid,
  p_store_id uuid,
  p_customer_id uuid,
  p_created_by_id uuid,
  p_product_id uuid,
  p_device_description text,
  p_imei text,
  p_condition_notes text,
  p_offer_price_cents int,
  p_payout_method text
)
returns table (buyback_id uuid, inventory_unit_id uuid)
language plpgsql
security invoker
as $$
declare
  v_buyback_id uuid;
  v_unit_id uuid;
begin
  insert into public.buyback_transactions (
    organization_id, store_id, customer_id, created_by_id,
    device_description, imei, condition_notes, offer_price_cents, payout_method, status
  ) values (
    p_organization_id, p_store_id, p_customer_id, p_created_by_id,
    p_device_description, p_imei, p_condition_notes, p_offer_price_cents, p_payout_method, 'COMPLETED'
  )
  returning id into v_buyback_id;

  insert into public.inventory_units (
    organization_id, store_id, product_id, imei, status, condition,
    cost_cents, acquired_via_buyback_id
  ) values (
    p_organization_id, p_store_id, p_product_id, p_imei, 'IN_STOCK', p_condition_notes,
    p_offer_price_cents, v_buyback_id
  )
  returning id into v_unit_id;

  insert into public.stock_movements (
    organization_id, store_id, product_id, inventory_unit_id, reason,
    quantity_delta, reference_type, reference_id, performed_by_id
  ) values (
    p_organization_id, p_store_id, p_product_id, v_unit_id, 'BUYBACK_INTAKE',
    1, 'buyback', v_buyback_id, p_created_by_id
  );

  return query select v_buyback_id, v_unit_id;
end;
$$;

grant execute on function public.create_buyback_with_inventory(
  uuid, uuid, uuid, uuid, uuid, text, text, text, int, text
) to authenticated;
