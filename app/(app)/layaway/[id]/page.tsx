import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { LayawayDetail } from "@/components/layaway/layaway-detail";
import { requireCurrentStaff, canManage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { LayawayStatus } from "@/lib/layaway";

export default async function LayawayDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const staff = await requireCurrentStaff();
  const supabase = await createClient();

  const { data: layaway } = await supabase
    .from("layaways")
    .select(
      "id, total_cents, subtotal_cents, tax_cents, paid_cents, due_date, status, resulting_sale_id, customer:customers(full_name, phone), inventory_unit:inventory_units(imei, product:products(name))",
    )
    .eq("id", id)
    .single();

  if (!layaway) notFound();

  const { data: payments } = await supabase
    .from("layaway_payments")
    .select("id, amount_cents, status, created_at")
    .eq("layaway_id", id)
    .order("created_at", { ascending: true });

  const customer = layaway.customer as unknown as { full_name: string; phone: string | null } | null;
  const unit = layaway.inventory_unit as unknown as {
    imei: string | null;
    product: { name: string } | null;
  } | null;

  return (
    <div>
      <PageHeader
        title={unit?.product?.name ?? "Layaway"}
        description={<>Layaway <span className="font-mono">#{layaway.id.slice(0, 8)}</span></>}
      />
      <div className="p-6 md:p-8">
        <LayawayDetail
          layaway={{
            id: layaway.id,
            deviceName: unit?.product?.name ?? "Unknown device",
            imei: unit?.imei ?? null,
            customerName: customer?.full_name ?? "Walk-in",
            customerPhone: customer?.phone ?? null,
            subtotalCents: layaway.subtotal_cents,
            taxCents: layaway.tax_cents,
            totalCents: layaway.total_cents,
            paidCents: layaway.paid_cents,
            dueDate: layaway.due_date,
            status: layaway.status as LayawayStatus,
            resultingSaleId: layaway.resulting_sale_id,
          }}
          payments={(payments ?? []).map((p) => ({
            id: p.id,
            amountCents: p.amount_cents,
            status: p.status,
            createdAt: p.created_at,
          }))}
          canManage={canManage(staff)}
        />
      </div>
    </div>
  );
}
