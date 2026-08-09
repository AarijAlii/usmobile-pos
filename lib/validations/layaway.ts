import { z } from "zod";

export const createLayawaySchema = z.object({
  inventoryUnitId: z.string().min(1, "Select a device"),
  priceCents: z.coerce.number().int().positive("Price must be greater than 0"), // pre-tax; tax is computed server-side
  depositCents: z.coerce.number().int().positive("Deposit must be greater than 0"),
  dueDate: z.string().min(1, "Due date is required"),
  customerId: z.string().optional(),
  newCustomerName: z.string().optional(),
  newCustomerPhone: z.string().optional(),
});

export const addLayawayPaymentSchema = z.object({
  layawayId: z.string().min(1),
  amountCents: z.coerce.number().int().positive("Payment must be greater than 0"),
});
