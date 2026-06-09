import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(180).toLowerCase(),
    password: z.string().min(8).max(128),
    role: z.enum(["Staff", "Admin"]).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email().max(180).toLowerCase(),
    password: z.string().min(1).max(128),
  }),
});
