/**
 * backend/services/clientService.js
 *
 * Client domain service — single source of business logic for all client operations.
 *
 * IMPORTANT: findOrCreateClientByName() at the top is preserved UNCHANGED.
 * It is still used by taxService.importTaxWorkbookRows and bulkCreateTaxTasks.
 *
 * New functions implement SDD §10.6:
 * listClientProfiles, getClientProfile, createClientProfile, updateClientProfile,
 * setClientProfileStatus, exportClientProfiles, importClientProfiles,
 * addFamilyMember, updateFamilyMember, removeFamilyMember
 */

import { Op } from "sequelize";
import xlsx from "xlsx";
import {
  Client,
  ClientProfile,
  ClientFamilyMember,
  User,
} from "../models/index.js";
import { logActivity } from "./activityService.js";
import { normalizeName } from "../utils/normalize.js";
import { runInTransaction } from "../utils/transactionHelper.js";

// ─────────────────────────────────────────────────────────────────────────────
// PRESERVED — findOrCreateClientByName
// Used by taxService.js — DO NOT MODIFY
// ─────────────────────────────────────────────────────────────────────────────

export const findOrCreateClientByName = async (name, transaction) => {
  const cleanName = String(name || "")
    .trim()
    .replace(/\s+/g, " ");
  const normalizedName = normalizeName(cleanName);

  if (!normalizedName) {
    throw new Error("Nama klien wajib diisi");
  }

  // Manual find + create to avoid Sequelize's strict case-sensitive findOrCreate
  let client = await Client.findOne({
    where: { normalizedName },
    transaction,
  });

  if (!client) {
    try {
      client = await Client.create(
        { name: cleanName, normalizedName },
        { transaction },
      );
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") {
        // Race condition: another request created it between findOne and create
        client = await Client.findOne({
          where: { normalizedName },
          transaction,
        });
      } else {
        throw error;
      }
    }
  }

  return client;
};

// ─────────────────────────────────────────────────────────────────────────────
// Sensitive credential fields — excluded from changedFields audit diff (BR-07)
// ─────────────────────────────────────────────────────────────────────────────

const CREDENTIAL_FIELDS = new Set([
  "djp_password",
  "coretax_password",
  "passphrase",
  "pin_djp",
  "email1_password",
  "email2_password",
  "oss_password",
  "accurate_password",
  "bpjs_kes_password",
]);

// ─────────────────────────────────────────────────────────────────────────────
// LIST — GET /api/clients
// FR-01, FR-13, FR-14, FR-15, NFR-03
// ─────────────────────────────────────────────────────────────────────────────

