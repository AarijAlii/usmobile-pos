"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/money";
import { calcRemainingCents, isLayawayOverdue, LAYAWAY_STATUS_LABELS, LAYAWAY_STATUS_BADGE_VARIANT, type LayawayStatus } from "@/lib/layaway";

export interface LayawayRow {
  id: string;
  deviceName: string;
  customerName: string;
  totalCents: number;
  paidCents: number;
  dueDate: string;
  status: LayawayStatus;
}

const FILTERS: { label: string; value: "ACTIVE" | "ALL" }[] = [
  { label: "Active", value: "ACTIVE" },
  { label: "All", value: "ALL" },
];

export function LayawayList({ rows }: { rows: LayawayRow[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("ACTIVE");

  const filtered = useMemo(() => {
    if (filter === "ALL") return rows;
    return rows.filter((r) => r.status === "ACTIVE");
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
            No layaways in this view.
          </p>
        )}
        {filtered.map((row) => {
          const remaining = calcRemainingCents(row.totalCents, row.paidCents);
          const overdue = isLayawayOverdue(row.status, row.dueDate);
          return (
            <Link
              key={row.id}
              href={`/layaway/${row.id}`}
              className="flex items-center justify-between rounded-xl border border-border/60 bg-background p-4 transition-colors hover:border-primary/40 hover:bg-secondary/40"
            >
              <div className="min-w-0">
                <p className="font-medium leading-tight">{row.deviceName}</p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {row.customerName} · {formatCents(row.paidCents)} of {formatCents(row.totalCents)} paid
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Due {new Date(row.dueDate).toLocaleDateString()}
                </p>
              </div>
              <div className="ml-4 flex shrink-0 flex-col items-end gap-1.5">
                {overdue ? (
                  <Badge variant="warning">Overdue</Badge>
                ) : (
                  <Badge variant={LAYAWAY_STATUS_BADGE_VARIANT[row.status]}>
                    {LAYAWAY_STATUS_LABELS[row.status]}
                  </Badge>
                )}
                {row.status === "ACTIVE" && (
                  <span className="text-sm font-medium">{formatCents(remaining)} left</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
