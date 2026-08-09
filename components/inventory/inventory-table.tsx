"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCents } from "@/lib/money";
import { ReceiveStockDialog } from "@/components/inventory/receive-stock-dialog";

export interface InventoryRow {
  kind: "DEVICE" | "ACCESSORY" | "SERVICE";
  id: string;
  productId: string;
  sku: string;
  name: string;
  detail: string;
  priceCents: number;
  status: string;
  quantity: number | null;
}

const STATUS_VARIANT: Record<string, "success" | "secondary" | "warning" | "destructive"> = {
  IN_STOCK: "success",
  SOLD: "secondary",
  RESERVED: "warning",
  DEFECTIVE: "destructive",
  LOW_STOCK: "warning",
  UNLIMITED: "secondary",
};

export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.sku.toLowerCase().includes(q) ||
        row.detail.toLowerCase().includes(q),
    );
  }, [rows, query]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, SKU, or IMEI…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No items found.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((row) => (
              <TableRow key={`${row.kind}-${row.id}`}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{row.sku}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.kind === "ACCESSORY" ? (
                    <span className="tabular-nums">{row.quantity} in stock</span>
                  ) : (
                    <span className="font-mono text-xs">{row.detail}</span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{formatCents(row.priceCents)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[row.status] ?? "secondary"}>
                    {row.status.replace(/_/g, " ").toLowerCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {row.kind === "ACCESSORY" && (
                    <ReceiveStockDialog productId={row.productId} name={row.name} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