export const listClientProfiles = async ({
  page = 1,
  limit = 20,
  search,
  client_type,
  status,
} = {}) => {
  const where = {};

  if (client_type) where.client_type = client_type;
  if (status) where.status = status;

  if (search) {
    // FR-13: search by name, NPWP 15, NPWP 16, NIK
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { npwp_15: { [Op.like]: `%${search}%` } },
      { npwp_16: { [Op.like]: `%${search}%` } },
      { nik: { [Op.like]: `%${search}%` } },
    ];
  }

  const offset = (page - 1) * limit;

  const { count, rows } = await ClientProfile.findAndCountAll({
    where,
    order: [["name", "ASC"]],
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
    attributes: { exclude: Array.from(CREDENTIAL_FIELDS) },
  });

  return {
    total: count,
    page: parseInt(page, 10),
    totalPages: Math.ceil(count / limit),
    data: rows,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// GET SINGLE — GET /api/clients/:id
// FR-04
// ─────────────────────────────────────────────────────────────────────────────

export const getClientProfile = async (id) => {
  const profile = await ClientProfile.findByPk(id, {
    include: [
      {
        model: ClientFamilyMember,
        as: "FamilyMembers",
        order: [["createdAt", "ASC"]],
      },
      { model: User, as: "CreatedBy", attributes: ["id", "name"] },
      { model: User, as: "UpdatedBy", attributes: ["id", "name"] },
    ],
  });

  if (!profile) {
    const e = new Error("Klien tidak ditemukan");
    e.statusCode = 404;
    throw e;
  }

  return profile;
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE — POST /api/clients
// FR-02, FR-03, FR-16, FR-17, FR-19, BR-02, BR-05
// ─────────────────────────────────────────────────────────────────────────────

export const createClientProfile = async (
  body,
  actor,
  parentTransaction = null,
) => {
  const executeCreate = async (transaction) => {
    const cleanName = String(body.name || "")
      .trim()
      .replace(/\s+/g, " ");
    const normalized_name = normalizeName(cleanName); // FR-17: auto-compute

    // BR-02: Check global uniqueness of normalized_name (before DB constraint fires)
    const existing = await ClientProfile.findOne({
      where: { normalized_name },
      transaction,
    });
    if (existing) {
      const e = new Error("Klien dengan nama ini sudah terdaftar");
      e.statusCode = 409;
      throw e;
    }

    // FR-16 / BR-05: Auto-link to existing thin Client record if one matches
    let client_id = null;
    const existingClient = await Client.findOne({
      where: { normalizedName: normalized_name },
      transaction,
    });
    if (existingClient) {
      client_id = existingClient.id;
    }

    const profile = await ClientProfile.create(
      {
        ...body,
        name: cleanName,
        normalized_name,
        client_id,
        created_by: actor.id,
        updated_by: actor.id,
      },
      { transaction },
    );

    // FR-19: Audit every create action
    await logActivity({
      actionType: "CREATED_CLIENT",
      actorId: actor.id,
      targetType: "CLIENT",
      targetId: profile.id,
      metadata: { name: profile.name, client_type: profile.client_type },
      legacy: { recordType: "CLIENT", recordId: profile.id },
      transaction,
    });

    return profile;
  };

  if (parentTransaction) {
    return executeCreate(parentTransaction);
  }
  return runInTransaction(executeCreate);
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE — PUT /api/clients/:id
// FR-05, FR-18, FR-19, BR-01 (enforced by schema omit), BR-06, BR-07, BR-08
// ─────────────────────────────────────────────────────────────────────────────

export const updateClientProfile = async (id, body, actor) => {
  return runInTransaction(async (transaction) => {
    // Row-level lock prevents lost updates under concurrent edits
    const profile = await ClientProfile.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!profile) {
      const e = new Error("Klien tidak ditemukan");
      e.statusCode = 404;
      throw e;
    }

    // FR-18 / BR-07: Compute changedFields BEFORE applying — exclude credential values
    const changedFields = Object.keys(body).filter(
      (k) => body[k] !== undefined && String(profile[k]) !== String(body[k]),
    );

    // Name change handling (BR-06): recompute normalized_name, re-check uniqueness,
    // and re-link to Client record if a match now exists.
    const updatePayload = { ...body, updated_by: actor.id };

    if (body.name) {
      const cleanName = String(body.name).trim().replace(/\s+/g, " ");
      const normalized_name = normalizeName(cleanName);

      if (normalized_name !== profile.normalized_name) {
        // Check new normalized name does not conflict
        const conflict = await ClientProfile.findOne({
          where: { normalized_name },
          transaction,
        });
        if (conflict) {
          const e = new Error("Nama klien ini sudah digunakan");
          e.statusCode = 409;
          throw e;
        }

        updatePayload.name = cleanName;
        updatePayload.normalized_name = normalized_name;

        // BR-06: Re-link client_id if a Client record matches the new name
        const matchingClient = await Client.findOne({
          where: { normalizedName: normalized_name },
          transaction,
        });
        if (matchingClient) {
          updatePayload.client_id = matchingClient.id;
        }
      }
    }

    await profile.update(updatePayload, { transaction });

    // FR-19 / BR-07 / BR-08: Audit log — field names only, NO credential values
    await logActivity({
      actionType: "UPDATED_CLIENT",
      actorId: actor.id,
      targetType: "CLIENT",
      targetId: profile.id,
      metadata: {
        changedFields: changedFields.filter((f) => !CREDENTIAL_FIELDS.has(f)),
        credentialFieldsChanged: changedFields.some((f) =>
          CREDENTIAL_FIELDS.has(f),
        ), // BR-08
      },
      legacy: { recordType: "CLIENT", recordId: profile.id },
      transaction,
    });

    return ClientProfile.findByPk(id, { transaction });
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// STATUS CHANGE — PATCH /api/clients/:id/status
// FR-06, FR-19, BR-03
// ─────────────────────────────────────────────────────────────────────────────

export const setClientProfileStatus = async (id, status, actor) => {
  return runInTransaction(async (transaction) => {
    const profile = await ClientProfile.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!profile) {
      const e = new Error("Klien tidak ditemukan");
      e.statusCode = 404;
      throw e;
    }

    // BR-03: Guard against redundant status change
    if (profile.status === status) {
      const e = new Error("Status sudah sama");
      e.statusCode = 400;
      throw e;
    }

    await profile.update({ status, updated_by: actor.id }, { transaction });

    // FR-19: Differentiated audit action types for activate vs deactivate
    const actionType =
      status === "INACTIVE" ? "DEACTIVATED_CLIENT" : "REACTIVATED_CLIENT";

    await logActivity({
      actionType,
      actorId: actor.id,
      targetType: "CLIENT",
      targetId: profile.id,
      metadata: {
        previousStatus: profile.previous("status"),
        newStatus: status,
      },
      legacy: { recordType: "CLIENT", recordId: profile.id },
      transaction,
    });

    return profile;
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT — GET /api/clients/export
// FR-07, FR-28, FR-29, BR-09, BR-10, NFR-02
// ─────────────────────────────────────────────────────────────────────────────

export const exportClientProfiles = async (
  { client_type, status } = {},
  actor,
) => {
  const where = {};
  if (client_type) where.client_type = client_type;
  if (status) where.status = status;

  // Fetch all matching profiles including family members (for Sheet 3)
  const profiles = await ClientProfile.findAll({
    where,
    include: [{ model: ClientFamilyMember, as: "FamilyMembers" }],
    order: [["name", "ASC"]],
  });

  const wb = xlsx.utils.book_new();

  // Sheet 1: Orang Pribadi (FR-07 — SDD §5.17)
  const opRows = profiles
    .filter((p) => p.client_type === "ORANG_PRIBADI")
    .map((p) => ({
      Nama: p.name,
      "NPWP 15": p.npwp_15,
      "NPWP 16": p.npwp_16,
      NIK: p.nik,
      "Password DJP": p.djp_password,
      "Password Coretax": p.coretax_password,
      Passphrase: p.passphrase,
      "Email 1": p.email1,
      "Password Email 1": p.email1_password,
      EFIN: p.efin,
      HP: p.phone,
      "Email 2": p.email2,
      "Password Email 2": p.email2_password,
      Alamat: p.address,
      PIN: p.pin_djp,
      Afiliasi: p.group_affiliation,
      KPP: p.kpp,
      "Tanggal Daftar": p.registered_date,
      Status: p.status,
      Catatan: p.notes,
    }));
  const wsOP = xlsx.utils.json_to_sheet(opRows.length ? opRows : [{}]);
  xlsx.utils.book_append_sheet(wb, wsOP, "Orang Pribadi");

  // Sheet 2: Badan
  const badanRows = profiles
    .filter((p) => p.client_type === "BADAN")
    .map((p) => ({
      Nama: p.name,
      "NPWP 16": p.npwp_16,
      "Password DJP": p.djp_password,
      "Password Coretax": p.coretax_password,
      "Email 1": p.email1,
      "Password Email 1": p.email1_password,
      EFIN: p.efin,
      HP: p.phone,
      "Email 2": p.email2,
      "Password Email 2": p.email2_password,
      "Username OSS": p.oss_username,
      "Password OSS": p.oss_password,
      "Email Accurate": p.accurate_email,
      "Password Accurate": p.accurate_password,
      "No BPJS Kes": p.bpjs_kes_number,
      "Password BPJS": p.bpjs_kes_password,
      Alamat: p.address,
      Status: p.status,
      Catatan: p.notes,
    }));
  const wsBadan = xlsx.utils.json_to_sheet(badanRows.length ? badanRows : [{}]);
  xlsx.utils.book_append_sheet(wb, wsBadan, "Badan");

  // Sheet 3: Tanggungan (family members of OP clients)
  const tanggunganRows = profiles.flatMap((p) =>
    (p.FamilyMembers || []).map((m) => ({
      "Nama Klien": p.name,
      NIK: m.nik,
      NPWP: m.npwp,
      Nama: m.name,
      "Tgl Lahir": m.birth_date,
      Hubungan: m.relationship,
      Pekerjaan: m.occupation,
      "Status PTKP": m.ptkp_status,
    })),
  );
  const wsTanggungan = xlsx.utils.json_to_sheet(
    tanggunganRows.length ? tanggunganRows : [{}],
  );
  xlsx.utils.book_append_sheet(wb, wsTanggungan, "Tanggungan");

  const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

  // FR-29: Audit export — fire-and-forget (does not block response)
  logActivity({
    actionType: "EXPORTED_CLIENTS",
    actorId: actor.id,
    targetType: "CLIENT",
    targetId: 0,
    metadata: {
      client_type: client_type || "ALL",
      status: status || "ALL",
      count: profiles.length,
    },
    legacy: { recordType: "CLIENT", recordId: 0 },
  }).catch(() => {});

  return { buffer, count: profiles.length };
};

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT — POST /api/clients/import
// FR-08, FR-30
// ─────────────────────────────────────────────────────────────────────────────

/**
 * REPLACEMENT for importClientProfiles
 *
 * Fix: the previous implementation only recognized sheets literally named
 * "Orang Pribadi" / "Badan" (the EXPORT format). The user's real source file
 * uses the ORIGINAL sheet names "EFIN OP" / "EFIN BADAN" with raw column
 * headers (NPWP, EMAIL, PASSWORD DJP, etc. — not the renamed export headers
 * like "NPWP 15", "Email 1"). Because the lookup silently fell through to
 * an empty array instead of throwing, the import returned 0/0/0 with no
 * indication of what went wrong.
 *
 * This version:
 * 1. Detects sheets by flexible name matching (handles both raw source
 * sheet names AND already-exported sheet names).
 * 2. Reads rows POSITIONALLY (header: 1) instead of by header text, since
 * the raw "EFIN BADAN" sheet has an unlabeled first column and
 * inconsistent header casing across sheets.
 * 3. Falls back to name-based column mapping ONLY for sheets that match
 * the export format ("Orang Pribadi" / "Badan"), since those sheets
 * were written by exportClientProfiles() and have clean headers.
 * 4. Reports skippedSheets explicitly in the response so failures are
 * visible instead of silent.
 */

// ── Positional column maps for the RAW SOURCE spreadsheet format ──────────
// (i.e. the original "EFIN OP" / "EFIN BADAN" sheets, columns indexed
// AFTER the leading row-number column, which is dropped.)

const RAW_OP_COLUMNS = [
  "name", // [0] NAMA
  "group_affiliation", // [1] (unnamed group column, e.g. INTERCON)
  "npwp_15", // [2] NPWP
  null, // [3] NPWP CABANG — not modeled, intentionally skipped
  null, // [4] UMKM (e.g. "FINAL") — not modeled, intentionally skipped
  null, // [5] SPT (e.g. "1770") — not modeled, intentionally skipped
  null, // [6] TAHUN NPWP — not modeled, intentionally skipped
  "nik", // [7] NIK
  "djp_password", // [8] PASSWORD DJP
  "coretax_password", // [9] PASSWORD CORETAX
  "passphrase", // [10] PASSPHRASE
  "email1", // [11] EMAIL
  "email1_password", // [12] PASSWORD EMAIL
  "efin", // [13] EFIN
  "phone", // [14] HP
  "email2", // [15] EMAIL2
  "email2_password", // [16] PASSWORD EMAIL2
  "address", // [17] ALAMAT
  "pin_djp", // [18] PIN
];

const RAW_BADAN_COLUMNS = [
  "name", // (unlabeled first column — company name, e.g. "PT. CERITA JADI FILM")
  "npwp_16", // NPWP 16 DIGIT
  "djp_password", // PASSWORD DJP
  "coretax_password", // PASSWORD CORETAX
  "email1", // EMAIL
  "email1_password", // PASSWORD EMAIL
  "efin", // EFIN
  "phone", // HP
  "email2", // EMAIL2
  "email2_password", // PASSWORD EMAIL2
  "oss_username", // OSS
  "oss_password", // Password OSS
  "accurate_email", // Email Accurate
  "accurate_password", // Password Accurate
  "bpjs_kes_number", // BPJS KES
  "bpjs_kes_password", // PASSWORD BPJS
  "address", // ALAMAT
];

const clean = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};

/**
 * Reads a raw source sheet (EFIN OP / EFIN BADAN style: unlabeled or
 * inconsistent headers, leading ordinal column) using positional mapping.
 * Skips the header row (row index 0) and any fully blank rows.
 */
const parseRawSheet = (sheet, columns, clientType) => {
  const rows = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
    raw: true,
  });

  const parsed = [];
  for (let r = 1; r < rows.length; r += 1) {
    const raw = rows[r];
    if (!raw || raw.every((c) => c === null || c === "")) continue;

    // Drop the leading ordinal/number column (row[0]), map the rest positionally
    const cells = raw.slice(1);
    const obj = { client_type: clientType, status: "ACTIVE" };
    columns.forEach((field, idx) => {
      if (field === null) return; // intentionally-skipped column (e.g. NPWP CABANG, UMKM, SPT, TAHUN NPWP)
      obj[field] = clean(cells[idx]);
    });
    obj._sourceRow = r + 1; // 1-based, matches what a user sees in Excel
    parsed.push(obj);
  }
  return parsed;
};

/**
 * Reads an already-exported sheet ("Orang Pribadi" / "Badan", written by
 * exportClientProfiles) using name-based header mapping, since those
 * headers are clean and consistent.
 */
const parseExportedSheet = (sheet, clientType) => {
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });

  return rows.map((row, i) => ({
    client_type: clientType,
    name: clean(row["Nama"]),
    npwp_15: clean(row["NPWP 15"]),
    npwp_16: clean(row["NPWP 16"]),
    nik: clean(row["NIK"]),
    efin: clean(row["EFIN"]),
    djp_password: clean(row["Password DJP"]),
    coretax_password: clean(row["Password Coretax"]),
    passphrase: clean(row["Passphrase"]),
    email1: clean(row["Email 1"]),
    email1_password: clean(row["Password Email 1"]),
    email2: clean(row["Email 2"]),
    email2_password: clean(row["Password Email 2"]),
    phone: clean(row["HP"]),
    address: clean(row["Alamat"]),
    pin_djp: clean(row["PIN"]),
    group_affiliation: clean(row["Afiliasi"]),
    kpp: clean(row["KPP"]),
    registered_date: clean(row["Tanggal Daftar"]),
    status: row["Status"] === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    notes: clean(row["Catatan"]),
    oss_username: clean(row["Username OSS"]),
    oss_password: clean(row["Password OSS"]),
    accurate_email: clean(row["Email Accurate"]),
    accurate_password: clean(row["Password Accurate"]),
    bpjs_kes_number: clean(row["No BPJS Kes"]),
    bpjs_kes_password: clean(row["Password BPJS"]),
    _sourceRow: i + 2, // +2: 1-based + header row offset
  }));
};

// ── Sheet name classification ──────────────────────────────────────────────
// Recognizes BOTH the raw source workbook ("EFIN OP", "EFIN BADAN") AND the
// exported workbook ("Orang Pribadi", "Badan"). Uses an EXPLICIT whitelist
// rather than loose substring matching — the source workbook also contains
// "EFIN NA" (inactive/deceased taxpayers, different column layout), "EFIN
// BACKUP" (stale duplicate of EFIN OP), "PT", and "OP" (monthly tax status
// matrices, completely different shape) — none of these should be imported
// as client profiles. Returns { clientType, format } or null if the sheet
// is not on the whitelist.

const RAW_SHEET_WHITELIST = {
  "EFIN OP": "ORANG_PRIBADI",
  "EFIN BADAN": "BADAN",
};

const classifySheet = (sheetName) => {
  const trimmed = sheetName.trim();
  const upper = trimmed.toUpperCase();

  if (upper === "ORANG PRIBADI")
    return { clientType: "ORANG_PRIBADI", format: "EXPORTED" };
  if (upper === "BADAN") return { clientType: "BADAN", format: "EXPORTED" };

  if (RAW_SHEET_WHITELIST[upper]) {
    return { clientType: RAW_SHEET_WHITELIST[upper], format: "RAW" };
  }

  return null;
};

export const importClientProfiles = async (filePath, actor) => {
  const wb = xlsx.readFile(filePath, { cellDates: true });

  const result = { success: 0, failed: 0, errors: [], skippedSheets: [] };
  const allRows = [];

  for (const sheetName of wb.SheetNames) {
    const classification = classifySheet(sheetName);
    if (!classification) {
      result.skippedSheets.push({
        sheet: sheetName,
        reason: "Nama sheet tidak dikenali sebagai data OP atau Badan.",
      });
      continue;
    }

    const { clientType, format } = classification;
    const sheet = wb.Sheets[sheetName];

    const rows =
      format === "RAW"
        ? parseRawSheet(
            sheet,
            clientType === "ORANG_PRIBADI" ? RAW_OP_COLUMNS : RAW_BADAN_COLUMNS,
            clientType,
          )
        : parseExportedSheet(sheet, clientType);

    rows.forEach((r) =>
      allRows.push({ sheet: sheetName, row: r._sourceRow, data: r }),
    );
  }

  // Change D+E (preserved from original): partial import loop, no parent
  // transaction — each createClientProfile call owns its own transaction,
  // so one bad row never aborts the whole batch.
  for (const { sheet, row, data } of allRows) {
    const { _sourceRow, ...payload } = data;

    if (!payload.name) {
      result.failed += 1;
      result.errors.push({ sheet, row, reason: "Nama klien wajib diisi" });
      continue;
    }

    try {
      await createClientProfile(payload, actor);
      result.success += 1;
    } catch (e) {
      result.failed += 1;
      if (e.statusCode === 409) {
        result.errors.push({ sheet, row, reason: `Duplikat: ${payload.name}` });
      } else {
        result.errors.push({ sheet, row, reason: e.message });
      }
    }
  }

  logActivity({
    actionType: "IMPORTED_CLIENTS",
    actorId: actor.id,
    targetType: "CLIENT",
    targetId: 0,
    metadata: {
      success: result.success,
      failed: result.failed,
      skippedSheets: result.skippedSheets,
    },
    legacy: { recordType: "CLIENT", recordId: 0 },
  }).catch(() => {});

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// FAMILY MEMBER — ADD
// FR-10, FR-19
// ─────────────────────────────────────────────────────────────────────────────

export const addFamilyMember = async (clientProfileId, body, actor) => {
  return runInTransaction(async (transaction) => {
    const profile = await ClientProfile.findByPk(clientProfileId, {
      transaction,
    });
    if (!profile) {
      const e = new Error("Klien tidak ditemukan");
      e.statusCode = 404;
      throw e;
    }

    if (profile.client_type !== "ORANG_PRIBADI") {
      const e = new Error(
        "Tanggungan hanya dapat ditambahkan pada klien Orang Pribadi",
      );
      e.statusCode = 400;
      throw e;
    }

    const member = await ClientFamilyMember.create(
      {
        client_profile_id: clientProfileId,
        ...body,
      },
      { transaction },
    );

    await logActivity({
      actionType: "ADDED_FAMILY_MEMBER",
      actorId: actor.id,
      targetType: "CLIENT",
      targetId: clientProfileId,
      metadata: { memberName: body.name, relationship: body.relationship },
      legacy: { recordType: "CLIENT", recordId: clientProfileId },
      transaction,
    });

    return member;
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// FAMILY MEMBER — UPDATE
// FR-11, FR-19
// ─────────────────────────────────────────────────────────────────────────────

export const updateFamilyMember = async (
  clientProfileId,
  memberId,
  body,
  actor,
) => {
  return runInTransaction(async (transaction) => {
    const member = await ClientFamilyMember.findOne({
      where: { id: memberId, client_profile_id: clientProfileId },
      transaction,
    });
    if (!member) {
      const e = new Error("Anggota keluarga tidak ditemukan");
      e.statusCode = 404;
      throw e;
    }

    await member.update(body, { transaction });

    await logActivity({
      actionType: "UPDATED_FAMILY_MEMBER",
      actorId: actor.id,
      targetType: "CLIENT",
      targetId: clientProfileId,
      metadata: { memberId, memberName: member.name },
      legacy: { recordType: "CLIENT", recordId: clientProfileId },
      transaction,
    });

    return member;
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// FAMILY MEMBER — DELETE
// FR-12, FR-19
// ─────────────────────────────────────────────────────────────────────────────

export const removeFamilyMember = async (clientProfileId, memberId, actor) => {
  return runInTransaction(async (transaction) => {
    const member = await ClientFamilyMember.findOne({
      where: { id: memberId, client_profile_id: clientProfileId },
      transaction,
    });
    if (!member) {
      const e = new Error("Anggota keluarga tidak ditemukan");
      e.statusCode = 404;
      throw e;
    }

    const memberName = member.name;
    await member.destroy({ transaction });

    await logActivity({
      actionType: "REMOVED_FAMILY_MEMBER",
      actorId: actor.id,
      targetType: "CLIENT",
      targetId: clientProfileId,
      metadata: { memberId, memberName },
      legacy: { recordType: "CLIENT", recordId: clientProfileId },
      transaction,
    });
  });
};