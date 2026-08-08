"use client";

import { useActionState, useState } from "react";
import { PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { receiveStock, type ActionState } from "@/app/(app)/inventory/actions";

const initialState: ActionState = {};

export function ReceiveStockDialog({
  productId,
  name,
}: {
  productId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await receiveStock(prev, formData);
      if (result.success) {
        toast.success("Stock received");
        setOpen(false);
      }
      return result;
    },
    initialState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <PackagePlus className="mr-1.5 h-4 w-4" />
        Receive
      </DialogTrigger>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Receive stock — {name}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="productId" value={productId} />
          <div className="space-y-1.5">
            <Label htmlFor="quantity">Quantity received</Label>
            <Input id="quantity" name="quantity" type="number" min={1} defaultValue={1} required />
          </div>
          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Saving…" : "Add to stock"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
