import { z } from "zod";

export const listTodosSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(["TODO", "ONGOING", "DONE", "APPROVED"]).optional(),
    assigneeId: z.coerce.number().int().positive().optional(),
  }),
});

export const createTodoSchema = z.object({
  body: z.object({
    clientName: z.string().trim().min(1).max(180),
    jobType: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
});

export const updateTodoStatusSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    newStatus: z.enum(['TODO', 'ONGOING', 'DONE', 'APPROVED']),
  }),
});
