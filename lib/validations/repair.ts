import { z } from "zod";
import { REPAIR_STATUS_LABELS } from "@/lib/repair-status";

const REPAIR_STATUSES = Object.keys(REPAIR_STATUS_LABELS) as [string, ...string[]];

export const createRepairTicketSchema = z.object({
  deviceDescription: z.string().min(1, "Device description is required"),
  imei: z.string().optional(),
  reportedIssue: z.string().min(1, "Describe the reported issue"),
  laborCents: z.coerce.number().int().min(0).default(0),
  customerId: z.string().optional(),
  newCustomerName: z.string().optional(),
  newCustomerPhone: z.string().optional(),
});

export const advanceStatusSchema = z.object({
  ticketId: z.string().min(1),
  toStatus: z.enum(REPAIR_STATUSES),
});

export const addPartSchema = z.object({
  ticketId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
});

export const saveDiagnosisSchema = z.object({
  ticketId: z.string().min(1),
  diagnosisNotes: z.string(),
});

export const updateLaborSchema = z.object({
  ticketId: z.string().min(1),
  laborCents: z.coerce.number().int().min(0),
});
