"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canManage, requireCurrentStaff } from "@/lib/auth";
import { calcReturnTotals, calcReturnableQuantity, wouldFullyRefundSale } from "@/lib/returns";
import { stripe } from "@/lib/stripe";

export interface ReturnActionState {
  error?: string;
  success?: boolean;
}

export interface ReturnLineItemSelection {
  saleLineItemId: string;
  quantity: number;
}

export type RefundMethod = "STRIPE" | "STORE_CREDIT";

export async function createReturn(
  saleId: string,
  reason: string,
  selections: ReturnLineItemSelection[],
  refundMethod: RefundMethod = "STRIPE",
): Promise<ReturnActionState> {
  const staff = await requireCurrentStaff();

  const cleanSelections = selections.filter((s) => s.quantity > 0);
  if (cleanSelections.length === 0) {
    return { error: "Select at least one item to return." };
  }

  const supabase = await createClient();

  const { data: sale } = await supabase
    .from("sales")
    .select(
      "id, organization_id, store_id, customer_id, status, subtotal_cents, tax_cents, total_cents, stripe_payment_intent_id",
    )
    .eq("id", saleId)
    .single();

  if (!sale) return { error: "Sale not found." };
  if (sale.status !== "PAID") return { error: "This sale is not eligible for a return." };
  if (refundMethod === "STORE_CREDIT" && !sale.customer_id) {
    return { error: "This sale has no customer on file to credit." };
  }
  if (refundMethod === "STRIPE" && !sale.stripe_payment_intent_id) {
    return { error: "This sale has no payment on file to refund." };
  }

  const { data: lineItems } = await supabase
    .from("sale_line_items")
    .select("id, quantity, unit_price_cents")
    .eq("sale_id", saleId);

  if (!lineItems || lineItems.length === 0) {
    return { error: "Failed to load sale line items." };
  }
  const lineItemById = new Map(lineItems.map((l) => [l.id, l]));

  const { data: existingReturns } = await supabase
    .from("returns")
    .select("id, total_cents")
    .eq("sale_id", saleId);

  const alreadyRefundedCents = (existingReturns ?? []).reduce((sum, r) => sum + r.total_cents, 0);

  const alreadyReturnedByLineItem = new Map<string, number>();
  const existingReturnIds = (existingReturns ?? []).map((r) => r.id);
  if (existingReturnIds.length > 0) {
    const { data: existingReturnLineItems } = await supabase
      .from("return_line_items")
      .select("sale_line_item_id, quantity")
      .in("return_id", existingReturnIds);
    for (const row of existingReturnLineItems ?? []) {
      alreadyReturnedByLineItem.set(
        row.sale_line_item_id,
        (alreadyReturnedByLineItem.get(row.sale_line_item_id) ?? 0) + row.quantity,
      );
    }
  }

  // Re-validate every selection server-side — never trust client-submitted quantities.
  for (const selection of cleanSelections) {
    const lineItem = lineItemById.get(selection.saleLineItemId);
    if (!lineItem) return { error: "One of the selected items is not part of this sale." };

    const returnable = calcReturnableQuantity(
      lineItem.quantity,
      alreadyReturnedByLineItem.get(lineItem.id) ?? 0,
    );
    if (selection.quantity > returnable) {
      return { error: "One of the selected items has already been fully returned." };
    }
  }

  const totals = calcReturnTotals(
    cleanSelections.map((s) => ({
      unitPriceCents: lineItemById.get(s.saleLineItemId)!.unit_price_cents,
      quantity: s.quantity,
    })),
    sale.subtotal_cents,
    sale.tax_cents,
  );

  // A return that fully refunds the sale requires OWNER/ADMIN. Checked here,
  // before Stripe is ever called, so an unqualified staff member's request
  // never reaches the point of moving money — see prisma/return_function.sql
  // for why this can't be left to the DB layer alone once Stripe is involved.
  if (wouldFullyRefundSale(sale.total_cents, alreadyRefundedCents, totals.totalCents) && !canManage(staff)) {
    return { error: "Only an owner or admin can process a full refund." };
  }

  let stripeRefundId: string | null = null;
  if (refundMethod === "STRIPE") {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: sale.stripe_payment_intent_id!,
        amount: totals.totalCents,
        reason: "requested_by_customer",
      });
      stripeRefundId = refund.id;
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Stripe refund failed." };
    }
  }

  const { error: rpcError } = await supabase.rpc("create_return", {
    p_organization_id: sale.organization_id,
    p_store_id: sale.store_id,
    p_sale_id: saleId,
    p_created_by_id: staff.id,
    p_reason: reason.trim() || null,
    p_line_items: cleanSelections.map((s) => ({
      sale_line_item_id: s.saleLineItemId,
      quantity: s.quantity,
    })),
    p_subtotal_cents: totals.subtotalCents,
    p_tax_cents: totals.taxCents,
    p_total_cents: totals.totalCents,
    p_refund_method: refundMethod,
    p_stripe_refund_id: stripeRefundId,
    p_customer_id: refundMethod === "STORE_CREDIT" ? sale.customer_id : null,
  });

  if (rpcError) {
    return {
      error: stripeRefundId
        ? `Stripe refund ${stripeRefundId} succeeded but saving the return failed (${rpcError.message}). Note this refund ID for manual reconciliation.`
        : rpcError.message,
    };
  }

  revalidatePath(`/pos/receipt/${saleId}`);
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/pos");
  return { success: true };
}
