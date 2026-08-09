import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/money";
import { requireCurrentStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "./print-button";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  const { saleId } = await params;
  await requireCurrentStaff();
  const supabase = await createClient();

  const { data: sale } = await supabase
    .from("sales")
    .select(
      "id, status, subtotal_cents, tax_cents, total_cents, created_at, customer:customers(full_name, phone)",
    )
    .eq("id", saleId)
    .single();

  if (!sale) notFound();

  const { data: lineItems } = await supabase
    .from("sale_line_items")
    .select("id, quantity, unit_price_cents, line_total_cents, product:products(name)")
    .eq("sale_id", saleId);

  const customer = sale.customer as unknown as { full_name: string; phone: string | null } | null;

  return (
    <div className="mx-auto max-w-lg p-6 md:p-8">
      <Card className="border-border/60 print:border-none">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Receipt</CardTitle>
          <p className="text-sm text-muted-foreground">
            {new Date(sale.created_at).toLocaleString()}
          </p>
          <Badge
            className="mx-auto mt-2"
            variant={
              sale.status === "PAID"
                ? "success"
                : sale.status === "AWAITING_PAYMENT"
                  ? "warning"
                  : "destructive"
            }
          >
            {sale.status}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          {customer && (
            <div className="text-sm text-muted-foreground">
              Sold to: <span className="text-foreground">{customer.full_name}</span>
              {customer.phone && ` · ${customer.phone}`}
            </div>
          )}

          <div className="space-y-2">
            {(lineItems ?? []).map((item) => {
              const product = item.product as unknown as { name: string } | null;
              return (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>
                    {product?.name} {item.quantity > 1 && `× ${item.quantity}`}
                  </span>
                  <span>{formatCents(item.line_total_cents)}</span>
                </div>
              );
            })}
          </div>

          <div className="space-y-1 border-t border-border/60 pt-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCents(sale.subtotal_cents)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span>{formatCents(sale.tax_cents)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-foreground">
              <span>Total</span>
              <span>{formatCents(sale.total_cents)}</span>
            </div>
          </div>

          <PrintButton />
        </CardContent>
      </Card>
    </div>
  );
}
