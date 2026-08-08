"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentStaff, getActiveStoreId } from "@/lib/auth";
import { assertValidRepairStatusTransition, type RepairStatus } from "@/lib/repair-status";
import { canFulfillQuantity, decrementQuantity } from "@/lib/inventory";
import {
  createRepairTicketSchema,
  advanceStatusSchema,
  addPartSchema,
  saveDiagnosisSchema,
  updateLaborSchema,
} from "@/lib/validations/repair";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function createRepairTicket(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireCurrentStaff();
  const storeId = await getActiveStoreId(staff);

  const parsed = createRepairTicketSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;
  const supabase = await createClient();

  let resolvedCustomerId = input.customerId || null;
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

  const { error } = await supabase.from("repair_tickets").insert({
    organization_id: staff.organizationId,
    store_id: storeId,
    customer_id: resolvedCustomerId,
    device_description: input.deviceDescription,
    imei: input.imei || null,
    reported_issue: input.reportedIssue,
    labor_cents: input.laborCents,
    parts_total_cents: 0,
    total_cents: input.laborCents,
    status: "INTAKE",
  });

  if (error) return { error: error.message };

  revalidatePath("/repairs");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function advanceStatus(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireCurrentStaff();
  const parsed = advanceStatusSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Invalid input" };

  const { ticketId, toStatus } = parsed.data;
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("repair_tickets")
    .select("status")
    .eq("id", ticketId)
    .single();
  if (!ticket) return { error: "Ticket not found" };

  try {
    assertValidRepairStatusTransition(ticket.status as RepairStatus, toStatus as RepairStatus);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { error } = await supabase
    .from("repair_tickets")
    .update({ status: toStatus })
    .eq("id", ticketId);
  if (error) return { error: error.message };

  revalidatePath(`/repairs/${ticketId}`);
  revalidatePath("/repairs");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function markCustomerNotified(ticketId: string): Promise<ActionState> {
  await requireCurrentStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("repair_tickets")
    .update({ customer_notified_at: new Date().toISOString() })
    .eq("id", ticketId);
  if (error) return { error: error.message };

  revalidatePath(`/repairs/${ticketId}`);
  return { success: true };
}

export async function addPart(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireCurrentStaff();
  const storeId = await getActiveStoreId(staff);
  const parsed = addPartSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { ticketId, productId, quantity } = parsed.data;
  const supabase = await createClient();

  const [{ data: ticket }, { data: product }, { data: level }] = await Promise.all([
    supabase.from("repair_tickets").select("labor_cents, parts_total_cents").eq("id", ticketId).single(),
    supabase.from("products").select("id, default_price_cents, is_part").eq("id", productId).single(),
    supabase
      .from("stock_levels")
      .select("id, quantity_on_hand")
      .eq("store_id", storeId)
      .eq("product_id", productId)
      .single(),
  ]);

  if (!ticket || !product) return { error: "Ticket or part not found" };
  if (!product.is_part) return { error: "This item is not marked as a repair part" };
  if (!level || !canFulfillQuantity(level.quantity_on_hand, quantity)) {
    return { error: "Not enough stock for this part" };
  }

  const lineTotalCents = product.default_price_cents * quantity;

  const { error: partError } = await supabase.from("repair_parts_used").insert({
    repair_ticket_id: ticketId,
    product_id: productId,
    quantity,
    unit_cost_cents: product.default_price_cents,
    line_total_cents: lineTotalCents,
  });
  if (partError) return { error: partError.message };

  await supabase
    .from("stock_levels")
    .update({ quantity_on_hand: decrementQuantity(level.quantity_on_hand, quantity) })
    .eq("id", level.id);

  await supabase.from("stock_movements").insert({
    organization_id: staff.organizationId,
    store_id: storeId,
    product_id: productId,
    reason: "REPAIR_PART_CONSUMED",
    quantity_delta: -quantity,
    reference_type: "repair_ticket",
    reference_id: ticketId,
    performed_by_id: staff.id,
  });

  const newPartsTotal = ticket.parts_total_cents + lineTotalCents;
  await supabase
    .from("repair_tickets")
    .update({
      parts_total_cents: newPartsTotal,
      total_cents: newPartsTotal + ticket.labor_cents,
    })
    .eq("id", ticketId);

  revalidatePath(`/repairs/${ticketId}`);
  return { success: true };
}

export async function updateLabor(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireCurrentStaff();
  const parsed = updateLaborSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { ticketId, laborCents } = parsed.data;
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("repair_tickets")
    .select("parts_total_cents")
    .eq("id", ticketId)
    .single();
  if (!ticket) return { error: "Ticket not found" };

  const { error } = await supabase
    .from("repair_tickets")
    .update({ labor_cents: laborCents, total_cents: laborCents + ticket.parts_total_cents })
    .eq("id", ticketId);
  if (error) return { error: error.message };

  revalidatePath(`/repairs/${ticketId}`);
  return { success: true };
}

export async function saveDiagnosis(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireCurrentStaff();
  const parsed = saveDiagnosisSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Invalid input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("repair_tickets")
    .update({ diagnosis_notes: parsed.data.diagnosisNotes })
    .eq("id", parsed.data.ticketId);
  if (error) return { error: error.message };

  revalidatePath(`/repairs/${parsed.data.ticketId}`);
  return { success: true };
}
