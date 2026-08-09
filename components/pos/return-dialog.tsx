"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCents } from "@/lib/money";
import { calcReturnTotals } from "@/lib/returns";
import { createReturn, type RefundMethod } from "@/app/(app)/pos/receipt/[saleId]/actions";

export interface ReturnableLineItem {
  id: string;
  productName: string;
  unitPriceCents: number;
  returnableQuantity: number;
}

export function ReturnDialog({
  saleId,
  lineItems,
  saleSubtotalCents,
  saleTaxCents,
  hasCustomer,
  hasStripePayment,
}: {
  saleId: string;
  lineItems: ReturnableLineItem[];
  saleSubtotalCents: number;
  saleTaxCents: number;
  hasCustomer: boolean;
  hasStripePayment: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>(
    hasStripePayment ? "STRIPE" : "STORE_CREDIT",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canChooseMethod = hasStripePayment && hasCustomer;

  const selections = lineItems
    .map((item) => ({
      saleLineItemId: item.id,
      quantity: quantities[item.id] ?? 0,
      unitPriceCents: item.unitPriceCents,
    }))
    .filter((s) => s.quantity > 0);

  const totals = calcReturnTotals(selections, saleSubtotalCents, saleTaxCents);

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await createReturn(
        saleId,
        reason,
        selections.map((s) => ({ saleLineItemId: s.saleLineItemId, quantity: s.quantity })),
        refundMethod,
      );
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        toast.success(
          refundMethod === "STORE_CREDIT"
            ? `Issued ${formatCents(totals.totalCents)} in store credit`
            : `Refunded ${formatCents(totals.totalCents)}`,
        );
        setOpen(false);
        setQuantities({});
        setReason("");
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="w-full" />}>
        <Undo2 className="mr-1.5 h-4 w-4" />
        Return items
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Return items</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-3">
            {lineItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCents(item.unitPriceCents)} each · {item.returnableQuantity} returnable
                  </p>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={item.returnableQuantity}
                  value={quantities[item.id] ?? 0}
                  disabled={item.returnableQuantity === 0}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    const clamped = Math.max(
                      0,
                      Math.min(item.returnableQuantity, Number.isNaN(raw) ? 0 : raw),
                    );
                    setQuantities((prev) => ({ ...prev, [item.id]: clamped }));
                  }}
                  className="w-16 text-right"
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="return-reason">Reason (optional)</Label>
            <Textarea
              id="return-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Customer changed their mind, defective on arrival, etc."
            />
          </div>

          {canChooseMethod && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Refund method</Label>
              <RadioGroup
                value={refundMethod}
                onValueChange={(v) => setRefundMethod(v as RefundMethod)}
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="STRIPE" />
                  Original payment method
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="STORE_CREDIT" />
                  Store credit
                </label>
              </RadioGroup>
            </div>
          )}

          {selections.length > 0 && (
            <div className="space-y-1 border-t border-border/60 pt-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Refund subtotal</span>
                <span>{formatCents(totals.subtotalCents)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Refund tax</span>
                <span>{formatCents(totals.taxCents)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-foreground">
                <span>Refund total</span>
                <span>{formatCents(totals.totalCents)}</span>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button
            type="button"
            className="w-full"
            disabled={selections.length === 0 || isPending}
            onClick={handleSubmit}
          >
            {isPending && <Loader2 className="animate-spin" />}
            {isPending
              ? "Processing…"
              : refundMethod === "STORE_CREDIT"
                ? `Issue ${formatCents(totals.totalCents)} store credit`
                : `Refund ${formatCents(totals.totalCents)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
