"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBuyback, type ActionState } from "@/app/(app)/trade-in/actions";
import type { CustomerOption } from "@/components/pos/pos-terminal";

const initialState: ActionState = {};

const PAYOUT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  store_credit: "Store credit",
};

export function BuybackForm({ customers }: { customers: CustomerOption[] }) {
  const [customerId, setCustomerId] = useState("");
  const [isNewCustomer, setIsNewCustomer] = useState(true);
  const [state, formAction, isPending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await createBuyback(prev, formData);
      if (result.success) {
        toast.success("Trade-in completed — device added to inventory");
      }
      return result;
    },
    initialState,
  );

  return (
    <Card className="border-border/60">
      <CardContent className="pt-6">
        <form action={formAction} key={state.success ? "reset" : "form"} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" name="sku" required placeholder="IP12-64-BLK-USED" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Device name</Label>
              <Input id="name" name="name" required placeholder="iPhone 12 64GB Black" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="brand">Brand</Label>
              <Input id="brand" name="brand" placeholder="Apple" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model">Model</Label>
              <Input id="model" name="model" placeholder="A2172" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="imei">IMEI / Serial</Label>
            <Input id="imei" name="imei" required placeholder="356938035643809" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="conditionNotes">Condition notes</Label>
            <Textarea
              id="conditionNotes"
              name="conditionNotes"
              required
              placeholder="Screen: minor scratches. Battery health 89%. Powers on and functions normally."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="offerPriceCents">Offer price (cents)</Label>
              <Input id="offerPriceCents" name="offerPriceCents" type="number" min={0} required />
            </div>
            <div className="space-y-1.5">
              <Label>Payout method</Label>
              <Select name="payoutMethod" defaultValue="cash">
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) => PAYOUT_METHOD_LABELS[value] ?? value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash" label="Cash">Cash</SelectItem>
                  <SelectItem value="store_credit" label="Store credit">Store credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-border/60 pt-4">
            <Label className="text-xs text-muted-foreground">Customer</Label>
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

          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            {isPending ? "Completing trade-in…" : "Complete trade-in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
