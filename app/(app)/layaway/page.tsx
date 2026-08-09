import { PageHeader } from "@/components/layout/page-header";
import { LayawayFormDialog, type AvailableDevice } from "@/components/layaway/layaway-form-dialog";
import { LayawayList, type LayawayRow } from "@/components/layaway/layaway-list";
import { requireCurrentStaff, getActiveStoreId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { LayawayStatus } from "@/lib/layaway";

export default async function LayawayPage() {
  const staff = await requireCurrentStaff();
  const storeId = await getActiveStoreId(staff);
  const supabase = await createClient();

  const [layaways, availableUnits, customers] = await Promise.all([
    supabase
      .from("layaways")
      .select(
        "id, total_cents, paid_cents, due_date, status, customer:customers(full_name), inventory_unit:inventory_units(imei, product:products(name))",
      )
      .eq("store_id", storeId)
      .order("created_at", { ascending: false }),
    supabase
      .from("inventory_units")
      .select("id, imei, asking_price_cents, product:products(id, name, default_price_cents)")
      .eq("store_id", storeId)
      .eq("status", "IN_STOCK")
      .order("created_at", { ascending: false }),
    supabase
      .from("customers")
      .select("id, full_name, phone")
      .eq("organization_id", staff.organizationId)
      .order("full_name", { ascending: true })
      .limit(50),
  ]);

  const rows: LayawayRow[] = (layaways.data ?? []).map((l) => {
    const customer = l.customer as unknown as { full_name: string } | null;
    const unit = l.inventory_unit as unknown as {
      imei: string | null;
      product: { name: string } | null;
    } | null;
    return {
      id: l.id,
      deviceName: unit?.product?.name ?? "Unknown device",
      customerName: customer?.full_name ?? "Walk-in",
      totalCents: l.total_cents,
      paidCents: l.paid_cents,
      dueDate: l.due_date,
      status: l.status as LayawayStatus,
    };
  });

  const devices: AvailableDevice[] = (availableUnits.data ?? []).map((u) => {
    const product = u.product as unknown as {
      id: string;
      name: string;
      default_price_cents: number;
    } | null;
    return {
      inventoryUnitId: u.id,
      name: product?.name ?? "Unknown device",
      detail: u.imei ?? "",
      priceCents: u.asking_price_cents ?? product?.default_price_cents ?? 0,
    };
  });

  return (
    <div>
      <PageHeader
        title="Layaway"
        description="Hold a device with a deposit, collect the balance over time."
        action={
          <LayawayFormDialog
            devices={devices}
            customers={(customers.data ?? []).map((c) => ({
              id: c.id,
              fullName: c.full_name,
              phone: c.phone,
            }))}
          />
        }
      />
      <div className="p-6 md:p-8">
        <LayawayList rows={rows} />
      </div>
    </div>
  );
}
