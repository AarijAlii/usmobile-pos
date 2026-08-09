import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { TicketDetail } from "@/components/repairs/ticket-detail";
import { requireCurrentStaff, getActiveStoreId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { RepairStatus } from "@/lib/repair-status";

export default async function RepairTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const staff = await requireCurrentStaff();
  const storeId = await getActiveStoreId(staff);
  const supabase = await createClient();

  const [ticketRes, partsUsedRes, availablePartsRes] = await Promise.all([
    supabase
      .from("repair_tickets")
      .select(
        "id, device_description, imei, reported_issue, diagnosis_notes, status, labor_cents, parts_total_cents, total_cents, customer_notified_at, created_at, customer:customers(full_name, phone)",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("repair_parts_used")
      .select("id, quantity, unit_cost_cents, line_total_cents, product:products(name)")
      .eq("repair_ticket_id", id),
    supabase
      .from("stock_levels")
      .select("quantity_on_hand, product:products(id, name, default_price_cents, is_part)")
      .eq("store_id", storeId)
      .gt("quantity_on_hand", 0),
  ]);

  if (!ticketRes.data) notFound();
  const ticket = ticketRes.data;
  const customer = ticket.customer as unknown as { full_name: string; phone: string | null } | null;

  const partsUsed = (partsUsedRes.data ?? []).map((p) => ({
    id: p.id,
    name: (p.product as unknown as { name: string } | null)?.name ?? "Unknown part",
    quantity: p.quantity,
    lineTotalCents: p.line_total_cents,
  }));

  const availableParts = (availablePartsRes.data ?? [])
    .map((l) => {
      const product = l.product as unknown as {
        id: string; name: string; default_price_cents: number; is_part: boolean;
      } | null;
      return product?.is_part
        ? {
            productId: product.id,
            name: product.name,
            priceCents: product.default_price_cents,
            maxQuantity: l.quantity_on_hand,
          }
        : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <div>
      <PageHeader
        title={ticket.device_description}
        description={<>Ticket <span className="font-mono">#{ticket.id.slice(0, 8)}</span></>}
      />
      <div className="p-6 md:p-8">
        <TicketDetail
          ticket={{
            id: ticket.id,
            imei: ticket.imei,
            reportedIssue: ticket.reported_issue,
            diagnosisNotes: ticket.diagnosis_notes,
            status: ticket.status as RepairStatus,
            laborCents: ticket.labor_cents,
            partsTotalCents: ticket.parts_total_cents,
            totalCents: ticket.total_cents,
            customerNotifiedAt: ticket.customer_notified_at,
            customerName: customer?.full_name ?? null,
            customerPhone: customer?.phone ?? null,
          }}
          partsUsed={partsUsed}
          availableParts={availableParts}
        />
      </div>
    </div>
  );
}
