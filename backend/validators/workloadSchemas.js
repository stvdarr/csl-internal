import { z } from "zod";

export const getWorkloadQuerySchema = z.object({
  query: z.object({
    userId: z.string().optional().transform((val) => (val ? Number(val) : undefined)),
  }),
});

export const getWorkloadBreakdownSchema = z.object({
  params: z.object({
    userId: z.string().transform(Number),
  }),
});

export const getHistoricalPerformanceSchema = z.object({
  query: z.object({
    userId: z.string().optional().transform((val) => (val ? Number(val) : undefined)),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }),
});
