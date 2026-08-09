import { z } from "zod";

const baseFields = {
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Name is required"),
  brand: z.string().optional(),
  model: z.string().optional(),
  priceCents: z.coerce.number().int().min(0, "Price cannot be negative"),
};

export const deviceItemSchema = z.object({
  type: z.literal("DEVICE"),
  ...baseFields,
  imei: z.string().min(5, "IMEI/serial is required"),
  condition: z.enum(["new", "excellent", "good", "fair", "poor"]),
  costCents: z.coerce.number().int().min(0).optional(),
});

export const accessoryItemSchema = z.object({
  type: z.literal("ACCESSORY"),
  ...baseFields,
  quantity: z.coerce.number().int().min(0, "Quantity cannot be negative"),
  reorderLevel: z.coerce.number().int().min(0).default(0),
  costCents: z.coerce.number().int().min(0).optional(),
  isPart: z.coerce.boolean().default(false),
});

export const serviceItemSchema = z.object({
  type: z.literal("SERVICE"),
  ...baseFields,
});

export const inventoryItemSchema = z.discriminatedUnion("type", [
  deviceItemSchema,
  accessoryItemSchema,
  serviceItemSchema,
]);

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;

export const receiveStockSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive("Quantity must be positive"),
});
