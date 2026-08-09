-- USMobile POS — atomic sale fulfillment
--
-- Not run automatically; fold into a migration once applying against a live
-- Supabase project (same process as the other prisma/*_function.sql files).
--
-- Single source of truth for "a sale's payment has been confirmed": marks
-- the sale PAID, decrements inventory per line item (skipping SERVICE
-- products, which are never stocked), logs stock_movements, and redeems any
-- store credit that was applied at checkout time. Used from two places:
--   1. The Stripe webhook, once checkout.session.completed fires.
--   2. The checkout server action itself, when store credit alone covers
--      the full total and no Stripe session is ever created.
-- Centralizing this avoids duplicating the decrement/restock logic (and
-- getting it out of sync) between those two call sites.
--
-- Idempotent: a no-op if the sale isn't AWAITING_PAYMENT (already finalized,
-- or Stripe redelivered the same webhook event). The `for update` lock on
-- the sale row makes that check-then-act safe against concurrent delivery.
--
-- SECURITY INVOKER: when called from the checkout action (a real staff
-- session), RLS on sales/inventory_units/stock_levels/customers/
-- store_credit_transactions/stock_movements still applies. When called from
-- the Stripe webhook (service-role client, no user session), RLS is bypassed
-- at the connection level regardless of this function's security mode.

create or replace function public.finalize_sale_payment(
  p_sale_id text,
  p_stripe_payment_intent_id text default null
)
returns void
language plpgsql
security invoker
as $$
declare
  v_status text;
  v_store_id text;
  v_org_id text;
  v_customer_id text;
  v_store_credit_applied int;
  v_created_by_id text;
  v_item record;
begin
  select status, store_id, organization_id, customer_id, store_credit_applied_cents, created_by_id
  into v_status, v_store_id, v_org_id, v_customer_id, v_store_credit_applied, v_created_by_id
  from public.sales
  where id = p_sale_id
  for update;

  if v_status is distinct from 'AWAITING_PAYMENT' then
    return; -- already finalized, or Stripe redelivered the event
  end if;

  for v_item in
    select sli.product_id, sli.inventory_unit_id, sli.quantity, p.tracking_type
    from public.sale_line_items sli
    join public.products p on p.id = sli.product_id
    where sli.sale_id = p_sale_id
  loop
    if v_item.tracking_type = 'SERVICE' then
      continue; -- intangible — never stocked, nothing to decrement
    elsif v_item.inventory_unit_id is not null then
      update public.inventory_units set status = 'SOLD' where id = v_item.inventory_unit_id;
    else
      update public.stock_levels
      set quantity_on_hand = greatest(0, quantity_on_hand - v_item.quantity)
      where store_id = v_store_id and product_id = v_item.product_id;
    end if;

    insert into public.stock_movements (
      organization_id, store_id, product_id, inventory_unit_id, reason,
      quantity_delta, reference_type, reference_id, performed_by_id
    ) values (
      v_org_id, v_store_id, v_item.product_id, v_item.inventory_unit_id, 'SALE',
      -v_item.quantity, 'sale', p_sale_id, v_created_by_id
    );
  end loop;

  if v_store_credit_applied > 0 then
    if v_customer_id is null then
      raise exception 'Sale has store credit applied but no customer on the sale';
    end if;

    update public.customers
    set store_credit_cents = store_credit_cents - v_store_credit_applied
    where id = v_customer_id;

    insert into public.store_credit_transactions (
      organization_id, store_id, customer_id, amount_cents, reason,
      reference_type, reference_id, created_by_id
    ) values (
      v_org_id, v_store_id, v_customer_id, -v_store_credit_applied, 'sale_redemption',
      'sale', p_sale_id, v_created_by_id
    );
  end if;

  update public.sales
  set
    status = 'PAID',
    stripe_payment_intent_id = coalesce(p_stripe_payment_intent_id, stripe_payment_intent_id)
  where id = p_sale_id;
end;
$$;

grant execute on function public.finalize_sale_payment(text, text) to authenticated;
