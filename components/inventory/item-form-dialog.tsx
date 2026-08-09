"use client";

import { useActionState, useState } from "react";
import { Loader2, Plus } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createInventoryItem, type ActionState } from "@/app/(app)/inventory/actions";

const initialState: ActionState = {};

const CONDITION_LABELS: Record<string, string> = {
  new: "New",
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

export function ItemFormDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"DEVICE" | "ACCESSORY">("DEVICE");
  const [state, formAction, isPending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await createInventoryItem(prev, formData);
      if (result.success) {
        toast.success("Item added to inventory");
        setOpen(false);
      }
      return result;
    },
    initialState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-1.5 h-4 w-4" />
        Add Item
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add inventory item</DialogTitle>
        </DialogHeader>
        <Tabs value={type} onValueChange={(v) => setType(v as typeof type)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="DEVICE">Device</TabsTrigger>
            <TabsTrigger value="ACCESSORY">Accessory / Part</TabsTrigger>
          </TabsList>

          <form action={formAction} className="mt-4 space-y-4">
            <input type="hidden" name="type" value={type} />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" name="sku" required placeholder="IP13-128-BLU" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required placeholder="iPhone 13 128GB Blue" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="brand">Brand</Label>
                <Input id="brand" name="brand" placeholder="Apple" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="model">Model</Label>
                <Input id="model" name="model" placeholder="A2633" />
              </div>
            </div>

            <TabsContent value="DEVICE" className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="imei">IMEI / Serial</Label>
                <Input id="imei" name="imei" placeholder="356938035643809" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Condition</Label>
                  <Select name="condition" defaultValue="excellent">
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(value: string) => CONDITION_LABELS[value] ?? value}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new" label="New">New</SelectItem>
                      <SelectItem value="excellent" label="Excellent">Excellent</SelectItem>
                      <SelectItem value="good" label="Good">Good</SelectItem>
                      <SelectItem value="fair" label="Fair">Fair</SelectItem>
                      <SelectItem value="poor" label="Poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="costCents-device">Cost (cents)</Label>
                  <Input id="costCents-device" name="costCents" type="number" min={0} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="ACCESSORY" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input id="quantity" name="quantity" type="number" min={0} defaultValue={0} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reorderLevel">Reorder level</Label>
                  <Input id="reorderLevel" name="reorderLevel" type="number" min={0} defaultValue={2} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="costCents-accessory">Cost (cents)</Label>
                <Input id="costCents-accessory" name="costCents" type="number" min={0} />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" name="isPart" value="true" className="h-4 w-4 rounded border-input" />
                Usable as a repair part
              </label>
            </TabsContent>

            <div className="space-y-1.5">
              <Label htmlFor="priceCents">Sell price (cents)</Label>
              <Input id="priceCents" name="priceCents" type="number" min={0} required />
            </div>

            {state.error && (
              <p className="text-sm text-destructive" role="alert">
                {state.error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              {isPending ? "Adding…" : "Add item"}
            </Button>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
