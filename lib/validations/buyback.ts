import { z } from "zod";

export const buybackSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Device name is required"),
  brand: z.string().optional(),
  model: z.string().optional(),
  imei: z.string().min(5, "IMEI/serial is required"),
  conditionNotes: z.string().min(1, "Add a condition note"),
  offerPriceCents: z.coerce.number().int().min(0, "Offer price cannot be negative"),
  payoutMethod: z.enum(["cash", "store_credit"]),
  customerId: z.string().optional(),
  newCustomerName: z.string().optional(),
  newCustomerPhone: z.string().optional(),
});
