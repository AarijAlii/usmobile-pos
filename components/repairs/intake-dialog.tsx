"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { createRepairTicket, type ActionState } from "@/app/(app)/repairs/actions";
import type { CustomerOption } from "@/components/pos/pos-terminal";

const initialState: ActionState = {};

export function IntakeDialog({ customers }: { customers: CustomerOption[] }) {
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [isNewCustomer, setIsNewCustomer] = useState(true);
  const [state, formAction, isPending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await createRepairTicket(prev, formData);
      if (result.success) {
        toast.success("Repair ticket created");
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
        New Ticket
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New repair ticket</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="deviceDescription">Device</Label>
            <Input
              id="deviceDescription"
              name="deviceDescription"
              required
              placeholder="iPhone 13, cracked screen"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imei">IMEI / Serial (optional)</Label>
            <Input id="imei" name="imei" placeholder="356938035643809" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reportedIssue">Reported issue</Label>
            <Textarea
              id="reportedIssue"
              name="reportedIssue"
              required
              placeholder="Customer says screen is unresponsive in the bottom left corner after a drop."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="laborCents">Estimated labor (cents)</Label>
            <Input id="laborCents" name="laborCents" type="number" min={0} defaultValue={0} />
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
            {isPending ? "Creating…" : "Create ticket"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
