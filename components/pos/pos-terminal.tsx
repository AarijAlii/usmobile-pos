"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Minus, PauseCircle, Plus, Search, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCents, calcSaleTotals } from "@/lib/money";
import { calcAppliedStoreCreditCents, calcRemainingAfterCredit } from "@/lib/store-credit";
import { checkout, type CheckoutState } from "@/app/(app)/pos/actions";
import { holdSale, type HeldCartLine } from "@/app/(app)/pos/held-sale-actions";
import { HeldSalesDialog, type HeldSaleOption } from "@/components/pos/held-sales-dialog";

export interface SellableItem {
  kind: "DEVICE" | "ACCESSORY" | "SERVICE" | "BUNDLE";
  productId: string;
  bundleId?: string;
  inventoryUnitId?: string;
  name: string;
  detail?: string;
  priceCents: number;
  maxQuantity: number;
}

export interface CustomerOption {
  id: string;
  fullName: string;
  phone: string | null;
  storeCreditCents?: number;
}

interface CartItem {
  key: string;
  kind: SellableItem["kind"];
  productId: string;
  bundleId?: string;
  inventoryUnitId?: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  maxQuantity: number;
}

const initialState: CheckoutState = {};

export function PosTerminal({
  items,
  customers,
  taxRateBps,
  heldSales,
}: {
  items: SellableItem[];
  customers: CustomerOption[];
  taxRateBps: number;
  heldSales: HeldSaleOption[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [applyCredit, setApplyCredit] = useState(false);
  const [isHolding, startHold] = useTransition();
  const [state, formAction, isPending] = useActionState(checkout, initialState);

  const cartKeys = useMemo(() => new Set(cart.map((c) => c.key)), [cart]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const key = item.inventoryUnitId ?? item.bundleId ?? item.productId;
      if (item.kind === "DEVICE" && cartKeys.has(key)) return false;
      if (item.kind !== "DEVICE" && item.maxQuantity <= 0) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || item.detail?.toLowerCase().includes(q);
    });
  }, [items, query, cartKeys]);

  function addItem(item: SellableItem) {
    const key = item.inventoryUnitId ?? item.bundleId ?? item.productId;
    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        if (existing.quantity >= existing.maxQuantity) return prev;
        return prev.map((c) => (c.key === key ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [
        ...prev,
        {
          key,
          kind: item.kind,
          productId: item.productId,
          bundleId: item.bundleId,
          inventoryUnitId: item.inventoryUnitId,
          name: item.name,
          unitPriceCents: item.priceCents,
          quantity: 1,
          maxQuantity: item.maxQuantity,
        },
      ];
    });
  }

  function adjustQuantity(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) =>
          c.key === key
            ? { ...c, quantity: Math.min(c.maxQuantity, Math.max(1, c.quantity + delta)) }
            : c,
        )
        .filter((c) => c.quantity > 0),
    );
  }

  function removeItem(key: string) {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }

  function handleResumeHeldSale(heldCart: HeldCartLine[], heldCustomerId: string | null) {
    const rebuilt: CartItem[] = [];
    let droppedCount = 0;
    for (const line of heldCart) {
      const match = items.find((i) => {
        if (line.bundleId) return i.bundleId === line.bundleId;
        if (line.inventoryUnitId) return i.inventoryUnitId === line.inventoryUnitId;
        return i.productId === line.productId && !i.inventoryUnitId && i.kind !== "BUNDLE";
      });
      if (!match) {
        droppedCount++;
        continue;
      }
      const key = match.inventoryUnitId ?? match.bundleId ?? match.productId;
      rebuilt.push({
        key,
        kind: match.kind,
        productId: match.productId,
        bundleId: match.bundleId,
        inventoryUnitId: match.inventoryUnitId,
        name: match.name,
        unitPriceCents: match.priceCents,
        quantity: Math.min(line.quantity, match.maxQuantity),
        maxQuantity: match.maxQuantity,
      });
    }
    setCart(rebuilt);
    if (heldCustomerId) {
      setIsNewCustomer(false);
      setCustomerId(heldCustomerId);
    }
    if (droppedCount > 0) {
      toast.error(
        `${droppedCount} item${droppedCount > 1 ? "s" : ""} from this held sale ${droppedCount > 1 ? "are" : "is"} no longer available and were left out.`,
      );
    }
  }

  function handleHold() {
    if (cart.length === 0) return;
    startHold(async () => {
      const heldCart: HeldCartLine[] = cart.map((c) => ({
        productId: c.bundleId ? undefined : c.productId,
        inventoryUnitId: c.inventoryUnitId,
        bundleId: c.bundleId,
        quantity: c.quantity,
      }));
      const result = await holdSale(
        heldCart,
        isNewCustomer ? null : customerId || null,
        "",
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Sale held — resume it anytime from Held sales.");
        setCart([]);
        setCustomerId("");
        setIsNewCustomer(false);
        setNewCustomerName("");
        setNewCustomerPhone("");
        setApplyCredit(false);
        router.refresh();
      }
    });
  }

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const availableCreditCents = !isNewCustomer ? selectedCustomer?.storeCreditCents ?? 0 : 0;

  const totals = calcSaleTotals(
    cart.map((c) => ({ unitPriceCents: c.unitPriceCents, quantity: c.quantity })),
    taxRateBps,
  );
  const appliedCreditCents = applyCredit
    ? calcAppliedStoreCreditCents(availableCreditCents, totals.totalCents)
    : 0;
  const remainingCents = calcRemainingAfterCredit(totals.totalCents, appliedCreditCents);

  const cartPayload = JSON.stringify(
    cart.map((c) =>
      c.bundleId
        ? { bundleId: c.bundleId, quantity: c.quantity }
        : { productId: c.productId, inventoryUnitId: c.inventoryUnitId, quantity: c.quantity },
    ),
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="relative mb-4 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search devices, accessories, plans…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => {
            const key = item.inventoryUnitId ?? item.bundleId ?? item.productId;
            return (
              <button
                key={key}
                type="button"
                onClick={() => addItem(item)}
                className="rounded-xl border border-border/60 bg-background p-4 text-left transition-[transform,border-color,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-primary/40 hover:bg-secondary/40 hover:shadow-premium active:translate-y-0 active:scale-[0.98]"
              >
                <p className="font-medium leading-tight">
                  {item.name}
                  {item.kind === "BUNDLE" && (
                    <span className="ml-1.5 text-xs font-normal text-primary">Bundle</span>
                  )}
                </p>
                {item.detail && (
                  <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                    {item.detail}
                  </p>
                )}
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatCents(item.priceCents)}
                  {item.kind === "ACCESSORY" && ` · ${item.maxQuantity} in stock`}
                  {item.kind === "BUNDLE" && ` · ${item.maxQuantity} available`}
                </p>
              </button>
            );
          })}
          {filteredItems.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              No items match your search.
            </p>
          )}
        </div>
      </div>

      <Card className="h-fit border-border/60 lg:sticky lg:top-6">
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-2">
            {cart.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Cart is empty — add items from the left.
              </p>
            )}
            {cart.map((item) => (
              <div key={item.key} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCents(item.unitPriceCents)} each
                  </p>
                </div>
                {item.kind !== "DEVICE" ? (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => adjustQuantity(item.key, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-5 text-center text-sm">{item.quantity}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => adjustQuantity(item.key, 1)}
                      disabled={item.quantity >= item.maxQuantity}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">×1</span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={() => removeItem(item.key)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t border-border/60 pt-4">
            <Label className="text-xs text-muted-foreground">Customer (optional)</Label>
            {!isNewCustomer ? (
              <div className="flex gap-2">
                <Select
                  value={customerId}
                  onValueChange={(value) => {
                    setCustomerId(value ?? "");
                    setApplyCredit(false);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Walk-in customer">
                      {(value: string | null) => {
                        const match = customers.find((c) => c.id === value);
                        return match
                          ? match.fullName + (match.phone ? ` · ${match.phone}` : "")
                          : "Walk-in customer";
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
                        {(c.storeCreditCents ?? 0) > 0
                          ? ` · ${formatCents(c.storeCreditCents ?? 0)} credit`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setIsNewCustomer(true)}>
                  New
                </Button>
              </div>
            ) : (
              <div className="space-y-2 rounded-xl border border-border/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">New customer</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setIsNewCustomer(false)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input
                  placeholder="Full name"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                />
                <Input
                  placeholder="Phone (optional)"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                />
              </div>
            )}

            {availableCreditCents > 0 && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={applyCredit} onCheckedChange={(v) => setApplyCredit(v === true)} />
                Apply store credit ({formatCents(availableCreditCents)} available)
              </label>
            )}
          </div>

          <div className="space-y-1 border-t border-border/60 pt-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCents(totals.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span>{formatCents(totals.taxCents)}</span>
            </div>
            {appliedCreditCents > 0 && (
              <div className="flex justify-between text-primary">
                <span>Store credit applied</span>
                <span>−{formatCents(appliedCreditCents)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-foreground">
              <span>Total</span>
              <span>{formatCents(remainingCents)}</span>
            </div>
          </div>

          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}

          <div className="space-y-2">
            <form action={formAction}>
              <input type="hidden" name="cart" value={cartPayload} />
              {!isNewCustomer && customerId && (
                <input type="hidden" name="customerId" value={customerId} />
              )}
              {isNewCustomer && newCustomerName && (
                <>
                  <input type="hidden" name="newCustomerName" value={newCustomerName} />
                  <input type="hidden" name="newCustomerPhone" value={newCustomerPhone} />
                </>
              )}
              {appliedCreditCents > 0 && (
                <input type="hidden" name="applyStoreCreditCents" value={appliedCreditCents} />
              )}
              <Button type="submit" className="w-full" disabled={cart.length === 0 || isPending}>
                {isPending && <Loader2 className="animate-spin" />}
                {isPending
                  ? "Redirecting to payment…"
                  : remainingCents === 0 && appliedCreditCents > 0
                    ? "Complete sale with store credit"
                    : `Charge ${formatCents(remainingCents)}`}
              </Button>
            </form>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={cart.length === 0 || isHolding}
                onClick={handleHold}
              >
                {isHolding ? <Loader2 className="animate-spin" /> : <PauseCircle />}
                Hold
              </Button>
              <HeldSalesDialog heldSales={heldSales} onResume={handleResumeHeldSale} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
