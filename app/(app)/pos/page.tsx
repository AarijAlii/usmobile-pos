import { PageHeader } from "@/components/layout/page-header";
import { PosTerminal, type SellableItem, type CustomerOption } from "@/components/pos/pos-terminal";
import { requireCurrentStaff, getActiveStoreId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function PosPage() {
  const staff = await requireCurrentStaff();
  const storeId = await getActiveStoreId(staff);
  const supabase = await createClient();

  const [units, levels, customers, store] = await Promise.all([
    supabase
      .from("inventory_units")
      .select("id, imei, asking_price_cents, product:products(id, name, default_price_cents)")
      .eq("store_id", storeId)
      .eq("status", "IN_STOCK")
      .order("created_at", { ascending: false }),
    supabase
      .from("stock_levels")
      .select("quantity_on_hand, product:products(id, name, default_price_cents)")
      .eq("store_id", storeId)
      .gt("quantity_on_hand", 0),
    supabase
      .from("customers")
      .select("id, full_name, phone")
      .eq("organization_id", staff.organizationId)
      .order("full_name", { ascending: true })
      .limit(50),
    supabase.from("stores").select("tax_rate_bps").eq("id", storeId).single(),
  ]);

  const items: SellableItem[] = [
    ...(units.data ?? []).map((u): SellableItem => {
      const product = u.product as unknown as { id: string; name: string; default_price_cents: number } | null;
      return {
        kind: "DEVICE",
        productId: product?.id ?? "",
        inventoryUnitId: u.id,
        name: product?.name ?? "Unknown device",
        detail: u.imei ?? undefined,
        priceCents: u.asking_price_cents ?? product?.default_price_cents ?? 0,
        maxQuantity: 1,
      };
    }),
    ...(levels.data ?? []).map((l): SellableItem => {
      const product = l.product as unknown as { id: string; name: string; default_price_cents: number } | null;
      return {
        kind: "ACCESSORY",
        productId: product?.id ?? "",
        name: product?.name ?? "Unknown item",
        priceCents: product?.default_price_cents ?? 0,
        maxQuantity: l.quantity_on_hand,
      };
    }),
  ];

  const customerOptions: CustomerOption[] = (customers.data ?? []).map((c) => ({
    id: c.id,
    fullName: c.full_name,
    phone: c.phone,
  }));

  return (
    <div>
      <PageHeader title="Point of Sale" description="Build a cart and charge with Stripe." />
      <div className="p-6 md:p-8">
        <PosTerminal
          items={items}
          customers={customerOptions}
          taxRateBps={store.data?.tax_rate_bps ?? 0}
        />
      </div>
    </div>
  );
}
