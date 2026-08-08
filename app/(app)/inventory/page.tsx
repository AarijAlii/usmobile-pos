import { PageHeader } from "@/components/layout/page-header";
import { ItemFormDialog } from "@/components/inventory/item-form-dialog";
import { InventoryTable, type InventoryRow } from "@/components/inventory/inventory-table";
import { requireCurrentStaff, getActiveStoreId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function InventoryPage() {
  const staff = await requireCurrentStaff();
  const storeId = await getActiveStoreId(staff);
  const supabase = await createClient();

  const [units, levels] = await Promise.all([
    supabase
      .from("inventory_units")
      .select("id, imei, condition, status, asking_price_cents, product:products(id, sku, name, brand, model)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false }),
    supabase
      .from("stock_levels")
      .select("id, quantity_on_hand, reorder_level, product:products(id, sku, name, brand, model, default_price_cents)")
      .eq("store_id", storeId)
      .order("updated_at", { ascending: false }),
  ]);

  const rows: InventoryRow[] = [
    ...(units.data ?? []).map((u): InventoryRow => {
      const product = u.product as unknown as {
        id: string; sku: string; name: string; brand: string | null; model: string | null;
      } | null;
      return {
        kind: "DEVICE",
        id: u.id,
        productId: product?.id ?? "",
        sku: product?.sku ?? "",
        name: product?.name ?? "Unknown device",
        detail: u.imei ?? "—",
        priceCents: u.asking_price_cents ?? 0,
        status: u.status,
        quantity: null,
      };
    }),
    ...(levels.data ?? []).map((l): InventoryRow => {
      const product = l.product as unknown as {
        id: string; sku: string; name: string; default_price_cents: number;
      } | null;
      return {
        kind: "ACCESSORY",
        id: l.id,
        productId: product?.id ?? "",
        sku: product?.sku ?? "",
        name: product?.name ?? "Unknown item",
        detail: `Reorder at ${l.reorder_level}`,
        priceCents: product?.default_price_cents ?? 0,
        status: l.quantity_on_hand <= l.reorder_level ? "LOW_STOCK" : "IN_STOCK",
        quantity: l.quantity_on_hand,
      };
    }),
  ];

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Devices tracked by IMEI, accessories tracked by quantity."
        action={<ItemFormDialog />}
      />
      <div className="p-6 md:p-8">
        <InventoryTable rows={rows} />
      </div>
    </div>
  );
}
