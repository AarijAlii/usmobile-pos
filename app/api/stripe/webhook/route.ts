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
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
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
