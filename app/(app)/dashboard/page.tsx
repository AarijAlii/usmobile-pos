import { DollarSign, Wrench, PackageSearch, Repeat } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/money";
import { REPAIR_STATUS_LABELS } from "@/lib/repair-status";
import { requireCurrentStaff, getActiveStoreId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const staff = await requireCurrentStaff();
  const storeId = await getActiveStoreId(staff);
  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [salesToday, openRepairs, lowStock, buybacksToday] = await Promise.all([
    supabase
      .from("sales")
      .select("total_cents")
      .eq("store_id", storeId)
      .eq("status", "PAID")
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("repair_tickets")
      .select("id, device_description, status, created_at")
      .eq("store_id", storeId)
      .not("status", "in", "(COMPLETED,CANCELLED)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("stock_levels")
      .select("quantity_on_hand, reorder_level, product:products(name)")
      .eq("store_id", storeId)
      .order("quantity_on_hand", { ascending: true })
      .limit(5),
    supabase
      .from("buyback_transactions")
      .select("offer_price_cents")
      .eq("store_id", storeId)
      .gte("created_at", todayStart.toISOString()),
  ]);

  const salesTotalCents = (salesToday.data ?? []).reduce(
    (sum, s) => sum + s.total_cents,
    0,
  );
  const buybackTotalCents = (buybacksToday.data ?? []).reduce(
    (sum, b) => sum + b.offer_price_cents,
    0,
  );
  const lowStockItems = (lowStock.data ?? []).filter(
    (item) => item.quantity_on_hand <= item.reorder_level,
  );

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Today's snapshot across sales, repairs, and inventory."
      />

      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4 md:p-8">
        <StatCard
          label="Today's sales"
          value={formatCents(salesTotalCents)}
          subtext={`${salesToday.data?.length ?? 0} transactions`}
          icon={DollarSign}
        />
        <StatCard
          label="Open repair tickets"
          value={String(openRepairs.data?.length ?? 0)}
          subtext="In progress"
          icon={Wrench}
        />
        <StatCard
          label="Low stock items"
          value={String(lowStockItems.length)}
          subtext="At or below reorder level"
          icon={PackageSearch}
        />
        <StatCard
          label="Today's buy-backs"
          value={formatCents(buybackTotalCents)}
          subtext={`${buybacksToday.data?.length ?? 0} trade-ins`}
          icon={Repeat}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 px-6 pb-8 lg:grid-cols-2 md:px-8">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Recent repair tickets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(openRepairs.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                No open repair tickets.
              </p>
            )}
            {(openRepairs.data ?? []).map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3"
              >
                <span className="text-sm font-medium">
                  {ticket.device_description}
                </span>
                <Badge variant="secondary">
                  {REPAIR_STATUS_LABELS[
                    ticket.status as keyof typeof REPAIR_STATUS_LABELS
                  ] ?? ticket.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Low stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStockItems.length === 0 && (
              <p className="text-sm text-muted-foreground">
                All accessories are above their reorder level.
              </p>
            )}
            {lowStockItems.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3"
              >
                <span className="text-sm font-medium">
                  {(item.product as unknown as { name: string } | null)?.name ??
                    "Unknown item"}
                </span>
                <Badge variant="destructive">{item.quantity_on_hand} left</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
