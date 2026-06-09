import { z } from "zod";
import { TASK_STATUSES } from "../constants/taskStatus.js";

const idParam = z.object({
  id: z.coerce.number().int().positive(),
});

export const listTaxesSchema = z.object({
  query: z.object({
    assigneeId: z.coerce.number().int().positive().optional(),
    clientId: z.coerce.number().int().positive().optional(),
    status: z.enum(TASK_STATUSES).optional(),
  }),
});

export const createTaxSchema = z.object({
  body: z.object({
    clientName: z.string().trim().min(1).max(180),
    taxType: z.string().trim().min(1).max(80).default("UMUM"),
    period: z.string().trim().min(1).max(80),
    amount: z.coerce.number().nonnegative().default(0),
    status: z.enum(TASK_STATUSES).optional(),
    pic_id: z.number().int().positive().optional(),
  }),
});

export const updateTaxStatusSchema = z.object({
  params: idParam,
  body: z.object({
    newStatus: z.enum(TASK_STATUSES),
  }),
});

export const assignTaxSchema = z.object({
  params: idParam,
  body: z.object({
    toUserId: z.number().int().positive(),
    reason: z.string().trim().max(240).optional(),
  }),
});

export const bulkTaxUploadSchema = z.object({
  body: z.object({
    uploadedTaxType: z.string().trim().min(1).max(80).default("UNIFIKASI"),
    data: z.array(z.record(z.any())).min(1).max(5000),
  }),
});

export const confirmWorkbookImportSchema = z.object({
  body: z.object({
    rows: z.array(
      z.object({
        clientName: z.string().trim().min(1).max(180),
        picName: z.string().trim().max(120).optional().nullable(),
        taxType: z.string().trim().min(1).max(80),
        period: z.string().trim().min(1).max(80),
        status: z.string().trim().min(1).max(40),
        amount: z.coerce.number().nonnegative().default(0),
        sourceSheet: z.string().trim().min(1).max(80),
        sourceRow: z.number().int().positive(),
        sourceColumn: z.number().int().positive(),
      }),
    ).min(1).max(10000),
  }),
});
