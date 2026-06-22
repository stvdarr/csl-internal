
import { z } from "zod";
import { TASK_STATUSES } from "../constants/taskStatus.js";
import { CLEAR_ALL_TAX_CONFIRMATION } from "../constants/destructiveActions.js";

const idParam = z.object({
  id: z.coerce.number().int().positive(),
});

export const listTaxesSchema = z.object({
  query: z.object({
    assigneeId: z.coerce.number().int().positive().optional(),
    clientId: z.coerce.number().int().positive().optional(),
    taxType: z.string().trim().max(80).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export const listActivitySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export const listClientsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
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
  params: z.object({
    periodId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    newStatus: z.enum(TASK_STATUSES),
  }),
});

export const confirmWorkbookImportSchema = z.object({
  body: z.object({
    rows: z
      .array(
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
        })
      )
      .min(1)
      .max(10000),
  }),
});

export const clearAllTaxesSchema = z.object({
  body: z.object({
    confirmation: z.literal(CLEAR_ALL_TAX_CONFIRMATION),
  }),
});

// --- NEW SCHEMAS FOR OBLIGATION ---
export const createObligationSchema = z.object({
  body: z.object({
    clientName: z.string().trim().min(1).max(180),
    taxType: z.string().trim().min(1).max(80),
    pic_id: z.number().int().positive().optional(),
  }),
});

export const listObligationsSchema = z.object({
  query: z.object({
    taxType: z.string().trim().max(80).optional(),
    clientId: z.coerce.number().int().positive().optional(),
  }),
});

export const assignObligationSchema = z.object({
  params: z.object({
    obligationId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    toUserId: z.coerce.number().int().positive(),
    reason: z.string().trim().max(255).optional(),
  }),
});
