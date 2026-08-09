-- USMobile POS — atomic return/refund creation
--
-- Not run automatically; fold into a migration once applying against a live
-- Supabase project (same process as prisma/rls_policies.sql,
-- prisma/buyback_function.sql, and prisma/layaway_function.sql).
--
-- Ordering note: for a STRIPE refund, the caller
-- (app/(app)/pos/receipt/[saleId]/actions.ts) calls stripe.refunds.create()
-- BEFORE this function, so by the time this function runs, money has
-- already moved. That means this function must not fail for reasons the
-- caller could have checked in advance — the caller re-derives the same
-- "already refunded" and "would this fully refund the sale" totals
-- read-only, before ever touching Stripe, and rejects early there. The
-- current_staff_role() check below is a second, defense-in-depth guard for
-- the rare race (two staff completing overlapping returns on the same sale
-- concurrently) — if it trips on a STRIPE refund, the Stripe refund has
-- already succeeded but this transaction rolls back, leaving a refund with
-- no DB record that needs manual reconciliation. Closing that gap for real
-- would mean sequencing through a queue/idempotency layer, which is out of
-- scope here. A STORE_CREDIT refund has no such external side effect — the
-- credit issuance happens inside this same transaction, so it either fully
-- commits or fully rolls back with no reconciliation gap at all.
--
-- SECURITY INVOKER: runs with the CALLING user's privileges, so RLS on
-- returns/return_line_items/inventory_units/stock_levels/customers/
-- store_credit_transactions/sales still applies.
--
-- The `for update` lock on the sale row serializes concurrent returns
-- against the same sale, so two overlapping calls can't both under-count
-- "already returned" quantity and double-refund the same line item.

drop function if exists public.create_return(text, text, text, text, text, jsonb, int, int, int, text);

create or replace function public.create_return(
  p_organization_id text,
  p_store_id text,
  p_sale_id text,
  p_created_by_id text,
  p_reason text,
  p_line_items jsonb, -- [{"sale_line_item_id": text, "quantity": int}, ...]
  p_subtotal_cents int,
  p_tax_cents int,
  p_total_cents int,
  p_refund_method text, -- 'STRIPE' | 'STORE_CREDIT'
  p_stripe_refund_id text, -- required when p_refund_method = 'STRIPE', null otherwise
  p_customer_id text -- required when p_refund_method = 'STORE_CREDIT', null otherwise
)
returns table (return_id text)
language plpgsql
security invoker
as $$
declare
  v_return_id text;
  v_sale_status text;
  v_sale_total_cents int;
  v_already_refunded_cents int;
  v_item jsonb;
  v_sale_line_item_id text;
  v_qty int;
  v_original_qty int;
  v_already_returned_qty int;
  v_inventory_unit_id text;
  v_product_id text;
  v_tracking_type text;
  v_unit_price_cents int;
  v_line_total_cents int;
  v_unit_status text;
