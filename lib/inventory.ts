/** Guards every stock decrement path (POS checkout, repair parts consumption) so quantity_on_hand can never go negative. */
export function canFulfillQuantity(availableQuantity: number, requestedQuantity: number): boolean {
  if (requestedQuantity <= 0) return false;
  return availableQuantity >= requestedQuantity;
}

export function decrementQuantity(availableQuantity: number, requestedQuantity: number): number {
  if (!canFulfillQuantity(availableQuantity, requestedQuantity)) {
    throw new Error(
      `Cannot decrement ${requestedQuantity} from available quantity ${availableQuantity}`,
    );
  }
  return availableQuantity - requestedQuantity;
}
