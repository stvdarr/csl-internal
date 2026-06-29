/**
 * backend/services/clientService.js
 *
 * Client domain service — single source of business logic for all client operations.
 *
 * IMPORTANT: findOrCreateClientByName() at the top is preserved UNCHANGED.
 * It is still used by taxService.importTaxWorkbookRows and bulkCreateTaxTasks.
 *
 * New functions implement SDD §10.6:
 *   listClientProfiles, getClientProfile, createClientProfile, updateClientProfile,
 *   setClientProfileStatus, exportClientProfiles, importClientProfiles,
 *   addFamilyMember, updateFamilyMember, removeFamilyMember
 */

import { Op } from "sequelize";
import xlsx from "xlsx";
import { Client, ClientProfile, ClientFamilyMember, ClientCredential, User } from "../models/index.js";
import { logActivity } from "./activityService.js";
import { normalizeName } from "../utils/normalize.js";
import { runInTransaction } from "../utils/transactionHelper.js";

// ─────────────────────────────────────────────────────────────────────────────
// PRESERVED — findOrCreateClientByName
// Used by taxService.js — DO NOT MODIFY
// ─────────────────────────────────────────────────────────────────────────────

export const findOrCreateClientByName = async (name, transaction) => {
  const cleanName = String(name || "").trim().replace(/\s+/g, " ");
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
        { transaction }
      );
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") {
        // Race condition: another request created it between findOne and create
        client = await Client.findOne({ where: { normalizedName }, transaction });
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
  include_credentials = false,
  no_limit = false,
} = {}) => {
  const where = {};

  if (client_type) where.client_type = client_type;
  if (status)      where.status      = status;

  if (search) {
    // FR-13: search by name, NPWP 15, NPWP 16, NIK
    where[Op.or] = [
      { name:    { [Op.like]: `%${search}%` } },
      { npwp_15: { [Op.like]: `%${search}%` } },
      { npwp_16: { [Op.like]: `%${search}%` } },
      { nik:     { [Op.like]: `%${search}%` } },
    ];
  }

  // Attributes: exclude credential fields unless caller explicitly requests them
  const attributesOpt = include_credentials
    ? undefined  // return all fields
    : { exclude: Array.from(CREDENTIAL_FIELDS) };

  if (no_limit) {
    // Fetch ALL rows (no pagination) — used by matrix view
    const rows = await ClientProfile.findAll({
      where,
      order: [["name", "ASC"]],
      attributes: attributesOpt,
    });
    return {
      total:      rows.length,
      page:       1,
      totalPages: 1,
      data:       rows,
    };
  }

  const offset = (page - 1) * limit;

  const { count, rows } = await ClientProfile.findAndCountAll({
    where,
    order: [["name", "ASC"]],
    limit:  parseInt(limit, 10),
    offset: parseInt(offset, 10),
    attributes: attributesOpt,
  });

  return {
    total:      count,
    page:       parseInt(page, 10),
    totalPages: Math.ceil(count / limit),
    data:       rows,
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
      {
        model: ClientCredential,
        as: "Credentials",
        order: [["sort_order", "ASC"], ["createdAt", "ASC"]],
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

export const createClientProfile = async (body, actor, parentTransaction = null) => {
  const executeCreate = async (transaction) => {
    const cleanName = String(body.name || "").trim().replace(/\s+/g, " ");
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
      { transaction }
    );

    // FR-19: Audit every create action
    await logActivity({
      actionType: "CREATED_CLIENT",
      actorId:    actor.id,
      targetType: "CLIENT",
      targetId:   profile.id,
      metadata:   { name: profile.name, client_type: profile.client_type },
      legacy:     { recordType: "CLIENT", recordId: profile.id },
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
      (k) => body[k] !== undefined && String(profile[k]) !== String(body[k])
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

        updatePayload.name            = cleanName;
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
      actorId:    actor.id,
      targetType: "CLIENT",
      targetId:   profile.id,
      metadata: {
        changedFields:           changedFields.filter((f) => !CREDENTIAL_FIELDS.has(f)),
        credentialFieldsChanged: changedFields.some((f) => CREDENTIAL_FIELDS.has(f)), // BR-08
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
      actorId:    actor.id,
      targetType: "CLIENT",
      targetId:   profile.id,
      metadata:   { previousStatus: profile.previous("status"), newStatus: status },
      legacy:     { recordType: "CLIENT", recordId: profile.id },
      transaction,
    });

    return profile;
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT — GET /api/clients/export
// FR-07, FR-28, FR-29, BR-09, BR-10, NFR-02
// ─────────────────────────────────────────────────────────────────────────────

export const exportClientProfiles = async ({ client_type, status } = {}, actor) => {
  const where = {};
  if (client_type) where.client_type = client_type;
  if (status)      where.status      = status;

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
      Nama:               p.name,
      "NPWP 15":          p.npwp_15,
      "NPWP 16":          p.npwp_16,
      NIK:                p.nik,
      "Password DJP":     p.djp_password,
      "Password Coretax": p.coretax_password,
      Passphrase:         p.passphrase,
      "Email 1":          p.email1,
      "Password Email 1": p.email1_password,
      EFIN:               p.efin,
      HP:                 p.phone,
      "Email 2":          p.email2,
      "Password Email 2": p.email2_password,
      Alamat:             p.address,
      PIN:                p.pin_djp,
      Afiliasi:           p.group_affiliation,
      KPP:                p.kpp,
      "Tanggal Daftar":   p.registered_date,
      Status:             p.status,
      Catatan:            p.notes,
    }));
  const wsOP = xlsx.utils.json_to_sheet(opRows.length ? opRows : [{}]);
  xlsx.utils.book_append_sheet(wb, wsOP, "Orang Pribadi");

  // Sheet 2: Badan
  const badanRows = profiles
    .filter((p) => p.client_type === "BADAN")
    .map((p) => ({
      Nama:               p.name,
      "NPWP 16":          p.npwp_16,
      "Password DJP":     p.djp_password,
      "Password Coretax": p.coretax_password,
      "Email 1":          p.email1,
      "Password Email 1": p.email1_password,
      EFIN:               p.efin,
      HP:                 p.phone,
      "Email 2":          p.email2,
      "Password Email 2": p.email2_password,
      "Username OSS":     p.oss_username,
      "Password OSS":     p.oss_password,
      "Email Accurate":   p.accurate_email,
      "Password Accurate":p.accurate_password,
      "No BPJS Kes":      p.bpjs_kes_number,
      "Password BPJS":    p.bpjs_kes_password,
      Alamat:             p.address,
      Status:             p.status,
      Catatan:            p.notes,
    }));
  const wsBadan = xlsx.utils.json_to_sheet(badanRows.length ? badanRows : [{}]);
  xlsx.utils.book_append_sheet(wb, wsBadan, "Badan");

  // Sheet 3: Tanggungan (family members of OP clients)
  const tanggunganRows = profiles.flatMap((p) =>
    (p.FamilyMembers || []).map((m) => ({
      "Nama Klien":  p.name,
      NIK:           m.nik,
      NPWP:          m.npwp,
      Nama:          m.name,
      "Tgl Lahir":   m.birth_date,
      Hubungan:      m.relationship,
      Pekerjaan:     m.occupation,
      "Status PTKP": m.ptkp_status,
    }))
  );
  const wsTanggungan = xlsx.utils.json_to_sheet(
    tanggunganRows.length ? tanggunganRows : [{}]
  );
  xlsx.utils.book_append_sheet(wb, wsTanggungan, "Tanggungan");

  const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

  // FR-29: Audit export — fire-and-forget (does not block response)
  logActivity({
    actionType: "EXPORTED_CLIENTS",
    actorId:    actor.id,
    targetType: "CLIENT",
    targetId:   0,
    metadata: {
      client_type: client_type || "ALL",
      status:      status      || "ALL",
      count:       profiles.length,
    },
    legacy: { recordType: "CLIENT", recordId: 0 },
  }).catch(() => {});

  return { buffer, count: profiles.length };
};

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT — POST /api/clients/import
// FR-08, FR-30
// ─────────────────────────────────────────────────────────────────────────────

export const importClientProfiles = async (fileBuffer, actor) => {
  const wb      = xlsx.read(fileBuffer, { type: "buffer" });
  const sheetOP = wb.Sheets["Orang Pribadi"];
  const sheetBD = wb.Sheets["Badan"];

  const rowsOP    = sheetOP ? xlsx.utils.sheet_to_json(sheetOP) : [];
  const rowsBadan = sheetBD ? xlsx.utils.sheet_to_json(sheetBD) : [];

  const result = { success: 0, failed: 0, errors: [] };

  // Map spreadsheet column headers back to model fields
  const mapRow = (row, clientType) => ({
    client_type:      clientType,
    name:             row["Nama"] || row["nama"] || null,
    npwp_15:          row["NPWP 15"] || null,
    npwp_16:          row["NPWP 16"] || null,
    nik:              row["NIK"] || null,
    efin:             row["EFIN"] || null,
    djp_password:     row["Password DJP"] || null,
    coretax_password: row["Password Coretax"] || null,
    passphrase:       row["Passphrase"] || null,
    email1:           row["Email 1"] || null,
    email1_password:  row["Password Email 1"] || null,
    email2:           row["Email 2"] || null,
    email2_password:  row["Password Email 2"] || null,
    phone:            row["HP"] || null,
    address:          row["Alamat"] || null,
    pin_djp:          row["PIN"] || null,
    group_affiliation:row["Afiliasi"] || null,
    kpp:              row["KPP"] || null,
    registered_date:  row["Tanggal Daftar"] || null,
    status:           row["Status"] === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    notes:            row["Catatan"] || null,
    // Badan-only
    oss_username:     row["Username OSS"] || null,
    oss_password:     row["Password OSS"] || null,
    accurate_email:   row["Email Accurate"] || null,
    accurate_password:row["Password Accurate"] || null,
    bpjs_kes_number:  row["No BPJS Kes"] || null,
    bpjs_kes_password:row["Password BPJS"] || null,
  });

  const allRows = [
    ...rowsOP.map((r, i)    => ({ row: i + 2, data: mapRow(r, "ORANG_PRIBADI") })),
    ...rowsBadan.map((r, i) => ({ row: i + 2, data: mapRow(r, "BADAN") })),
  ];

  return runInTransaction(async (transaction) => {
    for (const { row, data } of allRows) {
      if (!data.name) {
        result.failed += 1;
        result.errors.push({ row, reason: "Nama klien wajib diisi" });
        continue;
      }

      try {
        await createClientProfile(data, actor, transaction);
        result.success += 1;
      } catch (e) {
        result.failed += 1;
        // 409 = duplicate name (already imported) — treat as informational, not error
        if (e.statusCode === 409) {
          result.errors.push({ row, reason: `Duplikat: ${data.name}` });
        } else {
          result.errors.push({ row, reason: e.message });
        }
      }
    }

    // Audit the import operation
    await logActivity({
      actionType: "IMPORTED_CLIENTS",
      actorId:    actor.id,
      targetType: "CLIENT",
      targetId:   0,
      metadata:   { success: result.success, failed: result.failed },
      legacy:     { recordType: "CLIENT", recordId: 0 },
      transaction,
    });

    return result;
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// FAMILY MEMBER — ADD
// FR-10, FR-19
// ─────────────────────────────────────────────────────────────────────────────

export const addFamilyMember = async (clientProfileId, body, actor) => {
  return runInTransaction(async (transaction) => {
    const profile = await ClientProfile.findByPk(clientProfileId, { transaction });
    if (!profile) {
      const e = new Error("Klien tidak ditemukan");
      e.statusCode = 404;
      throw e;
    }

    if (profile.client_type !== "ORANG_PRIBADI") {
      const e = new Error("Tanggungan hanya dapat ditambahkan pada klien Orang Pribadi");
      e.statusCode = 400;
      throw e;
    }

    const member = await ClientFamilyMember.create({
      client_profile_id: clientProfileId,
      ...body,
    }, { transaction });

    await logActivity({
      actionType: "ADDED_FAMILY_MEMBER",
      actorId:    actor.id,
      targetType: "CLIENT",
      targetId:   clientProfileId,
      metadata:   { memberName: body.name, relationship: body.relationship },
      legacy:     { recordType: "CLIENT", recordId: clientProfileId },
      transaction,
    });

    return member;
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// FAMILY MEMBER — UPDATE
// FR-11, FR-19
// ─────────────────────────────────────────────────────────────────────────────

export const updateFamilyMember = async (clientProfileId, memberId, body, actor) => {
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
      actorId:    actor.id,
      targetType: "CLIENT",
      targetId:   clientProfileId,
      metadata:   { memberId, memberName: member.name },
      legacy:     { recordType: "CLIENT", recordId: clientProfileId },
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
      actorId:    actor.id,
      targetType: "CLIENT",
      targetId:   clientProfileId,
      metadata:   { memberId, memberName },
      legacy:     { recordType: "CLIENT", recordId: clientProfileId },
      transaction,
    });
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// CREDENTIAL — ADD
// ─────────────────────────────────────────────────────────────────────────────

export const addCredential = async (clientProfileId, body, actor) => {
  return runInTransaction(async (transaction) => {
    const profile = await ClientProfile.findByPk(clientProfileId, { transaction });
    if (!profile) {
      const e = new Error("Klien tidak ditemukan");
      e.statusCode = 404;
      throw e;
    }

    const credential = await ClientCredential.create({
      client_profile_id: clientProfileId,
      ...body,
    }, { transaction });

    await logActivity({
      actionType: "ADDED_CLIENT_CREDENTIAL",
      actorId:    actor.id,
      targetType: "CLIENT",
      targetId:   clientProfileId,
      metadata:   { label: body.label, field_type: body.field_type },
      legacy:     { recordType: "CLIENT", recordId: clientProfileId },
      transaction,
    });

    return credential;
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// CREDENTIAL — UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export const updateCredential = async (clientProfileId, credentialId, body, actor) => {
  return runInTransaction(async (transaction) => {
    const credential = await ClientCredential.findOne({
      where: { id: credentialId, client_profile_id: clientProfileId },
      transaction,
    });
    if (!credential) {
      const e = new Error("Kredensial tidak ditemukan");
      e.statusCode = 404;
      throw e;
    }

    await credential.update(body, { transaction });

    await logActivity({
      actionType: "UPDATED_CLIENT_CREDENTIAL",
      actorId:    actor.id,
      targetType: "CLIENT",
      targetId:   clientProfileId,
      metadata:   { credentialId, label: credential.label },
      legacy:     { recordType: "CLIENT", recordId: clientProfileId },
      transaction,
    });

    return credential;
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// CREDENTIAL — REMOVE
// ─────────────────────────────────────────────────────────────────────────────

export const removeCredential = async (clientProfileId, credentialId, actor) => {
  return runInTransaction(async (transaction) => {
    const credential = await ClientCredential.findOne({
      where: { id: credentialId, client_profile_id: clientProfileId },
      transaction,
    });
    if (!credential) {
      const e = new Error("Kredensial tidak ditemukan");
      e.statusCode = 404;
      throw e;
    }

    const label = credential.label;
    await credential.destroy({ transaction });

    await logActivity({
      actionType: "REMOVED_CLIENT_CREDENTIAL",
      actorId:    actor.id,
      targetType: "CLIENT",
      targetId:   clientProfileId,
      metadata:   { credentialId, label },
      legacy:     { recordType: "CLIENT", recordId: clientProfileId },
      transaction,
    });
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT PROFILE DELETE
// ─────────────────────────────────────────────────────────────────────────────

export const deleteClientProfile = async (clientId, actor) => {
  return runInTransaction(async (transaction) => {
    // Get client profile by id
    const clientProfile = await ClientProfile.findByPk(clientId, { transaction });
    if (!clientProfile) {
      const error = new Error("Klien tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    // Delete associated family members (cascade handled by DB, but just in case)
    // Delete associated credentials (cascade handled by DB)
    // Delete the client profile
    await clientProfile.destroy({ transaction });

    await logActivity({
      actionType: "DELETED_CLIENT_PROFILE",
      actorId: actor.id,
      targetType: "CLIENT",
      targetId: clientId,
      metadata: { clientName: clientProfile.name },
      legacy: { recordType: "CLIENT", recordId: clientId },
      transaction,
    });

    return { message: "Klien berhasil dihapus" };
  });
};
