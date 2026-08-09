"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PauseCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  discardHeldSale,
  resumeHeldSale,
  type HeldCartLine,
} from "@/app/(app)/pos/held-sale-actions";

export interface HeldSaleOption {
  id: string;
  note: string | null;
  customerName: string | null;
  createdAt: string;
}

export function HeldSalesDialog({
  heldSales,
  onResume,
}: {
  heldSales: HeldSaleOption[];
  onResume: (cart: HeldCartLine[], customerId: string | null) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleResume(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await resumeHeldSale(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        onResume(result.cart ?? [], result.customerId ?? null);
        toast.success("Held sale resumed");
        setOpen(false);
        router.refresh();
      }
      setPendingId(null);
    });
  }

  function handleDiscard(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await discardHeldSale(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Held sale discarded");
        router.refresh();
      }
      setPendingId(null);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" className="w-full" />}>
        <PauseCircle className="mr-1.5 h-4 w-4" />
        Held sales{heldSales.length > 0 ? ` (${heldSales.length})` : ""}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Held sales</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {heldSales.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No held sales right now.
            </p>
          )}
          {heldSales.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {h.customerName ?? "Walk-in customer"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {h.note || new Date(h.createdAt).toLocaleTimeString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleResume(h.id)}
                >
                  {isPending && pendingId === h.id && <Loader2 className="animate-spin" />}
                  Resume
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  disabled={isPending}
                  onClick={() => handleDiscard(h.id)}
                  aria-label="Discard held sale"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
