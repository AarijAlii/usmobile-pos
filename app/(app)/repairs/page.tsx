import { PageHeader } from "@/components/layout/page-header";
import { IntakeDialog } from "@/components/repairs/intake-dialog";
import { RepairsList, type RepairRow } from "@/components/repairs/repairs-list";
import { requireCurrentStaff, getActiveStoreId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { RepairStatus } from "@/lib/repair-status";

export default async function RepairsPage() {
  const staff = await requireCurrentStaff();
  const storeId = await getActiveStoreId(staff);
  const supabase = await createClient();

  const [tickets, customers] = await Promise.all([
    supabase
      .from("repair_tickets")
      .select(
        "id, device_description, reported_issue, status, total_cents, created_at, customer:customers(full_name)",
      )
      .eq("store_id", storeId)
      .order("created_at", { ascending: false }),
    supabase
      .from("customers")
      .select("id, full_name, phone")
      .eq("organization_id", staff.organizationId)
      .order("full_name", { ascending: true })
      .limit(50),
  ]);

  const rows: RepairRow[] = (tickets.data ?? []).map((t) => {
    const customer = t.customer as unknown as { full_name: string } | null;
    return {
      id: t.id,
      deviceDescription: t.device_description,
      reportedIssue: t.reported_issue,
      status: t.status as RepairStatus,
      totalCents: t.total_cents,
      customerName: customer?.full_name ?? null,
      createdAt: t.created_at,
    };
  });

  return (
    <div>
      <PageHeader
        title="Repairs"
        description="Track intake through completion."
        action={
          <IntakeDialog
            customers={(customers.data ?? []).map((c) => ({
              id: c.id,
              fullName: c.full_name,
              phone: c.phone,
            }))}
          />
        }
      />
      <div className="p-6 md:p-8">
        <RepairsList rows={rows} />
      </div>
    </div>
  );
}
