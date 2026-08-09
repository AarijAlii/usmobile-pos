"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentStaff, getActiveStoreId } from "@/lib/auth";
import { calcSaleTotals } from "@/lib/money";
import { canFulfillQuantity } from "@/lib/inventory";
import { allocateBundleDiscount } from "@/lib/bundles";
import { calcAppliedStoreCreditCents, calcRemainingAfterCredit } from "@/lib/store-credit";
import { checkoutSchema } from "@/lib/validations/pos";
import { stripe } from "@/lib/stripe";

export interface CheckoutState {
  error?: string;
}

export async function checkout(
  _prevState: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const staff = await requireCurrentStaff();
  const storeId = await getActiveStoreId(staff);

  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid checkout data" };
  }
  const { cart, customerId, newCustomerName, newCustomerPhone, applyStoreCreditCents } =
    parsed.data;

  const supabase = await createClient();

  const { data: store } = await supabase
    .from("stores")
    .select("tax_rate_bps")
    .eq("id", storeId)
    .single();

  if (!store) return { error: "Store not found" };

  // Re-price every line item server-side — never trust client-submitted prices.
  // `totalsInput` mirrors lineItems 1:1 except a bundle's components are
  // collapsed into a single {unitPriceCents: exactAllocatedTotal, quantity: 1}
  // entry — allocateBundleDiscount already guarantees those allocations sum
  // to exactly the bundle's price, and feeding calcSaleTotals the real
  // per-component (quantity, unitPriceCents) pairs would let its own
  // unitPriceCents * quantity rounding drift a cent away from that when a
  // component's per-bundle quantity is > 1.
  const lineItems: {
    productId: string;
    inventoryUnitId?: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }[] = [];
  const totalsInput: { unitPriceCents: number; quantity: number }[] = [];

  for (const line of cart) {
    if ("bundleId" in line) {
      const { data: bundle } = await supabase
        .from("bundles")
        .select("id, name, price_cents, is_active, items:bundle_items(quantity, product:products(id, name, default_price_cents))")
        .eq("id", line.bundleId)
        .single();

      if (!bundle || !bundle.is_active) {
        return { error: "One of the bundles in your cart is no longer available." };
      }

      const components = (bundle.items ?? []) as unknown as {
        quantity: number;
        product: { id: string; name: string; default_price_cents: number };
      }[];
      if (components.length === 0) {
        return { error: `${bundle.name} has no items configured.` };
      }

      for (const component of components) {
        const { data: level } = await supabase
          .from("stock_levels")
          .select("quantity_on_hand")
          .eq("store_id", storeId)
          .eq("product_id", component.product.id)
          .single();

        const neededQty = component.quantity * line.quantity;
        if (!level || !canFulfillQuantity(level.quantity_on_hand, neededQty)) {
          return { error: `Not enough stock for ${component.product.name} (in ${bundle.name}).` };
        }
      }

      const allocations = allocateBundleDiscount(
        bundle.price_cents * line.quantity,
        components.map((c) => ({
          unitPriceCents: c.product.default_price_cents,
          quantity: c.quantity * line.quantity,
        })),
      );

      components.forEach((component, i) => {
        const neededQty = component.quantity * line.quantity;
        const lineTotalCents = allocations[i];
        lineItems.push({
          productId: component.product.id,
          name: `${component.product.name} (${bundle.name})`,
          quantity: neededQty,
          unitPriceCents: Math.round(lineTotalCents / neededQty),
          lineTotalCents,
        });
        totalsInput.push({ unitPriceCents: lineTotalCents, quantity: 1 });
      });
      continue;
    }

    const { data: product } = await supabase
      .from("products")
      .select("id, name, default_price_cents, tracking_type")
      .eq("id", line.productId)
      .single();

    if (!product) return { error: "One of the items in your cart no longer exists." };

    if (line.inventoryUnitId) {
      const { data: unit } = await supabase
        .from("inventory_units")
        .select("id, status, asking_price_cents")
        .eq("id", line.inventoryUnitId)
        .single();

      if (!unit || unit.status !== "IN_STOCK") {
        return { error: `${product.name} is no longer available.` };
      }
      const unitPriceCents = unit.asking_price_cents ?? product.default_price_cents;
      lineItems.push({
        productId: product.id,
        inventoryUnitId: unit.id,
        name: product.name,
        quantity: 1,
        unitPriceCents,
        lineTotalCents: unitPriceCents,
      });
      totalsInput.push({ unitPriceCents, quantity: 1 });
    } else if (product.tracking_type === "SERVICE") {
      // Intangible — never stocked, so no availability check at all.
      lineItems.push({
        productId: product.id,
        name: product.name,
        quantity: line.quantity,
        unitPriceCents: product.default_price_cents,
        lineTotalCents: product.default_price_cents * line.quantity,
      });
      totalsInput.push({ unitPriceCents: product.default_price_cents, quantity: line.quantity });
    } else {
      const { data: level } = await supabase
        .from("stock_levels")
        .select("quantity_on_hand")
        .eq("store_id", storeId)
        .eq("product_id", product.id)
        .single();

      if (!level || !canFulfillQuantity(level.quantity_on_hand, line.quantity)) {
        return { error: `Not enough stock for ${product.name}.` };
      }
      lineItems.push({
        productId: product.id,
        name: product.name,
        quantity: line.quantity,
        unitPriceCents: product.default_price_cents,
        lineTotalCents: product.default_price_cents * line.quantity,
      });
      totalsInput.push({ unitPriceCents: product.default_price_cents, quantity: line.quantity });
    }
  }

  let resolvedCustomerId = customerId || undefined;
  if (!resolvedCustomerId && newCustomerName) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert({
        organization_id: staff.organizationId,
        full_name: newCustomerName,
        phone: newCustomerPhone || null,
      })
      .select("id")
      .single();
    if (customerError || !customer) {
      return { error: "Failed to create customer" };
    }
    resolvedCustomerId = customer.id;
  }

  const totals = calcSaleTotals(totalsInput, store.tax_rate_bps);

  // Store credit is applied against the SALE at checkout time but only
  // actually redeemed (balance decremented, ledger row written) once the
  // sale is finalized as PAID — see finalize_sale_payment(). Reserving it
  // here and spending it later would let an abandoned Stripe checkout burn
  // a customer's credit for nothing.
  let appliedStoreCreditCents = 0;
  if (resolvedCustomerId && applyStoreCreditCents) {
    const { data: customer } = await supabase
      .from("customers")
      .select("store_credit_cents")
      .eq("id", resolvedCustomerId)
      .single();
    const balance = customer?.store_credit_cents ?? 0;
    appliedStoreCreditCents = Math.min(
      applyStoreCreditCents,
      calcAppliedStoreCreditCents(balance, totals.totalCents),
    );
  }
  const remainingCents = calcRemainingAfterCredit(totals.totalCents, appliedStoreCreditCents);

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      organization_id: staff.organizationId,
      store_id: storeId,
      customer_id: resolvedCustomerId ?? null,
      created_by_id: staff.id,
      status: "AWAITING_PAYMENT",
      subtotal_cents: totals.subtotalCents,
      tax_cents: totals.taxCents,
      total_cents: totals.totalCents,
      store_credit_applied_cents: appliedStoreCreditCents,
    })
    .select("id")
    .single();

  if (saleError || !sale) {
    return { error: "Failed to create sale" };
  }

  const { error: lineItemsError } = await supabase.from("sale_line_items").insert(
    lineItems.map((l) => ({
      sale_id: sale.id,
      product_id: l.productId,
      inventory_unit_id: l.inventoryUnitId ?? null,
      quantity: l.quantity,
      unit_price_cents: l.unitPriceCents,
      line_total_cents: l.lineTotalCents,
    })),
  );

  if (lineItemsError) {
    return { error: "Failed to save sale line items" };
  }

  // Store credit fully covers the total — nothing to charge, so there's no
  // Stripe session at all. Finalize immediately (same atomic path the
  // webhook uses for a real payment) and go straight to the receipt.
  if (remainingCents === 0) {
    const { error: finalizeError } = await supabase.rpc("finalize_sale_payment", {
      p_sale_id: sale.id,
      p_stripe_payment_intent_id: null,
    });
    if (finalizeError) {
      return { error: `Failed to complete sale: ${finalizeError.message}` };
    }
    redirect(`/pos/receipt/${sale.id}`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Tax is pre-computed server-side (see calcSaleTotals) and added as its own
  // line item, rather than using Stripe Tax, so the receipt and the charged
  // amount always match our own ledger exactly. Each line's exact
  // lineTotalCents (not unitPriceCents * quantity) is charged as a single
  // unit so a bundle component's rounded display price never drifts the
  // actual amount charged.
  const stripeLineItems = lineItems.map((l) => ({
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: l.lineTotalCents,
      product_data: { name: l.quantity > 1 ? `${l.name} × ${l.quantity}` : l.name },
    },
  }));

  if (totals.taxCents > 0) {
    stripeLineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: totals.taxCents,
        product_data: { name: "Sales tax" },
      },
    });
  }

  let discounts: { coupon: string }[] | undefined;
  if (appliedStoreCreditCents > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: appliedStoreCreditCents,
      currency: "usd",
      duration: "once",
      name: "Store credit applied",
    });
    discounts = [{ coupon: coupon.id }];
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: stripeLineItems,
    discounts,
    success_url: `${appUrl}/pos/receipt/${sale.id}`,
    cancel_url: `${appUrl}/pos?cancelled=1`,
    metadata: { saleId: sale.id },
  });

  await supabase
    .from("sales")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", sale.id);

  redirect(session.url!);
}
