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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCents } from "@/lib/money";
import { createLayaway, type ActionState } from "@/app/(app)/layaway/actions";
import type { CustomerOption } from "@/components/pos/pos-terminal";

export interface AvailableDevice {
  inventoryUnitId: string;
  name: string;
  detail: string;
  priceCents: number;
}

const initialState: ActionState = {};

export function LayawayFormDialog({
  devices,
  customers,
}: {
  devices: AvailableDevice[];
  customers: CustomerOption[];
}) {
  const [open, setOpen] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [isNewCustomer, setIsNewCustomer] = useState(true);
  const [state, formAction, isPending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await createLayaway(prev, formData);
      if (result.success) {
        toast.success("Layaway created — redirecting to deposit payment…");
        setOpen(false);
      }
      return result;
    },
    initialState,
  );

  const selectedDevice = devices.find((d) => d.inventoryUnitId === deviceId);

  // Tomorrow, formatted for a date input's min attribute and a sane default.
  const defaultDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const minDueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-1.5 h-4 w-4" />
        New Layaway
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a layaway</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Device</Label>
            <Select value={deviceId} onValueChange={(v) => setDeviceId(v ?? "")} name="inventoryUnitId">
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an in-stock device">
                  {(value: string | null) => {
                    const match = devices.find((d) => d.inventoryUnitId === value);
                    return match ? `${match.name} — ${match.detail}` : "Select an in-stock device";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {devices.map((d) => (
                  <SelectItem
                    key={d.inventoryUnitId}
                    value={d.inventoryUnitId}
                    label={`${d.name} — ${d.detail}`}
                  >
                    {d.name} — {d.detail}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {devices.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No in-stock devices available to hold.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="priceCents">Price, pre-tax (cents)</Label>
              <Input
                id="priceCents"
                name="priceCents"
                type="number"
                min={1}
                required
                defaultValue={selectedDevice?.priceCents}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="depositCents">Deposit due today (cents)</Label>
              <Input id="depositCents" name="depositCents" type="number" min={1} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dueDate">Balance due by</Label>
            <Input
              id="dueDate"
              name="dueDate"
              type="date"
              min={minDueDate}
              defaultValue={defaultDueDate}
              required
            />
          </div>

          <div className="space-y-1.5 border-t border-border/60 pt-4">
            <Label className="text-xs text-muted-foreground">Customer (required)</Label>
            {isNewCustomer ? (
              <div className="grid grid-cols-2 gap-2">
                <Input name="newCustomerName" placeholder="Full name" required />
                <Input name="newCustomerPhone" placeholder="Phone (optional)" />
              </div>
            ) : (
              <Select
                value={customerId}
                onValueChange={(value) => setCustomerId(value ?? "")}
                name="customerId"
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a customer">
                    {(value: string | null) => {
                      const match = customers.find((c) => c.id === value);
                      return match
                        ? match.fullName + (match.phone ? ` · ${match.phone}` : "")
                        : "Select a customer";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem
                      key={c.id}
                      value={c.id}
                      label={c.fullName + (c.phone ? ` · ${c.phone}` : "")}
                    >
                      {c.fullName}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <button
              type="button"
              onClick={() => setIsNewCustomer((v) => !v)}
              className="text-xs text-muted-foreground underline underline-offset-2"
            >
              {isNewCustomer ? "Pick an existing customer instead" : "New customer instead"}
            </button>
          </div>

          {selectedDevice && (
            <p className="text-xs text-muted-foreground">
              {selectedDevice.name} · listed at {formatCents(selectedDevice.priceCents)}
            </p>
          )}

          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isPending || devices.length === 0}>
            {isPending && <Loader2 className="animate-spin" />}
            {isPending ? "Creating…" : "Create layaway & collect deposit"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
