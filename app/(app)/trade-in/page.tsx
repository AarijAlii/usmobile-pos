import { PageHeader } from "@/components/layout/page-header";
import { BuybackForm } from "@/components/trade-in/buyback-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/money";
import { requireCurrentStaff, getActiveStoreId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function TradeInPage() {
  const staff = await requireCurrentStaff();
  const storeId = await getActiveStoreId(staff);
  const supabase = await createClient();

  const [customers, recent] = await Promise.all([
    supabase
      .from("customers")
      .select("id, full_name, phone")
      .eq("organization_id", staff.organizationId)
      .order("full_name", { ascending: true })
      .limit(50),
    supabase
      .from("buyback_transactions")
      .select("id, device_description, offer_price_cents, payout_method, status, created_at, customer:customers(full_name)")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <div>
      <PageHeader
        title="Trade-In / Buy-Back"
        description="Intake a used device, set an offer price, and add it to inventory."
      />
      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2 md:p-8">
        <BuybackForm
          customers={(customers.data ?? []).map((c) => ({
            id: c.id,
            fullName: c.full_name,
            phone: c.phone,
          }))}
        />

        <Card className="h-fit border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Recent trade-ins</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(recent.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No trade-ins yet.</p>
            )}
            {(recent.data ?? []).map((tx) => {
              const customer = tx.customer as unknown as { full_name: string } | null;
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{tx.device_description}</p>
                    <p className="text-xs text-muted-foreground">
                      {customer?.full_name ?? "Walk-in"} ·{" "}
                      {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">{formatCents(tx.offer_price_cents)}</Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
