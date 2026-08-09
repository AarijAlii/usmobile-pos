"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/money";
import {
  REPAIR_STATUS_LABELS,
  REPAIR_STATUS_BADGE_VARIANT,
  type RepairStatus,
} from "@/lib/repair-status";

export interface RepairRow {
  id: string;
  deviceDescription: string;
  reportedIssue: string;
  status: RepairStatus;
  totalCents: number;
  customerName: string | null;
  createdAt: string;
}

const FILTERS: { label: string; value: "OPEN" | RepairStatus | "ALL" }[] = [
  { label: "Open", value: "OPEN" },
  { label: "Intake", value: "INTAKE" },
  { label: "Diagnosing", value: "DIAGNOSING" },
  { label: "In Repair", value: "IN_REPAIR" },
  { label: "Ready", value: "READY_FOR_PICKUP" },
  { label: "All", value: "ALL" },
];

export function RepairsList({ rows }: { rows: RepairRow[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("OPEN");

  const filtered = useMemo(() => {
    if (filter === "ALL") return rows;
    if (filter === "OPEN") {
      return rows.filter((r) => r.status !== "COMPLETED" && r.status !== "CANCELLED");
    }
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  return (
    <div className="space-y-4">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No repair tickets in this view.
          </p>
        )}
        {filtered.map((ticket) => (
          <Link
            key={ticket.id}
            href={`/repairs/${ticket.id}`}
            className="flex items-center justify-between rounded-xl border border-border/60 bg-background p-4 transition-colors hover:border-primary/40 hover:bg-secondary/40"
          >
            <div className="min-w-0">
              <p className="font-medium leading-tight">{ticket.deviceDescription}</p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {ticket.reportedIssue}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {ticket.customerName ?? "Walk-in"} ·{" "}
                {new Date(ticket.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="ml-4 flex shrink-0 flex-col items-end gap-1.5">
              <Badge variant={REPAIR_STATUS_BADGE_VARIANT[ticket.status]}>
                {REPAIR_STATUS_LABELS[ticket.status]}
              </Badge>
              <span className="text-sm font-medium">{formatCents(ticket.totalCents)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
