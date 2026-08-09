import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * No end-user session exists for a Stripe-initiated request, so this is one
 * of the two justified uses of the service-role client (see
 * lib/supabase/server.ts). Every write below is scoped explicitly by saleId
 * in application code since RLS is bypassed here by design.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text(); // raw body required for signature verification — do not parse as JSON first

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.layawayPaymentId) {
      await handleLayawayPaymentCompleted(session);
    } else {
      await handleCheckoutCompleted(session);
    }
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const saleId = session.metadata?.saleId;
  if (!saleId) return;

  const supabase = createServiceRoleClient();

  const { data: sale } = await supabase
    .from("sales")
    .select("id, status, organization_id, store_id")
    .eq("id", saleId)
    .single();

  // Stripe may deliver the same event more than once — skip if already processed.
  if (!sale || sale.status === "PAID") return;

  const { data: lineItems } = await supabase
    .from("sale_line_items")
    .select("id, product_id, inventory_unit_id, quantity")
    .eq("sale_id", saleId);

  for (const item of lineItems ?? []) {
    if (item.inventory_unit_id) {
      await supabase
        .from("inventory_units")
        .update({ status: "SOLD" })
        .eq("id", item.inventory_unit_id);
    } else {
      const { data: level } = await supabase
        .from("stock_levels")
        .select("id, quantity_on_hand")
        .eq("store_id", sale.store_id)
        .eq("product_id", item.product_id)
        .single();

      if (level) {
        await supabase
          .from("stock_levels")
          .update({ quantity_on_hand: Math.max(0, level.quantity_on_hand - item.quantity) })
          .eq("id", level.id);
      }
    }

    await supabase.from("stock_movements").insert({
      organization_id: sale.organization_id,
      store_id: sale.store_id,
      product_id: item.product_id,
      inventory_unit_id: item.inventory_unit_id,
      reason: "SALE",
      quantity_delta: -item.quantity,
      reference_type: "sale",
      reference_id: saleId,
    });
  }

  await supabase
    .from("sales")
    .update({
      status: "PAID",
      stripe_payment_intent_id:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
    })
    .eq("id", saleId);
}

async function handleLayawayPaymentCompleted(session: Stripe.Checkout.Session) {
  const paymentId = session.metadata?.layawayPaymentId;
  if (!paymentId) return;

  const supabase = createServiceRoleClient();

  const { data: payment } = await supabase
    .from("layaway_payments")
    .select("id, status, amount_cents, layaway_id")
    .eq("id", paymentId)
    .single();

  // Stripe may deliver the same event more than once — skip if already processed.
  if (!payment || payment.status === "PAID") return;

  await supabase
    .from("layaway_payments")
    .update({
      status: "PAID",
      stripe_payment_intent_id:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
    })
    .eq("id", paymentId);

  const { data: layaway } = await supabase
    .from("layaways")
    .select(
      "id, status, organization_id, store_id, customer_id, created_by_id, inventory_unit_id, subtotal_cents, tax_cents, total_cents, paid_cents",
    )
    .eq("id", payment.layaway_id)
    .single();
  if (!layaway) return;

  const newPaidCents = layaway.paid_cents + payment.amount_cents;

  if (newPaidCents < layaway.total_cents) {
    await supabase.from("layaways").update({ paid_cents: newPaidCents }).eq("id", layaway.id);
    return;
  }

  // Fully paid off — finalize: sell the reserved unit for real and record a
  // normal Sale so it reports alongside every other sale.
  const { data: unit } = await supabase
    .from("inventory_units")
    .select("id, product_id")
    .eq("id", layaway.inventory_unit_id)
    .single();

  const { data: sale } = await supabase
    .from("sales")
    .insert({
      organization_id: layaway.organization_id,
      store_id: layaway.store_id,
      customer_id: layaway.customer_id,
      created_by_id: layaway.created_by_id,
      status: "PAID",
      subtotal_cents: layaway.subtotal_cents,
      tax_cents: layaway.tax_cents,
      total_cents: layaway.total_cents,
    })
    .select("id")
    .single();

  if (sale && unit) {
    await supabase.from("sale_line_items").insert({
      sale_id: sale.id,
      product_id: unit.product_id,
      inventory_unit_id: unit.id,
      quantity: 1,
      unit_price_cents: layaway.subtotal_cents,
      line_total_cents: layaway.subtotal_cents,
    });

    await supabase.from("stock_movements").insert({
      organization_id: layaway.organization_id,
      store_id: layaway.store_id,
      product_id: unit.product_id,
      inventory_unit_id: unit.id,
      reason: "SALE",
      quantity_delta: -1,
      reference_type: "layaway",
      reference_id: layaway.id,
    });
  }

  await supabase
    .from("inventory_units")
    .update({ status: "SOLD" })
    .eq("id", layaway.inventory_unit_id);

  await supabase
    .from("layaways")
    .update({
      status: "PAID_OFF",
      paid_cents: newPaidCents,
      resulting_sale_id: sale?.id ?? null,
    })
    .eq("id", layaway.id);
}
