/**
 * backend/validators/clientSchemas.js
 *
 * Zod validation schemas for all client profile endpoints.
 *
 * Covers VR-01 through VR-19 (SDD §10.5, §10.11).
 * All schemas are passed to the existing validateRequest middleware.
 */

import { z } from "zod";

// ─────────────────────────────────────────────
// Shared field helpers
// ─────────────────────────────────────────────

/** Optional nullable string with a max length constraint. Trims whitespace. */
const optionalStr = (max = 255) =>
  z.string().trim().max(max).optional().nullable();

/** Optional nullable email — validated only when a non-empty value is provided. */
const optionalEmail = z
  .string()
  .trim()
  .email("Format email tidak valid")
  .max(255)
  .optional()
  .nullable();

/** Optional nullable date string in YYYY-MM-DD format. */
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
  .optional()
  .nullable();

// ─────────────────────────────────────────────
// Shared client body (all writable profile fields)
// VR-01 through VR-19
// ─────────────────────────────────────────────

const clientBodySchema = z.object({
  // Identity (VR-01, VR-02)
  client_type: z.enum(["ORANG_PRIBADI", "BADAN"]),
  name:        z.string().trim().min(1, "Nama wajib diisi").max(255),

  // Tax identity (VR-03 to VR-06)
  npwp_15: optionalStr(20),
  npwp_16: optionalStr(20),
  nik:     optionalStr(20),
  efin:    optionalStr(20),

  // DJP profile
  taxpayer_type:       optionalStr(100),
  taxpayer_category:   optionalStr(100),
  npwp_status:         z.enum(["AKTIF", "NON_AKTIF", "HAPUS"]).optional().nullable(),
  registered_date:     dateString, // VR-08
  activation_date:     dateString,
  pkp_status:          z.boolean().optional().default(false), // VR-09
  pkp_date:            dateString,
  klu_code:            optionalStr(10),
  klu_description:     optionalStr(500), // VR-18
  kanwil:              optionalStr(255),
  kpp:                 optionalStr(255),
  supervision_section: optionalStr(100),

  // Contact
  phone:             optionalStr(30),
  address:           optionalStr(1000), // VR-17
  group_affiliation: optionalStr(255),

  // Credentials — DJP (VR-11)
  djp_password:     optionalStr(255),
  coretax_password: optionalStr(255),
  passphrase:       optionalStr(255),
  pin_djp:          optionalStr(20),

  // Credentials — Email (VR-07)
  email1:          optionalEmail,
  email1_password: optionalStr(255),
  email2:          optionalEmail,
  email2_password: optionalStr(255),

  // Credentials — Badan only (VR-11)
  oss_username:      optionalStr(255),
  oss_password:      optionalStr(255),
  accurate_email:    optionalEmail, // VR-07
  accurate_password: optionalStr(255),
  bpjs_kes_number:   optionalStr(50),
  bpjs_kes_password: optionalStr(255),

  // Notes (VR-10)
  notes: optionalStr(2000),
});

// ─────────────────────────────────────────────
// POST /api/clients — Create
// VR-01, VR-02 enforced (required fields)
// ─────────────────────────────────────────────

export const createClientSchema = z.object({
  body: clientBodySchema,
});

// ─────────────────────────────────────────────
// PUT /api/clients/:id — Update
// client_type is omitted (BR-01: immutable after creation, VR-16)
// All other fields optional for partial update
// ─────────────────────────────────────────────

export const updateClientSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: clientBodySchema
    .omit({ client_type: true })  // VR-16: client_type immutable on update
    .partial(),
});

// ─────────────────────────────────────────────
// GET /api/clients — List (paginated, filtered)
// VR-13, VR-19
// ─────────────────────────────────────────────

export const listClientProfilesSchema = z.object({
  query: z.object({
    page:        z.coerce.number().int().positive().default(1),           // VR-19
    limit:       z.coerce.number().int().positive().max(100).default(20), // VR-13
    search:      z.string().trim().max(255).optional(),
    client_type: z.enum(["ORANG_PRIBADI", "BADAN"]).optional(),
    status:      z.enum(["ACTIVE", "INACTIVE"]).optional(),
  }),
});

// ─────────────────────────────────────────────
// GET /api/clients/:id — Single profile
// ─────────────────────────────────────────────

export const clientIdParamSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});

// ─────────────────────────────────────────────
// PATCH /api/clients/:id/status — Activate/Deactivate
// ─────────────────────────────────────────────

export const clientStatusSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body:   z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) }),
});

// ─────────────────────────────────────────────
// GET /api/clients/export — Export to Excel
// ─────────────────────────────────────────────

export const exportClientsSchema = z.object({
  query: z.object({
    client_type: z.enum(["ORANG_PRIBADI", "BADAN"]).optional(),
    status:      z.enum(["ACTIVE", "INACTIVE"]).optional(),
  }),
});

// ─────────────────────────────────────────────
// Family member schemas
// VR-14, VR-15
// ─────────────────────────────────────────────

const familyMemberBodySchema = z.object({
  nik:          optionalStr(20),
  npwp:         optionalStr(20),
  name:         z.string().trim().min(1, "Nama anggota keluarga wajib diisi").max(255), // VR-14
  birth_date:   dateString,
  relationship: z.enum(["SUAMI", "ISTRI", "ANAK", "TANGGUNGAN_LAIN"]),                 // VR-15
  occupation:   optionalStr(255),
  ptkp_status:  optionalStr(50),
  notes:        optionalStr(500),
});

export const addFamilyMemberSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body:   familyMemberBodySchema,
});

export const updateFamilyMemberSchema = z.object({
  params: z.object({
    id:       z.coerce.number().int().positive(),
    memberId: z.coerce.number().int().positive(),
  }),
  body: familyMemberBodySchema.partial(),
});

export const deleteFamilyMemberSchema = z.object({
  params: z.object({
    id:       z.coerce.number().int().positive(),
    memberId: z.coerce.number().int().positive(),
  }),
});
