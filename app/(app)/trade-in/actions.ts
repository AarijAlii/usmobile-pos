"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentStaff, getActiveStoreId } from "@/lib/auth";
import { buybackSchema } from "@/lib/validations/buyback";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function createBuyback(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireCurrentStaff();
  const storeId = await getActiveStoreId(staff);

  const parsed = buybackSchema.safeParse(Object.fromEntries(formData.entries()));
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
    if (customerError || !customer) {
      return { error: "Failed to create customer" };
    }
    resolvedCustomerId = customer.id;
  }

  const { data: existingProduct } = await supabase
    .from("products")
    .select("id")
    .eq("organization_id", staff.organizationId)
    .eq("sku", input.sku)
    .maybeSingle();

  let productId = existingProduct?.id as string | undefined;
  if (!productId) {
    const { data: newProduct, error: productError } = await supabase
      .from("products")
      .insert({
        organization_id: staff.organizationId,
        sku: input.sku,
        name: input.name,
        category: "phone",
        tracking_type: "SERIALIZED",
        brand: input.brand || null,
        model: input.model || null,
        default_price_cents: input.offerPriceCents,
      })
      .select("id")
      .single();
    if (productError || !newProduct) {
      return { error: productError?.message ?? "Failed to create product" };
    }
    productId = newProduct.id;
  }

  const { error: rpcError } = await supabase.rpc("create_buyback_with_inventory", {
    p_organization_id: staff.organizationId,
    p_store_id: storeId,
    p_customer_id: resolvedCustomerId,
    p_created_by_id: staff.id,
    p_product_id: productId,
    p_device_description: input.name,
    p_imei: input.imei,
    p_condition_notes: input.conditionNotes,
    p_offer_price_cents: input.offerPriceCents,
    p_payout_method: input.payoutMethod,
  });

  if (rpcError) {
    return {
      error: rpcError.message.includes("duplicate")
        ? "An item with this IMEI/serial already exists."
        : rpcError.message,
    };
  }

  revalidatePath("/trade-in");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: true };
}
