"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import {
  calcRemainingCents,
  isLayawayOverdue,
  LAYAWAY_STATUS_LABELS,
  LAYAWAY_STATUS_BADGE_VARIANT,
  type LayawayStatus,
} from "@/lib/layaway";
import {
  addLayawayPayment,
  cancelLayaway,
  forfeitLayaway,
  type ActionState,
} from "@/app/(app)/layaway/actions";

const initialState: ActionState = {};

interface Layaway {
  id: string;
  deviceName: string;
  imei: string | null;
  customerName: string;
  customerPhone: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  dueDate: string;
  status: LayawayStatus;
  resultingSaleId: string | null;
}

interface Payment {
  id: string;
  amountCents: number;
  status: string;
  createdAt: string;
}

export function LayawayDetail({
  layaway,
  payments,
  canManage,
}: {
  layaway: Layaway;
  payments: Payment[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, formAction, isSubmitting] = useActionState(addLayawayPayment, initialState);

  const remaining = calcRemainingCents(layaway.totalCents, layaway.paidCents);
  const overdue = isLayawayOverdue(layaway.status, layaway.dueDate);
  const percentPaid = Math.min(100, Math.round((layaway.paidCents / layaway.totalCents) * 100));

  function handleRelease(action: "cancel" | "forfeit") {
    startTransition(async () => {
      const result = action === "cancel" ? await cancelLayaway(layaway.id) : await forfeitLayaway(layaway.id);
      if (result.error) toast.error(result.error);
      else {
        toast.success(action === "cancel" ? "Layaway cancelled" : "Layaway marked forfeited");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Customer</p>
                <p className="font-medium">{layaway.customerName}</p>
                {layaway.customerPhone && (
                  <p className="text-xs text-muted-foreground">{layaway.customerPhone}</p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground">IMEI / Serial</p>
                <p className="font-mono text-xs font-medium">{layaway.imei ?? "—"}</p>
              </div>
            </div>
            <div className="space-y-1 border-t border-border/60 pt-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCents(layaway.subtotalCents)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax</span>
                <span>{formatCents(layaway.taxCents)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-foreground">
                <span>Total</span>
                <span>{formatCents(layaway.totalCents)}</span>
              </div>
            </div>
            {layaway.resultingSaleId && (
              <Link
                href={`/pos/receipt/${layaway.resultingSaleId}`}
                className="text-xs text-primary underline underline-offset-2"
              >
                View resulting sale receipt
              </Link>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Payment history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {payments.length === 0 && (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            )}
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {new Date(p.createdAt).toLocaleString()}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatCents(p.amountCents)}</span>
                  <Badge variant={p.status === "PAID" ? "success" : "warning"}>
                    {p.status === "PAID" ? "Paid" : "Awaiting payment"}
                  </Badge>
                </div>
              </div>
            ))}

            {layaway.status === "ACTIVE" && (
              <form action={formAction} className="flex items-end gap-2 border-t border-border/60 pt-4">
                <input type="hidden" name="layawayId" value={layaway.id} />
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="amountCents" className="text-xs text-muted-foreground">
                    Collect a payment (cents) — {formatCents(remaining)} remaining
                  </Label>
                  <Input
                    id="amountCents"
                    name="amountCents"
                    type="number"
                    min={1}
                    max={remaining}
                    defaultValue={remaining}
                    required
                  />
                </div>
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? "Redirecting…" : "Charge"}
                </Button>
              </form>
            )}
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overdue ? (
              <Badge variant="warning" className="text-sm">
                Overdue
              </Badge>
            ) : (
              <Badge variant={LAYAWAY_STATUS_BADGE_VARIANT[layaway.status]} className="text-sm">
                {LAYAWAY_STATUS_LABELS[layaway.status]}
              </Badge>
            )}

            <div className="space-y-1.5">
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${percentPaid}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {percentPaid}% paid · due {new Date(layaway.dueDate).toLocaleDateString()}
              </p>
            </div>

            {layaway.status === "PAID_OFF" && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" />
                Paid off in full
              </p>
            )}

            {layaway.status === "ACTIVE" && canManage && (
              <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
                {overdue && (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleRelease("forfeit")}
                  >
                    Mark forfeited (release device)
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleRelease("cancel")}
                >
                  Cancel layaway
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
