"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentStaff, getActiveStoreId } from "@/lib/auth";
import { calcSaleTotals } from "@/lib/money";
import { canFulfillQuantity } from "@/lib/inventory";
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
  const { cart, customerId, newCustomerName, newCustomerPhone } = parsed.data;

  const supabase = await createClient();

  const { data: store } = await supabase
    .from("stores")
    .select("tax_rate_bps")
    .eq("id", storeId)
    .single();

  if (!store) return { error: "Store not found" };

  // Re-price every line item server-side — never trust client-submitted prices.
  const lineItems: {
    productId: string;
    inventoryUnitId?: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
  }[] = [];

  for (const line of cart) {
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
      lineItems.push({
        productId: product.id,
        inventoryUnitId: unit.id,
        name: product.name,
        quantity: 1,
        unitPriceCents: unit.asking_price_cents ?? product.default_price_cents,
      });
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
      });
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

  const totals = calcSaleTotals(
    lineItems.map((l) => ({ unitPriceCents: l.unitPriceCents, quantity: l.quantity })),
    store.tax_rate_bps,
  );

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
      line_total_cents: l.unitPriceCents * l.quantity,
    })),
  );

  if (lineItemsError) {
    return { error: "Failed to save sale line items" };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Tax is pre-computed server-side (see calcSaleTotals) and added as its own
  // line item, rather than using Stripe Tax, so the receipt and the charged
  // amount always match our own ledger exactly.
  const stripeLineItems = lineItems.map((l) => ({
    quantity: l.quantity,
    price_data: {
      currency: "usd",
      unit_amount: l.unitPriceCents,
      product_data: { name: l.name },
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

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: stripeLineItems,
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