begin
  if p_refund_method not in ('STRIPE', 'STORE_CREDIT') then
    raise exception 'Invalid refund method: %', p_refund_method;
  end if;
  if p_refund_method = 'STRIPE' and p_stripe_refund_id is null then
    raise exception 'stripe_refund_id is required for a STRIPE refund';
  end if;
  if p_refund_method = 'STORE_CREDIT' and p_customer_id is null then
    raise exception 'A customer is required to issue store credit';
  end if;

  select status, total_cents into v_sale_status, v_sale_total_cents
  from public.sales
  where id = p_sale_id
  for update;

  if v_sale_status is distinct from 'PAID' then
    raise exception 'Sale is not eligible for return (status: %)', v_sale_status;
  end if;

  if p_total_cents <= 0 then
    raise exception 'Return total must be greater than 0';
  end if;

  insert into public.returns (
    organization_id, store_id, sale_id, created_by_id, reason,
    subtotal_cents, tax_cents, total_cents, refund_method, stripe_refund_id
  ) values (
    p_organization_id, p_store_id, p_sale_id, p_created_by_id, p_reason,
    p_subtotal_cents, p_tax_cents, p_total_cents, p_refund_method::"ReturnRefundMethod", p_stripe_refund_id
  )
  returning id into v_return_id;

  for v_item in select * from jsonb_array_elements(p_line_items)
  loop
    v_sale_line_item_id := v_item->>'sale_line_item_id';
    v_qty := (v_item->>'quantity')::int;

    select sli.quantity, sli.unit_price_cents, sli.product_id, sli.inventory_unit_id, p.tracking_type
    into v_original_qty, v_unit_price_cents, v_product_id, v_inventory_unit_id, v_tracking_type
    from public.sale_line_items sli
    join public.products p on p.id = sli.product_id
    where sli.id = v_sale_line_item_id and sli.sale_id = p_sale_id;

    if v_original_qty is null then
      raise exception 'Sale line item % does not belong to sale %', v_sale_line_item_id, p_sale_id;
    end if;

    select coalesce(sum(quantity), 0) into v_already_returned_qty
    from public.return_line_items
    where sale_line_item_id = v_sale_line_item_id;

    if v_qty <= 0 or v_qty > (v_original_qty - v_already_returned_qty) then
      raise exception 'Return quantity % exceeds returnable quantity for line item %', v_qty, v_sale_line_item_id;
    end if;

    v_line_total_cents := v_unit_price_cents * v_qty;

    insert into public.return_line_items (
      return_id, sale_line_item_id, quantity, unit_price_cents, line_total_cents
    ) values (
      v_return_id, v_sale_line_item_id, v_qty, v_unit_price_cents, v_line_total_cents
    );

    if v_tracking_type = 'SERVICE' then
      null; -- intangible — was never decremented, so there's nothing to restock
    elsif v_inventory_unit_id is not null then
      select status into v_unit_status
      from public.inventory_units
      where id = v_inventory_unit_id
      for update;

      if v_unit_status is distinct from 'SOLD' then
        raise exception 'Inventory unit % is not marked SOLD (status: %)', v_inventory_unit_id, v_unit_status;
      end if;

      update public.inventory_units
      set status = 'IN_STOCK'
      where id = v_inventory_unit_id;

      insert into public.stock_movements (
        organization_id, store_id, product_id, inventory_unit_id, reason,
        quantity_delta, reference_type, reference_id, performed_by_id
      ) values (
        p_organization_id, p_store_id, v_product_id, v_inventory_unit_id, 'SALE_VOID_RESTOCK',
        v_qty, 'return', v_return_id, p_created_by_id
      );
    else
      update public.stock_levels
      set quantity_on_hand = quantity_on_hand + v_qty
      where store_id = p_store_id and product_id = v_product_id;

      insert into public.stock_movements (
        organization_id, store_id, product_id, inventory_unit_id, reason,
        quantity_delta, reference_type, reference_id, performed_by_id
      ) values (
        p_organization_id, p_store_id, v_product_id, v_inventory_unit_id, 'SALE_VOID_RESTOCK',
        v_qty, 'return', v_return_id, p_created_by_id
      );
    end if;
  end loop;

  if p_refund_method = 'STORE_CREDIT' then
    update public.customers
    set store_credit_cents = store_credit_cents + p_total_cents
    where id = p_customer_id;

    insert into public.store_credit_transactions (
      organization_id, store_id, customer_id, amount_cents, reason,
      reference_type, reference_id, created_by_id
    ) values (
      p_organization_id, p_store_id, p_customer_id, p_total_cents, 'return_credit',
      'return', v_return_id, p_created_by_id
    );
  end if;

  select coalesce(sum(total_cents), 0) into v_already_refunded_cents
  from public.returns
  where sale_id = p_sale_id;

  if v_already_refunded_cents >= v_sale_total_cents then
    if public.current_staff_role() not in ('OWNER', 'ADMIN') then
      raise exception 'Only an owner or admin can process a full refund';
    end if;
    update public.sales set status = 'REFUNDED' where id = p_sale_id;
  end if;

  return query select v_return_id;
end;
$$;

grant execute on function public.create_return(
  text, text, text, text, text, jsonb, int, int, int, text, text, text
) to authenticated;
