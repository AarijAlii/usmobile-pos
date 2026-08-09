import { PageHeader } from "@/components/layout/page-header";
import { PosTerminal, type SellableItem, type CustomerOption } from "@/components/pos/pos-terminal";
import type { HeldSaleOption } from "@/components/pos/held-sales-dialog";
import { requireCurrentStaff, getActiveStoreId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function PosPage() {
  const staff = await requireCurrentStaff();
  const storeId = await getActiveStoreId(staff);
  const supabase = await createClient();

  const [units, levels, services, bundles, customers, store, heldSales] = await Promise.all([
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
      .from("products")
      .select("id, name, default_price_cents")
      .eq("organization_id", staff.organizationId)
      .eq("tracking_type", "SERVICE"),
    supabase
      .from("bundles")
      .select("id, name, price_cents, items:bundle_items(quantity, product:products(id, name))")
      .eq("organization_id", staff.organizationId)
      .eq("is_active", true),
    supabase
      .from("customers")
      .select("id, full_name, phone, store_credit_cents")
      .eq("organization_id", staff.organizationId)
      .order("full_name", { ascending: true })
      .limit(50),
    supabase.from("stores").select("tax_rate_bps").eq("id", storeId).single(),
    supabase
      .from("held_sales")
      .select("id, note, created_at, customer:customers(full_name)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false }),
  ]);

  // A bundle's sellable quantity is capped by whichever component has the
  // least stock relative to how many of it one bundle needs.
  const stockByProductId = new Map<string, number>(
    (levels.data ?? []).map((l) => {
      const product = l.product as unknown as { id: string } | null;
      return [product?.id ?? "", l.quantity_on_hand];
    }),
  );

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
    ...(services.data ?? []).map((s): SellableItem => ({
      kind: "SERVICE",
      productId: s.id,
      name: s.name,
      priceCents: s.default_price_cents,
      maxQuantity: 99,
    })),
    ...(bundles.data ?? []).map((b): SellableItem => {
      const bundleItems = (b.items ?? []) as unknown as {
        quantity: number;
        product: { id: string; name: string } | null;
      }[];
      const capacity = bundleItems.reduce((min, item) => {
        const available = stockByProductId.get(item.product?.id ?? "") ?? 0;
        return Math.min(min, Math.floor(available / item.quantity));
      }, Infinity);
      return {
        kind: "BUNDLE",
        bundleId: b.id,
        productId: b.id,
        name: b.name,
        detail: bundleItems.map((i) => i.product?.name).filter(Boolean).join(" + "),
        priceCents: b.price_cents,
        maxQuantity: Number.isFinite(capacity) ? Math.max(0, capacity) : 0,
      };
    }),
  ];

  const customerOptions: CustomerOption[] = (customers.data ?? []).map((c) => ({
    id: c.id,
    fullName: c.full_name,
    phone: c.phone,
    storeCreditCents: c.store_credit_cents,
  }));

  const heldSaleOptions: HeldSaleOption[] = (heldSales.data ?? []).map((h) => {
    const customer = h.customer as unknown as { full_name: string } | null;
    return {
      id: h.id,
      note: h.note,
      customerName: customer?.full_name ?? null,
      createdAt: h.created_at,
    };
  });

  return (
    <div>
      <PageHeader title="Point of Sale" description="Build a cart and charge with Stripe." />
      <div className="p-6 md:p-8">
        <PosTerminal
          items={items}
          customers={customerOptions}
          taxRateBps={store.data?.tax_rate_bps ?? 0}
          heldSales={heldSaleOptions}
        />
      </div>
    </div>
  );
}
