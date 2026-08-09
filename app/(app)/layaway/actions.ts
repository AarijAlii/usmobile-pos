"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentStaff, getActiveStoreId } from "@/lib/auth";
import { calcSaleTotals } from "@/lib/money";
import { createLayawaySchema, addLayawayPaymentSchema } from "@/lib/validations/layaway";
import { calcRemainingCents } from "@/lib/layaway";
import { stripe } from "@/lib/stripe";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function createLayaway(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireCurrentStaff();
  const storeId = await getActiveStoreId(staff);

  const parsed = createLayawaySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;
  const supabase = await createClient();

  const { data: store } = await supabase
    .from("stores")
    .select("tax_rate_bps")
    .eq("id", storeId)
    .single();
  if (!store) return { error: "Store not found" };

  const { data: unit } = await supabase
    .from("inventory_units")
    .select("id, status, product:products(name)")
    .eq("id", input.inventoryUnitId)
    .single();
  if (!unit) return { error: "Device not found" };
  if (unit.status !== "IN_STOCK") return { error: "This device is no longer available." };

  const deviceName =
    (unit.product as unknown as { name: string } | null)?.name ?? "Device";

  let resolvedCustomerId = input.customerId || undefined;
  if (!resolvedCustomerId && input.newCustomerName) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert({
        organization_id: staff.organizationId,
        full_name: input.newCustomerName,
        phone: input.newCustomerPhone || null,
      })
      .select("id")
      .single();
    if (customerError || !customer) return { error: "Failed to create customer" };
    resolvedCustomerId = customer.id;
  }
  if (!resolvedCustomerId) {
    return { error: "A customer is required for a layaway." };
  }

  const totals = calcSaleTotals([{ unitPriceCents: input.priceCents, quantity: 1 }], store.tax_rate_bps);

  const { data: rpcResult, error: rpcError } = await supabase
    .rpc("create_layaway", {
      p_organization_id: staff.organizationId,
      p_store_id: storeId,
      p_customer_id: resolvedCustomerId,
      p_created_by_id: staff.id,
      p_inventory_unit_id: input.inventoryUnitId,
      p_subtotal_cents: totals.subtotalCents,
      p_tax_cents: totals.taxCents,
      p_total_cents: totals.totalCents,
      p_deposit_cents: input.depositCents,
      p_due_date: new Date(input.dueDate).toISOString(),
    })
    .single();

  if (rpcError || !rpcResult) {
    return { error: rpcError?.message ?? "Failed to create layaway" };
  }
  const { layaway_id: layawayId, layaway_payment_id: paymentId } = rpcResult as {
    layaway_id: string;
    layaway_payment_id: string;
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.depositCents,
          product_data: { name: `Layaway deposit — ${deviceName}` },
        },
      },
    ],
    success_url: `${appUrl}/layaway/${layawayId}`,
    cancel_url: `${appUrl}/layaway?cancelled=1`,
    metadata: { layawayPaymentId: paymentId },
  });

  await supabase
    .from("layaway_payments")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", paymentId);

  redirect(session.url!);
}

export async function addLayawayPayment(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireCurrentStaff();
  const parsed = addLayawayPaymentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { layawayId, amountCents } = parsed.data;
  const supabase = await createClient();

  const { data: layaway } = await supabase
    .from("layaways")
    .select("status, total_cents, paid_cents, inventory_unit:inventory_units(product:products(name))")
    .eq("id", layawayId)
    .single();
  if (!layaway) return { error: "Layaway not found" };
  if (layaway.status !== "ACTIVE") return { error: "This layaway is no longer active." };

  const remaining = calcRemainingCents(layaway.total_cents, layaway.paid_cents);
  if (amountCents > remaining) {
    return { error: `Payment cannot exceed the remaining balance of ${remaining} cents.` };
  }

  const deviceName =
    (
      (layaway.inventory_unit as unknown as { product: { name: string } | null } | null)
        ?.product as { name: string } | null
    )?.name ?? "Device";

  const { data: payment, error: paymentError } = await supabase
    .from("layaway_payments")
    .insert({ layaway_id: layawayId, amount_cents: amountCents, status: "AWAITING_PAYMENT" })
    .select("id")
    .single();
  if (paymentError || !payment) return { error: "Failed to record payment" };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: { name: `Layaway payment — ${deviceName}` },
        },
      },
    ],
    success_url: `${appUrl}/layaway/${layawayId}`,
    cancel_url: `${appUrl}/layaway/${layawayId}?cancelled=1`,
    metadata: { layawayPaymentId: payment.id },
  });

  await supabase
    .from("layaway_payments")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", payment.id);

  redirect(session.url!);
}

async function releaseLayaway(layawayId: string, newStatus: "CANCELLED" | "FORFEITED"): Promise<ActionState> {
  await requireCurrentStaff();
  const supabase = await createClient();

  const { error } = await supabase.rpc("release_layaway", {
    p_layaway_id: layawayId,
    p_new_status: newStatus,
  });
  if (error) return { error: error.message };
  return { success: true };
}

export async function cancelLayaway(layawayId: string): Promise<ActionState> {
  return releaseLayaway(layawayId, "CANCELLED");
}

export async function forfeitLayaway(layawayId: string): Promise<ActionState> {
  return releaseLayaway(layawayId, "FORFEITED");
}
