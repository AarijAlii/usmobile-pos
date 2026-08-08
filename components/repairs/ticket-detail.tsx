"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCents } from "@/lib/money";
import {
  REPAIR_STATUS_LABELS,
  isValidRepairStatusTransition,
  type RepairStatus,
} from "@/lib/repair-status";
import {
  advanceStatus,
  addPart,
  updateLabor,
  saveDiagnosis,
  markCustomerNotified,
  type ActionState,
} from "@/app/(app)/repairs/actions";

const ALL_STATUSES = Object.keys(REPAIR_STATUS_LABELS) as RepairStatus[];
const initialState: ActionState = {};

interface Ticket {
  id: string;
  imei: string | null;
  reportedIssue: string;
  diagnosisNotes: string | null;
  status: RepairStatus;
  laborCents: number;
  partsTotalCents: number;
  totalCents: number;
  customerNotifiedAt: string | null;
  customerName: string | null;
  customerPhone: string | null;
}

interface PartUsed {
  id: string;
  name: string;
  quantity: number;
  lineTotalCents: number;
}

interface AvailablePart {
  productId: string;
  name: string;
  priceCents: number;
  maxQuantity: number;
}

export function TicketDetail({
  ticket,
  partsUsed,
  availableParts,
}: {
  ticket: Ticket;
  partsUsed: PartUsed[];
  availableParts: AvailablePart[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleAdvance(toStatus: RepairStatus) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("ticketId", ticket.id);
      formData.set("toStatus", toStatus);
      const result = await advanceStatus(initialState, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success(`Status updated to ${REPAIR_STATUS_LABELS[toStatus]}`);
        router.refresh();
      }
    });
  }

  function handleNotify() {
    startTransition(async () => {
      const result = await markCustomerNotified(ticket.id);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Customer marked as notified");
        router.refresh();
      }
    });
  }

  const nextStatuses = ALL_STATUSES.filter((s) => isValidRepairStatusTransition(ticket.status, s));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Ticket details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Customer</p>
                <p className="font-medium">{ticket.customerName ?? "Walk-in"}</p>
                {ticket.customerPhone && (
                  <p className="text-xs text-muted-foreground">{ticket.customerPhone}</p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground">IMEI / Serial</p>
                <p className="font-medium">{ticket.imei ?? "—"}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Reported issue</p>
              <p className="mt-1 text-sm">{ticket.reportedIssue}</p>
            </div>
          </CardContent>
        </Card>

        <DiagnosisCard
          key={ticket.diagnosisNotes}
          ticketId={ticket.id}
          initialNotes={ticket.diagnosisNotes}
          reportedIssue={ticket.reportedIssue}
        />

        <PartsCard ticketId={ticket.id} partsUsed={partsUsed} availableParts={availableParts} />

        <LaborCard key={ticket.laborCents} ticketId={ticket.id} laborCents={ticket.laborCents} />
      </div>

      <div className="space-y-6">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant="secondary" className="text-sm">
              {REPAIR_STATUS_LABELS[ticket.status]}
            </Badge>
            <div className="flex flex-col gap-2">
              {nextStatuses.map((s) => (
                <Button
                  key={s}
                  variant={s === "CANCELLED" ? "outline" : "default"}
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleAdvance(s)}
                >
                  Move to {REPAIR_STATUS_LABELS[s]}
                </Button>
              ))}
              {nextStatuses.length === 0 && (
                <p className="text-sm text-muted-foreground">No further transitions.</p>
              )}
            </div>

            {ticket.status === "READY_FOR_PICKUP" && (
              <div className="border-t border-border/60 pt-3">
                {ticket.customerNotifiedAt ? (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4" />
                    Notified {new Date(ticket.customerNotifiedAt).toLocaleString()}
                  </p>
                ) : (
                  <Button variant="outline" size="sm" className="w-full" onClick={handleNotify} disabled={isPending}>
                    Mark customer notified
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Total</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Labor</span>
              <span>{formatCents(ticket.laborCents)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Parts</span>
              <span>{formatCents(ticket.partsTotalCents)}</span>
            </div>
            <div className="flex justify-between border-t border-border/60 pt-2 text-base font-semibold text-foreground">
              <span>Total</span>
              <span>{formatCents(ticket.totalCents)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DiagnosisCard({
  ticketId,
  initialNotes,
  reportedIssue,
}: {
  ticketId: string;
  initialNotes: string | null;
  reportedIssue: string;
}) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [state, formAction, isSaving] = useActionState(saveDiagnosis, initialState);

  async function handleSuggest() {
    setIsSuggesting(true);
    try {
      const res = await fetch("/api/ai/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportedIssue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get suggestion");
      setNotes((prev) => (prev ? `${prev}\n\n${data.suggestion}` : data.suggestion));
      toast.success("AI suggestion added — review and save");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIsSuggesting(false);
    }
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Diagnosis notes</CardTitle>
        <Button variant="outline" size="sm" onClick={handleSuggest} disabled={isSuggesting}>
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          {isSuggesting ? "Thinking…" : "Suggest with AI"}
        </Button>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="ticketId" value={ticketId} />
          <Textarea
            name="diagnosisNotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            placeholder="Technician notes and likely causes…"
          />
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" size="sm" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save notes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PartsCard({
  ticketId,
  partsUsed,
  availableParts,
}: {
  ticketId: string;
  partsUsed: PartUsed[];
  availableParts: AvailablePart[];
}) {
  const [productId, setProductId] = useState("");
  const [state, formAction, isPending] = useActionState(addPart, initialState);

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Parts used</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {partsUsed.length === 0 && (
            <p className="text-sm text-muted-foreground">No parts consumed yet.</p>
          )}
          {partsUsed.map((p) => (
            <div key={p.id} className="flex justify-between text-sm">
              <span>
                {p.name} × {p.quantity}
              </span>
              <span>{formatCents(p.lineTotalCents)}</span>
            </div>
          ))}
        </div>

        {availableParts.length > 0 && (
          <form action={formAction} className="flex items-end gap-2 border-t border-border/60 pt-4">
            <input type="hidden" name="ticketId" value={ticketId} />
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Part</Label>
              <Select value={productId} onValueChange={(v) => setProductId(v ?? "")} name="productId">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a part">
                    {(value: string | null) => {
                      const match = availableParts.find((p) => p.productId === value);
                      return match ? `${match.name} (${match.maxQuantity} in stock)` : "Select a part";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableParts.map((p) => (
                    <SelectItem
                      key={p.productId}
                      value={p.productId}
                      label={`${p.name} (${p.maxQuantity} in stock)`}
                    >
                      {p.name} ({p.maxQuantity} in stock)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-20 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Qty</Label>
              <Input name="quantity" type="number" min={1} defaultValue={1} />
            </div>
            <Button type="submit" size="sm" disabled={isPending || !productId}>
              Add
            </Button>
          </form>
        )}
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </CardContent>
    </Card>
  );
}

function LaborCard({ ticketId, laborCents }: { ticketId: string; laborCents: number }) {
  const [state, formAction, isPending] = useActionState(updateLabor, initialState);

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Labor</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex items-end gap-2">
          <input type="hidden" name="ticketId" value={ticketId} />
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="laborCents" className="text-xs text-muted-foreground">
              Labor cost (cents)
            </Label>
            <Input id="laborCents" name="laborCents" type="number" min={0} defaultValue={laborCents} />
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            Save
          </Button>
        </form>
        {state.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
      </CardContent>
    </Card>
  );
}
