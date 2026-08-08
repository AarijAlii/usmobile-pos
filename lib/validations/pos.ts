import { z } from "zod";

export const cartLineSchema = z.object({
  productId: z.string().min(1),
  inventoryUnitId: z.string().optional(),
  quantity: z.coerce.number().int().positive(),
});

export const checkoutSchema = z.object({
  cart: z
    .string()
    .min(1)
    .transform((val, ctx) => {
      try {
        const parsed = JSON.parse(val);
        return z.array(cartLineSchema).min(1, "Cart is empty").parse(parsed);
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid cart data" });
        return z.NEVER;
      }
    }),
  customerId: z.string().optional(),
  newCustomerName: z.string().optional(),
  newCustomerPhone: z.string().optional(),
});
