"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentStaff, getActiveStoreId } from "@/lib/auth";
import {
  inventoryItemSchema,
  receiveStockSchema,
} from "@/lib/validations/inventory";

export interface ActionState {
  error?: string;
  success?: boolean;
}

function parseFormData(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(formData.entries());
}

export async function createInventoryItem(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireCurrentStaff();
  const storeId = await getActiveStoreId(staff);

  const parsed = inventoryItemSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;
  const supabase = await createClient();

  // Find or create the catalog Product for this SKU.
  const { data: existingProduct } = await supabase
    .from("products")
    .select("id, tracking_type")
    .eq("organization_id", staff.organizationId)
    .eq("sku", input.sku)
    .maybeSingle();

  let productId = existingProduct?.id as string | undefined;

  if (!productId) {
    const trackingType =
      input.type === "DEVICE" ? "SERIALIZED" : input.type === "SERVICE" ? "SERVICE" : "QUANTITY";
    const category =
      input.type === "DEVICE" ? "phone" : input.type === "SERVICE" ? "warranty" : "accessory";

    const { data: newProduct, error: productError } = await supabase
      .from("products")
      .insert({
        organization_id: staff.organizationId,
        sku: input.sku,
        name: input.name,
        category,
        tracking_type: trackingType,
        brand: input.brand || null,
        model: input.model || null,
        default_price_cents: input.priceCents,
        is_part: input.type === "ACCESSORY" ? input.isPart : false,
      })
      .select("id")
      .single();

    if (productError || !newProduct) {
      return { error: productError?.message ?? "Failed to create product" };
    }
    productId = newProduct.id;
  } else if (input.type === "SERVICE") {
    return { error: `A service plan with SKU ${input.sku} already exists.` };
  }

  if (input.type === "SERVICE") {
    revalidatePath("/inventory");
    return { success: true };
  }

  if (input.type === "DEVICE") {
    const { data: unit, error: unitError } = await supabase
      .from("inventory_units")
      .insert({
        organization_id: staff.organizationId,
        store_id: storeId,
        product_id: productId,
        imei: input.imei,
        status: "IN_STOCK",
        condition: input.condition,
        cost_cents: input.costCents ?? null,
        asking_price_cents: input.priceCents,
      })
      .select("id")
      .single();

    if (unitError || !unit) {
      return {
        error: unitError?.message.includes("duplicate")
          ? "An item with this IMEI/serial already exists."
          : (unitError?.message ?? "Failed to add device"),
      };
    }

    await supabase.from("stock_movements").insert({
      organization_id: staff.organizationId,
      store_id: storeId,
      product_id: productId,
      inventory_unit_id: unit.id,
      reason: "INITIAL_STOCK",
      quantity_delta: 1,
      reference_type: "manual",
      performed_by_id: staff.id,
    });
  } else {
    const { data: existingLevel } = await supabase
      .from("stock_levels")
      .select("id, quantity_on_hand")
      .eq("store_id", storeId)
      .eq("product_id", productId)
      .maybeSingle();

    if (existingLevel) {
      await supabase
        .from("stock_levels")
        .update({
          quantity_on_hand: existingLevel.quantity_on_hand + input.quantity,
          reorder_level: input.reorderLevel,
        })
        .eq("id", existingLevel.id);
    } else {
      await supabase.from("stock_levels").insert({
        organization_id: staff.organizationId,
        store_id: storeId,
        product_id: productId,
        quantity_on_hand: input.quantity,
        reorder_level: input.reorderLevel,
      });
    }

    await supabase.from("stock_movements").insert({
      organization_id: staff.organizationId,
      store_id: storeId,
      product_id: productId,
      reason: "INITIAL_STOCK",
      quantity_delta: input.quantity,
      reference_type: "manual",
      performed_by_id: staff.id,
    });
  }

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function receiveStock(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireCurrentStaff();
  const storeId = await getActiveStoreId(staff);

  const parsed = receiveStockSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { productId, quantity } = parsed.data;
  const supabase = await createClient();

  const { data: level } = await supabase
    .from("stock_levels")
    .select("id, quantity_on_hand")
    .eq("store_id", storeId)
    .eq("product_id", productId)
    .maybeSingle();

  if (!level) {
    return { error: "No stock record found for this item at this store." };
  }

  await supabase
    .from("stock_levels")
    .update({ quantity_on_hand: level.quantity_on_hand + quantity })
    .eq("id", level.id);

  await supabase.from("stock_movements").insert({
    organization_id: staff.organizationId,
    store_id: storeId,
    product_id: productId,
    reason: "MANUAL_ADJUSTMENT",
    quantity_delta: quantity,
    reference_type: "manual",
    performed_by_id: staff.id,
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: true };
}
