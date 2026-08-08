import express from "express";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

/**
 * Standalone Express service — demonstrates the Stripe webhook receiver
 * running as an always-on Node process (Docker-deployable), separate from
 * the serverless Next.js app on Vercel.
 *
 * NOTE: for the actual deployed demo, Stripe's webhook is registered against
 * the Next.js Route Handler (app/api/stripe/webhook/route.ts) instead, so
 * the demo has exactly one deploy target. This service is the "how it would
 * run in a production topology with dedicated workers" version — run it
 * locally with `npm run dev` (in server/) and `stripe listen --forward-to
 * localhost:4000/webhooks/stripe` to see it work end to end. The processing
 * logic is intentionally duplicated (not imported) from the Next.js route
 * since this is a separate deployable package with its own dependencies.
 */

const PORT = process.env.PORT ?? 4000;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const app = express();

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Raw body required for Stripe signature verification — must be registered
// before any JSON body-parsing middleware.
app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature || typeof signature !== "string") {
      return res.status(400).json({ error: "Missing signature" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err) {
      return res
        .status(400)
        .json({ error: `Signature verification failed: ${(err as Error).message}` });
    }

    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    }

    res.json({ received: true });
  },
);

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const saleId = session.metadata?.saleId;
  if (!saleId) return;

  const { data: sale } = await supabase
    .from("sales")
    .select("id, status, organization_id, store_id")
    .eq("id", saleId)
    .single();

  if (!sale || sale.status === "PAID") return; // idempotent against Stripe retries

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

app.listen(PORT, () => {
  console.log(`Webhook service listening on port ${PORT}`);
});
