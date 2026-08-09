"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentStaff, getActiveStoreId } from "@/lib/auth";

export interface HeldSaleActionState {
  error?: string;
  success?: boolean;
}

export interface HeldCartLine {
  productId?: string;
  inventoryUnitId?: string;
  bundleId?: string;
  quantity: number;
}

export async function holdSale(
  cart: HeldCartLine[],
  customerId: string | null,
  note: string,
): Promise<HeldSaleActionState> {
  const staff = await requireCurrentStaff();
  const storeId = await getActiveStoreId(staff);

  if (cart.length === 0) {
    return { error: "Cart is empty — nothing to hold." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("held_sales").insert({
    organization_id: staff.organizationId,
    store_id: storeId,
    created_by_id: staff.id,
    customer_id: customerId,
    note: note.trim() || null,
    cart,
  });

  if (error) return { error: error.message };

  revalidatePath("/pos");
  return { success: true };
}

export interface ResumeHeldSaleResult extends HeldSaleActionState {
  cart?: HeldCartLine[];
  customerId?: string | null;
}

export async function resumeHeldSale(id: string): Promise<ResumeHeldSaleResult> {
  await requireCurrentStaff();
  const supabase = await createClient();

  const { data: held } = await supabase
    .from("held_sales")
    .select("cart, customer_id")
    .eq("id", id)
    .single();

  if (!held) return { error: "This held sale no longer exists." };

  const { error: deleteError } = await supabase.from("held_sales").delete().eq("id", id);
  if (deleteError) return { error: deleteError.message };

  revalidatePath("/pos");
  return { success: true, cart: held.cart as HeldCartLine[], customerId: held.customer_id };
}

export async function discardHeldSale(id: string): Promise<HeldSaleActionState> {
  await requireCurrentStaff();
  const supabase = await createClient();

  const { error } = await supabase.from("held_sales").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/pos");
  return { success: true };
}
