# SOFTWARE DESIGN DOCUMENT (SDD) + PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Feature: Client Profile Management ("Data Klien")
### System: Catat Susun Lapor (CSL)
### Version: 1.0.0 | Date: June 2026

---

## TABLE OF CONTENTS

1. Executive Summary
2. Phase 1 — Repository Reconstruction
3. Phase 2 — Spreadsheet Analysis
4. Phase 3 — Gap Analysis
5. Phase 4 — Feature Discovery
6. Phase 5 — System Design
7. Phase 6 — Database Design
8. Phase 7 — API Specification
9. Phase 8 — Frontend Specification
10. Phase 9 — Implementation Plan
11. Phase 10 — AI Agent Implementation Package

---

# PHASE 1 — REPOSITORY RECONSTRUCTION

## 1.1 Architecture Overview

**System Name:** Catat Susun Lapor (CSL)  
**Company:** PT Catat Susun Lapor  
**Architecture Pattern:** Monolithic Fullstack — REST API + WebSocket  
**Stack:**
- Backend: Node.js (ESM), Express 5, Sequelize 6, MySQL, Socket.IO 4, Zod, Pino, bcrypt, multer, xlsx
- Frontend: React 19, Vite 8, TailwindCSS 4, Axios, TanStack Query 5, Framer Motion, Socket.IO-client, react-dropzone
- Auth: JWT (Bearer token stored in sessionStorage), HTTP-only Cookie fallback, cookie-parser

## 1.2 Repository Structure

```
backend/
├── config/          database.js, env.js (Zod-validated)
├── constants/       destructiveActions.js, roles.js, taskStatus.js, todoStatus.js
├── controllers/     authController, taxController, todoController, historyController, healthController
├── middleware/      authCheck.js, roleCheck.js, uploadWorkbook.js, validateRequest.js
├── models/          Client.js, HistoryLog.js, index.js, TaskAssignment.js, TaxTrack.js, ToDo.js, User.js
├── routes/          authRoutes, taxRoutes, todoRoutes, historyRoutes, healthRoutes
├── scripts/         seed-admin.js
├── services/        activityService, authService, bootstrapService, clientService, socketEventBus, taxService, taxWorkbookParser, todoService
├── utils/           cookieAuth, logger, normalize, transactionHelper
├── validators/      authSchemas, taxSchemas, todoSchemas
└── server.js

frontend/src/
├── components/
│   ├── HistoryLogViewer.jsx
│   ├── ToDoList.jsx
│   └── Tax/  MasterWorkbookUploader.jsx, TaxListView.jsx, TaxMatrixView.jsx, TaxTracker.jsx
├── constants/       destructiveActions, roles, taskStatus
├── context/         AuthContext.jsx
├── pages/           Dashboard.jsx, Login.jsx
├── services/        api.js (axios), socket.js (socket.io-client)
└── utils/           storage.js (sessionStorage)
```

## 1.3 Database Map (Current)

| Table | Key Fields | Notes |
|---|---|---|
| `users` | id, name, email, password, role (Admin/Staff) | JWT auth source |
| `clients` | id, name, normalizedName, taxIdNumber, status (ACTIVE/INACTIVE) | Very minimal — only name + NPWP |
| `tax_tracks` | id, clientId, clientName, taxType, period, amount, status, pic_id | Core tax tracking |
| `todos` | id, clientName, jobType, description, startDate, deadline, status, pic_id | Task management |
| `history_logs` | id, actionType, actorId, targetType, targetId, recordType, recordId, oldStatus, newStatus, metadata | Audit trail |
| `task_assignments` | id, targetType, targetId, fromUserId, toUserId, assignedById, reason | Assignment history |

## 1.4 Current Client Model Analysis

```javascript
// CURRENT Client.js — Severely underspecced
{
  name: STRING,           // display name
  normalizedName: STRING, // unique key for deduplication
  taxIdNumber: STRING,    // NPWP — only tax field stored
  status: ENUM(ACTIVE, INACTIVE)
}
```

**The current Client model was designed purely as a deduplication anchor for TaxTrack records. It is NOT a client profile management system.**

## 1.5 Roles & Permissions (Current)

| Role | Capabilities |
|---|---|
| Admin | Full CRUD, assign tasks, approve, reset data, register staff, view all |
| Staff | View own tasks, update status on own tasks, view history |

## 1.6 WebSocket Events (Current)

| Event | Direction | Description |
|---|---|---|
| `TAX_UPDATED` | Server→Client | Emitted when tax status/assignment changes |
| `TODO_UPDATED` | Server→Client | Emitted when todo status/assignment changes |
| `join_private_room` | Client→Server | User joins their personal room |

## 1.7 Current Capabilities

- Upload tax workbook (Excel) → preview → confirm import (bulk upsert into TaxTrack)
- Manual single tax task creation (Admin only)
- Status update with state machine validation
- Task assignment (per tax, per client bulk)
- Todo list with deadline + assignment
- Full audit log (HistoryLog)
- Admin panel: register new staff users
- Prometheus metrics endpoint (Admin only)
- Rate limiting, Sentry error tracking, Pino logging

## 1.8 Current Limitations Relevant to Feature

1. `Client` record only stores name + NPWP. No credentials, contacts, addresses, entity type.
2. No client-facing form UI for creating/editing clients.
3. No dedicated "Client Management" tab in Dashboard.
4. No search/filter/export for clients.
5. No versioning or history of credential changes.
6. No differentiation between Individual (OP) and Corporate (Badan) clients.
7. No backup/export to Excel for client data.

---

# PHASE 2 — SPREADSHEET ANALYSIS

## 2.1 Spreadsheet Purpose

Two sheets were identified:

### Sheet 1: "EFIN OP" (Orang Pribadi — Individual Taxpayers)

This sheet stores credential and profile data for **individual (personal) taxpayers** managed by CSL.

### Sheet 2: Corporate/Entity Clients (Wajib Pajak Badan)

This sheet stores credential data for **corporate clients** (PT, CV, etc.) managed by CSL.

### Screenshots 3–6: DJP Online — Ikhtisar Profil Wajib Pajak

These are screenshots from the DJP (Direktorat Jenderal Pajak) Online portal showing what a full taxpayer profile looks like, which must be stored in the system.

## 2.2 Column-by-Column Analysis

### Sheet 1: EFIN OP — Individual Taxpayers

| Column | Business Name | Data Type | Business Meaning |
|---|---|---|---|
| A | NAME (Nama) | String | Full name of the taxpayer |
| B | (Unnamed/Group) | String | Client group or company name associated with individual (e.g., INTERCON, TERMINAL, DIPA) |
| C | NPWP | String (15-16 digit) | Nomor Pokok Wajib Pajak — primary tax ID |
| D | NIK | String (16 digit) | Nomor Induk Kependudukan — national ID, used in new NPWP 16-digit format |
| E | PASSWORD DJP | String | Login password for DJP Online portal |
| F | PASSWORD CORETAX | String | Login password for the Coretax system (new tax submission system) |
| G | PASSPHRASE | String | Signing passphrase for digital signature certificate |
| H | EMAIL | String | Primary email linked to DJP/Coretax account |
| I | PASSWORD EMAIL | String | Password for the primary email account |
| J | EFIN | String (10 digit) | Electronic Filing Identification Number for e-Filing |
| K | HP | String | Mobile phone number |
| L | EMAIL2 | String | Secondary/backup email |
| M | PASSWORD EMAIL2 | String | Password for secondary email |
| N | ALAMAT | String | Client address |
| O | PIN | String | PIN for certain DJP transactions |

### Sheet 2: Corporate/Badan Clients

| Column | Business Name | Data Type | Business Meaning |
|---|---|---|---|
| A | NPWP 16 DIGIT | String | New 16-digit NPWP (Coretax format) |
| B | PASSWORD DJP | String | DJP Online password |
| C | PASSWORD CORETAX | String | Coretax system password |
| D | EMAIL | String | Primary email |
| E | PASSWORD EMAIL | String | Email password |
| F | EFIN | String | EFIN number |
| G | HP | String | Phone number |
| H | EMAIL2 | String | Secondary email |
| I | PASSWORD EMAIL2 | String | Secondary email password |
| J | OSS | String | Username/ID for OSS (Online Single Submission — business licensing portal) |
| K | PASSWORD OSS | String | OSS password |
| L | EMAIL ACCURATE | String | Email for Accurate accounting software |
| M | PASSWORD ACCURATE | String | Password for Accurate accounting software |
| N | BPJS KES | String | BPJS Kesehatan membership number |
| O | PASSWORD BPJS | String | BPJS password |
| P | ALAMAT | String | Company address |

### DJP Profile (Ikhtisar Profil Wajib Pajak) — Additional Profile Fields

From screenshots 3–6, the DJP profile page shows these fields that must also be tracked:

| Field | Business Name | Notes |
|---|---|---|
| Nama | Full name | Already in sheet |
| NPWP | Tax ID | Already in sheet |
| Kegiatan Utama | Main business activity description | KLU description |
| Jenis Wajib Pajak | Taxpayer type | e.g., Orang Pribadi atau Warisan Belum Terbagi |
| Kategori Wajib Pajak | Taxpayer category | e.g., Orang Pribadi |
| Status NPWP | NPWP status | Aktif/Non-Aktif |
| Tanggal Terdaftar | Registration date | Date NPWP was first registered |
| Tanggal Aktivasi | Activation date | |
| Status Pengusaha Kena Pajak | PKP status | Whether registered as VAT collector |
| Kantor Wilayah DJP | DJP regional office | e.g., "Kantor Wilayah DJP Banten" |
| Kantor Pelayanan Pajak | Local KPP | e.g., "KPP Pratama Tigaraksa" |
| Seksi Pengawasan | Supervision section | |
| Kode KLU | Business classification code | e.g., 47599 |
| Deskripsi KLU | Business classification description | |
| Alamat Utama | Primary address | Full address from DJP |
| Nomor Handphone | Phone | Same as HP in sheet |
| Email | Email | Same as EMAIL in sheet |
| Tanggungan (Family Members) | Family members | NIK, NPWP, Nama, Tanggal Lahir, Status (Suami/Istri/Tanggungan), Pekerjaan, PTKP status |

## 2.3 Inferred Business Rules

1. **Client Types:** Two distinct types — `ORANG_PRIBADI` (Individual, "OP") and `BADAN` (Corporate). They share some fields but each has unique fields.
2. **Credentials change annually:** Passwords, passphrases, and email credentials are updated yearly. The system must allow easy editing.
3. **Credentials are sensitive:** The system stores passwords for DJP, Coretax, email accounts, OSS, BPJS — these are essentially a vault of client credentials. Security is critical.
4. **Backup is required:** Users want to export client data to Excel for offline backup.
5. **Multiple system credentials per client:** Each client uses multiple government/third-party portals. A single client may have 8–15 credential fields.
6. **NPWP links to TaxTrack:** The existing `clients.taxIdNumber` must be kept in sync with the new NPWP field.
7. **Family members (tanggungan):** Individual clients may have spouse/dependent data stored (for PPh 21/PTKP calculations).
8. **Group/affiliation:** Some individuals are associated with a company name (e.g., "INTERCON", "BIRU"). This is the `group` or `company_affiliation` field.
9. **Quick-change credentials:** UI must make it easy to update individual credential fields without filling the entire form.
10. **Search by name/NPWP:** The user needs to quickly look up clients.

## 2.4 Assumptions (Clearly Separated)

- **ASSUMPTION A:** The `group` column in Sheet 1 (INTERCON, TERMINAL, etc.) represents an affiliation or employer — not a separate entity. Some individuals belong to a corporate group.
- **ASSUMPTION B:** Passwords stored in plain text in the Excel. In the database, these will be stored as-is (not hashed) because they need to be **retrieved and displayed** to staff. This is a credential vault, not an auth system. Security mitigation: field-level encryption at rest (recommended) or at minimum, role-based access control.
- **ASSUMPTION C:** The `BPJS KES` and `BPJS TK` (Ketenagakerjaan) fields in sheet 2 suggest corporate clients also need BPJS tracking, but only BPJS KES appears in the screenshot. BPJS TK is assumed to exist and a `notes` field can capture it.
- **ASSUMPTION D:** "Accurate" is the accounting software (Accurate Online by CPSSoft) commonly used by Indonesian SMEs.
- **ASSUMPTION E:** The "kode billing" / billing code and "saldo" mentioned in the DJP profile tabs (Daftar Kode Billing Belum Dibayar, Saldo Saat Ini) are not part of this feature scope — those are live DJP data queries, not stored profile data.

---

# PHASE 3 — GAP ANALYSIS

## 3.1 What Already Exists

| Item | Current State |
|---|---|
| `Client` model | Exists — only name, normalizedName, taxIdNumber, status |
| `clientService.findOrCreateClientByName` | Exists — used by TaxTrack import |
| `GET /api/tax/clients` | Exists — returns client list with tax overview |
| `HistoryLog` with `targetType: CLIENT` | ENUM already includes "CLIENT" — ready to use |
| Auth middleware (verifyToken, requireAdmin) | Exists — can be reused |
| Zod validation pattern | Exists — reuse for new schemas |
| Export logic (xlsx library) | Exists in backend package.json |
| Dashboard tab system | Exists — add new tab |
| TanStack Query pattern | Exists in frontend — reuse for data fetching |

## 3.2 What Must Be Extended

| Item | Required Extension |
|---|---|
| `Client` model | Add ~30 new fields across two client types |
| `clientService` | Add CRUD operations, search, export |
| `taxRoutes / taxSchemas` | `GET /api/tax/clients` needs enhancement or move |
| `HistoryLog` | Already has `CLIENT` targetType — just use it |
| `Dashboard.jsx` | Add new "Klien" tab |
| `server.js` | Register new `clientRoutes` |
| `models/index.js` | No new associations needed |

## 3.3 What Must Be Created

| Item | Description |
|---|---|
| `ClientProfile` model (or extend `Client`) | New Sequelize model with all profile fields |
| `ClientFamilyMember` model | For individual client dependents/tanggungan |
| `clientRoutes.js` | New Express router |
| `clientController.js` | New controller |
| `clientService.js` (extended) | Add listClients, getClient, createClient, updateClient, deleteClient, exportClients |
| `clientSchemas.js` (validators) | Zod schemas for client CRUD |
| `components/Client/ClientManager.jsx` | Main client management UI component |
| `components/Client/ClientForm.jsx` | Create/Edit form |
| `components/Client/ClientDetailModal.jsx` | View all details of a client |
| `components/Client/ClientList.jsx` | Searchable/filterable table |

## 3.4 Affected Modules

| Module | Impact |
|---|---|
| `backend/models/Client.js` | Major extension of fields |
| `backend/models/index.js` | Add ClientFamilyMember model and associations |
| `backend/services/clientService.js` | Full rewrite + CRUD |
| `backend/controllers/` | New clientController.js |
| `backend/routes/` | New clientRoutes.js |
| `backend/server.js` | Register clientRoutes |
| `backend/validators/` | New clientSchemas.js |
| `frontend/src/pages/Dashboard.jsx` | Add new tab |
| `frontend/src/components/Client/` | New directory with 4+ components |
| `frontend/src/services/api.js` | No changes needed |

---

# PHASE 4 — FEATURE DISCOVERY

## 4.1 Core Feature Set

1. **Client Registry:** A searchable, paginated list of all clients (individuals + corporates)
2. **Client Profile Form:** Create and edit full client profiles with all credentials
3. **Client Detail View:** View-only modal/panel showing all fields for a selected client
4. **Client Type Segregation:** Separate views/forms for OP (Orang Pribadi) and Badan (Corporate)
5. **Family Members (Tanggungan):** Sub-table per individual client for spouse/dependents
6. **Export to Excel:** Export all clients (or filtered set) to .xlsx for backup
7. **Audit Trail:** All create/update/delete actions on client records logged to HistoryLog
8. **Search & Filter:** Search by name, NPWP/NIK, client type, status
9. **Quick-Edit Credentials:** Inline editing of credential fields without full form re-submission
10. **Soft Delete / Deactivate:** Deactivate (INACTIVE) clients rather than hard delete, to preserve TaxTrack references

## 4.2 Production-Grade Features (Recommended)

11. **Credential Visibility Toggle:** Show/hide sensitive fields (passwords) per field with eye icon
12. **Last Modified Tracking:** Track which staff member last updated each client, and when
13. **Import from Excel:** Bulk import clients from the existing Excel sheet (reverse of export)
14. **Client Search Typeahead:** Autocomplete search for client names when creating tax tasks
15. **Active/Inactive Badge:** Clear visual status on client cards
16. **Notes Field:** Free-text notes per client for operational context

## 4.3 Out of Scope (This Version)

- Real-time DJP data query (kode billing, saldo) — requires DJP API access
- Password encryption at rest (noted as a future security hardening step)
- SMS/Email notification on credential change
- Client portal (clients viewing their own data)

---

# PHASE 5 — SYSTEM DESIGN

## 5.1 Feature Overview

**Feature Name:** Manajemen Data Klien (Client Profile Management)  
**Short Name:** "Data Klien"  
**Goal:** Replace the manual Excel spreadsheet used to store client credentials and profile data with a secure, searchable, exportable database-backed system integrated into the existing CSL dashboard.

## 5.2 Business Objectives

1. Eliminate the risk of losing client credential data stored only in local Excel files.
2. Enable quick lookup of any client's credentials during tax filing operations.
3. Allow easy updating of credentials that change annually (passwords, passphrase, EFIN).
4. Provide a backup mechanism (Export to Excel) for business continuity.
5. Integrate with the existing client linking system (TaxTrack already links to Client records).

## 5.3 User Roles

| Role | Access Level |
|---|---|
| Admin | Full CRUD, export, import, delete/deactivate, view all sensitive fields |
| Staff | Read-only on all client profiles; can see credentials |

> **Design Decision:** Both Admin and Staff can view credentials because staff need them operationally (e.g., to log into DJP on behalf of a client). Admin controls who is staff. Hiding credentials from staff would break the operational workflow.

## 5.4 Permissions Matrix

| Action | Admin | Staff |
|---|---|---|
| List all clients | ✅ | ✅ |
| View client profile (all fields) | ✅ | ✅ |
| Create new client | ✅ | ❌ |
| Edit client profile | ✅ | ❌ |
| Edit credentials only | ✅ | ❌ |
| Deactivate client | ✅ | ❌ |
| Reactivate client | ✅ | ❌ |
| Delete client (hard) | ❌ (never — soft delete only) | ❌ |
| Export to Excel | ✅ | ✅ |
| Import from Excel | ✅ | ❌ |
| Add family member | ✅ | ❌ |
| Edit family member | ✅ | ❌ |
| Delete family member | ✅ | ❌ |
| View audit history per client | ✅ | ✅ |

## 5.5 User Flow

```
[Dashboard]
    → Click "Data Klien" tab
        → [ClientManager]
            → Search / Filter bar (name, NPWP, type, status)
            → Client list (paginated cards/table)
            → [Admin] "Tambah Klien" button → [ClientForm Modal]
                → Select type: Orang Pribadi | Badan
                → Fill form sections:
                    A. Data Pokok (NPWP, NIK, nama, alamat, group)
                    B. DJP Profile (KPP, KLU, status PKP, tanggal daftar)
                    C. Kredensial DJP (password DJP, Coretax, EFIN, PIN)
                    D. Kredensial Email (email1, password1, email2, password2)
                    E. [OP only] Telepon (HP)
                    F. [Badan only] OSS, Accurate, BPJS credentials
                → Save → success toast → list refreshes
            → Click client row → [ClientDetailModal]
                → Shows all fields in organized sections
                → Toggle show/hide passwords per field
                → [Admin] Edit button → [ClientForm] pre-filled
                → [Admin] Deactivate button
                → [OP] Family Members sub-table with add/edit/remove
                → "Lihat Audit" link → filtered HistoryLog for this client
            → "Export Excel" button → download .xlsx file
```

## 5.6 State Flow (Client)

```
[CREATE] → ACTIVE
ACTIVE → [Admin deactivate] → INACTIVE
INACTIVE → [Admin reactivate] → ACTIVE
```

Note: No hard delete. Deactivated clients still appear in TaxTrack history.

## 5.7 Process Flow

```
Admin creates client:
1. Frontend submits POST /api/clients
2. Middleware: verifyToken → requireAdmin → validateRequest(createClientSchema)
3. Controller: calls clientService.createClient(body, actor)
4. Service: 
   a. Check normalizedName uniqueness
   b. Sequelize transaction:
      - Create ClientProfile record
      - logActivity(CREATED_CLIENT)
   c. Return created record
5. Controller: 201 response
6. Frontend: invalidate query, show success toast

Admin updates credentials:
1. Frontend submits PUT /api/clients/:id
2. Same middleware chain
3. Service:
   a. Find existing record (with lock)
   b. Compare changed fields → build metadata diff
   c. Update record
   d. logActivity(UPDATED_CLIENT, metadata: { changedFields: [...] })
4. Return updated record

Staff exports:
1. Frontend requests GET /api/clients/export?type=OP&status=ACTIVE
2. Middleware: verifyToken (no requireAdmin — both roles can export)
3. Service: fetch all matching records, build xlsx buffer
4. Response: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet stream
```

## 5.8 Data Flow

```
Frontend ClientForm
    → POST/PUT /api/clients
    → validateRequest (Zod)
    → clientController
    → clientService
    → Sequelize transaction
    → MySQL (client_profiles table, client_family_members table)
    → logActivity → history_logs table
    → HTTP 200/201 response
    → Frontend query invalidation
    → ClientList re-renders

Export Flow:
Frontend "Export" button
    → GET /api/clients/export
    → clientService.exportClients()
    → xlsx.utils.aoa_to_sheet / xlsx.utils.json_to_sheet
    → xlsx.write(wb, { type: 'buffer' })
    → res.send(buffer) with Content-Disposition header
    → Browser downloads file
```

## 5.9 API Design (Summary — see Phase 7 for full spec)

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | /api/clients | Admin+Staff | List clients (paginated, filtered) |
| POST | /api/clients | Admin | Create client |
| GET | /api/clients/:id | Admin+Staff | Get single client full profile |
| PUT | /api/clients/:id | Admin | Update client profile |
| PATCH | /api/clients/:id/status | Admin | Activate/deactivate |
| GET | /api/clients/export | Admin+Staff | Export to Excel |
| POST | /api/clients/import | Admin | Bulk import from Excel |
| GET | /api/clients/:id/family | Admin+Staff | List family members |
| POST | /api/clients/:id/family | Admin | Add family member |
| PUT | /api/clients/:id/family/:memberId | Admin | Edit family member |
| DELETE | /api/clients/:id/family/:memberId | Admin | Remove family member |

## 5.10 Frontend Design (Summary — see Phase 8 for full spec)

New files: `components/Client/ClientManager.jsx`, `ClientList.jsx`, `ClientForm.jsx`, `ClientDetailModal.jsx`, `ClientFamilyTable.jsx`  
New Dashboard tab: `{ id: "CLIENTS", label: "Data Klien", icon: Users2 }`

## 5.11 Backend Design

New files: `routes/clientRoutes.js`, `controllers/clientController.js`, `validators/clientSchemas.js`  
Extended: `models/Client.js` → replaced by `models/ClientProfile.js` (new model name to avoid conflict with existing `Client` used by TaxTrack), `services/clientService.js`  
New: `models/ClientFamilyMember.js`

## 5.12 Security Requirements

1. All routes require `verifyToken`
2. Write operations (POST, PUT, PATCH, DELETE) require `requireAdmin`
3. Export endpoint: accessible to all authenticated users (Admin + Staff)
4. Credentials fields (passwords, passphrase, PIN, EFIN): returned in API response only over HTTPS
5. Pagination enforced (max 100 per page) to prevent bulk data scraping
6. Rate limiting: apply standard global rate limiter already configured
7. Input sanitization: Zod strict schemas strip unknown fields
8. Sensitive fields included in export: this is intentional (backup use case) — document this clearly

## 5.13 Performance Requirements

1. Client list query: target < 100ms for up to 5,000 clients (with indexes)
2. Export: target < 5s for up to 5,000 clients (stream buffer)
3. Search: full-text search on `name` and `npwp` fields with database index
4. Pagination: default limit 20, max 100

## 5.14 WebSocket Requirements

**No real-time WebSocket events needed for this feature.** Client profile data changes do not require real-time push. The existing query invalidation pattern (TanStack Query) is sufficient after write operations.

> If in the future multiple Admin users are concurrently editing client data, a `CLIENT_UPDATED` socket event can be added following the same `socketEventBus` pattern.

## 5.15 Notification Requirements

**Phase 1:** None — no email/SMS notifications required for client profile operations.  
**Future:** Consider notifying Admin when credentials are exported (security audit trail).

## 5.16 Audit Logging Requirements

Every write operation on a client record MUST be logged to `history_logs` with:
- `targetType: "CLIENT"`
- `targetId: clientProfile.id`
- `actionType`: one of `CREATED_CLIENT`, `UPDATED_CLIENT`, `DEACTIVATED_CLIENT`, `REACTIVATED_CLIENT`, `ADDED_FAMILY_MEMBER`, `UPDATED_FAMILY_MEMBER`, `REMOVED_FAMILY_MEMBER`, `EXPORTED_CLIENTS`, `IMPORTED_CLIENTS`
- `metadata`: diff object showing which fields changed (for UPDATE), or summary (for EXPORT/IMPORT)
- `actorId`: the Admin performing the action

For `UPDATED_CLIENT`, metadata must include `changedFields` array with field names but NOT the old/new credential values (passwords should not be stored in audit logs).

## 5.17 Reporting Requirements

**Export to Excel format:**

Sheet 1: "Orang Pribadi" — all OP clients with all their fields  
Sheet 2: "Badan" — all corporate clients with all their fields  
Sheet 3: "Tanggungan" — all family members linked to OP clients  

File naming: `Data_Klien_CSL_YYYYMMDD_HHmmss.xlsx`

---

# PHASE 6 — DATABASE DESIGN

## 6.1 Design Decision: Extend vs. Replace `clients` Table

**Decision: Create a new `client_profiles` table that has a 1:1 optional relationship with the existing `clients` table.**

**Rationale:**
- The existing `clients` table is referenced by `tax_tracks.clientId` — a foreign key. Changing this table schema risks breaking TaxTrack functionality.
- The existing `clientService.findOrCreateClientByName` must continue to work unchanged.
- A new `client_profiles` table allows rich profile data without touching TaxTrack's existing FK relationship.
- A `clientId` FK in `client_profiles` links back to `clients` for bi-directional association.
- This is a clean extension: `clients` remains the "thin identity" record, `client_profiles` is the "rich profile" record.

## 6.2 New Table: `client_profiles`

```sql
CREATE TABLE client_profiles (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  
  -- Link to existing clients table (optional: OP clients may not yet have TaxTrack records)
  client_id        INT NULL,
  
  -- === IDENTITY ===
  client_type      ENUM('ORANG_PRIBADI', 'BADAN') NOT NULL,
  name             VARCHAR(255) NOT NULL,           -- Full display name
  normalized_name  VARCHAR(255) NOT NULL,           -- Lowercased, normalized for dedup
  
  -- === TAX IDENTITY ===
  npwp_15          VARCHAR(20) NULL,                -- Old 15-digit NPWP (e.g., 67.273.675.8-044.000)
  npwp_16          VARCHAR(20) NULL,                -- New 16-digit NPWP (Coretax format)
  nik              VARCHAR(20) NULL,                -- NIK (national ID, 16 digits) — OP only
  efin             VARCHAR(20) NULL,                -- EFIN (10 digits)
  
  -- === DJP PROFILE (from Ikhtisar Profil) ===
  taxpayer_type    VARCHAR(100) NULL,               -- e.g. "Orang Pribadi atau Warisan Belum Terbagi"
  taxpayer_category VARCHAR(100) NULL,              -- e.g. "Orang Pribadi"
  npwp_status      ENUM('AKTIF', 'NON_AKTIF', 'HAPUS') NULL DEFAULT 'AKTIF',
  registered_date  DATE NULL,                       -- Tanggal Terdaftar
  activation_date  DATE NULL,                       -- Tanggal Aktivasi
  pkp_status       TINYINT(1) NOT NULL DEFAULT 0,  -- Is Pengusaha Kena Pajak (PKP)?
  pkp_date         DATE NULL,                       -- Tanggal Pengukuhan PKP
  klu_code         VARCHAR(10) NULL,                -- KLU code (e.g. 47599)
  klu_description  TEXT NULL,                       -- KLU description (business activity)
  kanwil           VARCHAR(255) NULL,               -- Kantor Wilayah DJP
  kpp              VARCHAR(255) NULL,               -- Kantor Pelayanan Pajak
  supervision_section VARCHAR(100) NULL,            -- Seksi Pengawasan
  
  -- === CONTACT ===
  phone            VARCHAR(30) NULL,                -- HP / Mobile phone
  address          TEXT NULL,                       -- Alamat Utama
  group_affiliation VARCHAR(255) NULL,              -- Company/group the individual belongs to (OP only)
  
  -- === CREDENTIALS: DJP ===
  djp_password     VARCHAR(255) NULL,               -- Password DJP Online
  coretax_password VARCHAR(255) NULL,               -- Password Coretax
  passphrase       VARCHAR(255) NULL,               -- Digital signature passphrase
  pin_djp          VARCHAR(20) NULL,                -- PIN for DJP transactions
  
  -- === CREDENTIALS: EMAIL PRIMARY ===
  email1           VARCHAR(255) NULL,               -- Primary email linked to DJP
  email1_password  VARCHAR(255) NULL,               -- Password for primary email
  
  -- === CREDENTIALS: EMAIL SECONDARY ===
  email2           VARCHAR(255) NULL,               -- Secondary/backup email
  email2_password  VARCHAR(255) NULL,               -- Password for secondary email
  
  -- === CREDENTIALS: OSS (Badan only) ===
  oss_username     VARCHAR(255) NULL,               -- OSS username/ID
  oss_password     VARCHAR(255) NULL,               -- OSS password
  
  -- === CREDENTIALS: ACCURATE (Badan only) ===
  accurate_email   VARCHAR(255) NULL,               -- Accurate Online email
  accurate_password VARCHAR(255) NULL,              -- Accurate Online password
  
  -- === CREDENTIALS: BPJS (Badan only) ===
  bpjs_kes_number  VARCHAR(50) NULL,                -- BPJS Kesehatan membership number
  bpjs_kes_password VARCHAR(255) NULL,              -- BPJS Kesehatan password
  
  -- === STATUS & NOTES ===
  status           ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  notes            TEXT NULL,                       -- Free-text operational notes
  
  -- === METADATA ===
  created_by       INT NULL,                        -- FK to users.id — who created this profile
  updated_by       INT NULL,                        -- FK to users.id — who last updated
  version          INT NOT NULL DEFAULT 0,          -- Optimistic locking (Sequelize version)
  createdAt        DATETIME NOT NULL,
  updatedAt        DATETIME NOT NULL,
  
  -- === CONSTRAINTS ===
  UNIQUE KEY uq_normalized_name (normalized_name),
  KEY idx_client_id (client_id),
  KEY idx_client_type (client_type),
  KEY idx_status (status),
  KEY idx_npwp_15 (npwp_15),
  KEY idx_npwp_16 (npwp_16),
  KEY idx_nik (nik),
  KEY idx_name (name),
  KEY idx_created_by (created_by),
  KEY idx_updated_by (updated_by),
  
  CONSTRAINT fk_cp_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_cp_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_cp_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
```

## 6.3 New Table: `client_family_members`

```sql
CREATE TABLE client_family_members (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  client_profile_id    INT NOT NULL,
  
  nik                  VARCHAR(20) NULL,            -- NIK of family member
  npwp                 VARCHAR(20) NULL,            -- NPWP of family member (if any)
  name                 VARCHAR(255) NOT NULL,       -- Full name
  birth_date           DATE NULL,                   -- Tanggal Lahir
  relationship         ENUM('SUAMI', 'ISTRI', 'ANAK', 'TANGGUNGAN_LAIN') NOT NULL,
  occupation           VARCHAR(255) NULL,           -- Pekerjaan
  ptkp_status          VARCHAR(50) NULL,            -- e.g. "Kepala Unit Keluarga", "Tanggungan"
  notes                TEXT NULL,
  
  createdAt            DATETIME NOT NULL,
  updatedAt            DATETIME NOT NULL,
  
  KEY idx_cfm_client_profile (client_profile_id),
  
  CONSTRAINT fk_cfm_profile FOREIGN KEY (client_profile_id) REFERENCES client_profiles(id) ON DELETE CASCADE
);
```

## 6.4 Modified Table: `clients` (no schema change, only new association)

The `clients` table schema is **NOT changed**. A new association is added at the application level:

```javascript
// In models/index.js — new association:
ClientProfile.belongsTo(Client, { foreignKey: 'client_id' });
Client.hasOne(ClientProfile, { foreignKey: 'client_id' });
```

This allows bi-directional navigation while keeping TaxTrack's FK to `clients.id` completely unaffected.

## 6.5 Field-by-Field Specification

### client_profiles

| Field | Type | Nullable | Validation | Purpose |
|---|---|---|---|---|
| id | INT PK AUTO | No | — | Primary key |
| client_id | INT FK | Yes | Must exist in clients table if set | Links to existing thin client record |
| client_type | ENUM | No | 'ORANG_PRIBADI' or 'BADAN' | Determines which fields apply |
| name | VARCHAR(255) | No | min 1, max 255 | Display name of taxpayer |
| normalized_name | VARCHAR(255) | No | UNIQUE, auto-computed from name | Deduplication key |
| npwp_15 | VARCHAR(20) | Yes | Pattern: 15 digits with optional separators | Old NPWP format |
| npwp_16 | VARCHAR(20) | Yes | Pattern: 16 digits | New Coretax NPWP |
| nik | VARCHAR(20) | Yes | 16 digits — OP only | National ID |
| efin | VARCHAR(20) | Yes | 10 digits | Electronic filing ID |
| npwp_status | ENUM | Yes | AKTIF/NON_AKTIF/HAPUS | DJP-reported status |
| registered_date | DATE | Yes | Valid date | NPWP registration date |
| activation_date | DATE | Yes | Valid date | NPWP activation date |
| pkp_status | BOOL | No | Default false | PKP registration status |
| pkp_date | DATE | Yes | Valid date | PKP registration date |
| klu_code | VARCHAR(10) | Yes | Max 10 chars | KLU business code |
| klu_description | TEXT | Yes | max 500 chars | KLU description |
| kanwil | VARCHAR(255) | Yes | max 255 | DJP regional office name |
| kpp | VARCHAR(255) | Yes | max 255 | Local tax office |
| supervision_section | VARCHAR(100) | Yes | max 100 | Supervision section name |
| phone | VARCHAR(30) | Yes | max 30 chars | Mobile number |
| address | TEXT | Yes | max 1000 chars | Full address |
| group_affiliation | VARCHAR(255) | Yes | max 255, OP only | Company/group association |
| djp_password | VARCHAR(255) | Yes | max 255 | DJP Online login password |
| coretax_password | VARCHAR(255) | Yes | max 255 | Coretax login password |
| passphrase | VARCHAR(255) | Yes | max 255 | Digital signature passphrase |
| pin_djp | VARCHAR(20) | Yes | max 20 | DJP PIN |
| email1 | VARCHAR(255) | Yes | valid email format | Primary email |
| email1_password | VARCHAR(255) | Yes | max 255 | Primary email password |
| email2 | VARCHAR(255) | Yes | valid email format | Secondary email |
| email2_password | VARCHAR(255) | Yes | max 255 | Secondary email password |
| oss_username | VARCHAR(255) | Yes | max 255, Badan only | OSS username |
| oss_password | VARCHAR(255) | Yes | max 255, Badan only | OSS password |
| accurate_email | VARCHAR(255) | Yes | valid email, Badan only | Accurate Online email |
| accurate_password | VARCHAR(255) | Yes | max 255, Badan only | Accurate Online password |
| bpjs_kes_number | VARCHAR(50) | Yes | max 50, Badan only | BPJS Kes member ID |
| bpjs_kes_password | VARCHAR(255) | Yes | max 255, Badan only | BPJS Kes password |
| status | ENUM | No | ACTIVE/INACTIVE, default ACTIVE | Client record status |
| notes | TEXT | Yes | max 2000 chars | Operational notes |
| created_by | INT FK | Yes | references users.id | Creator user ID |
| updated_by | INT FK | Yes | references users.id | Last updater user ID |
| version | INT | No | Default 0 | Optimistic locking |

### client_family_members

| Field | Type | Nullable | Validation | Purpose |
|---|---|---|---|---|
| id | INT PK AUTO | No | — | Primary key |
| client_profile_id | INT FK | No | references client_profiles.id | Parent client |
| nik | VARCHAR(20) | Yes | 16 digits | Family member NIK |
| npwp | VARCHAR(20) | Yes | 15 or 16 digits | Family member NPWP |
| name | VARCHAR(255) | No | min 1, max 255 | Full name |
| birth_date | DATE | Yes | valid date | Date of birth |
| relationship | ENUM | No | SUAMI/ISTRI/ANAK/TANGGUNGAN_LAIN | Relationship to taxpayer |
| occupation | VARCHAR(255) | Yes | max 255 | Job/occupation |
| ptkp_status | VARCHAR(50) | Yes | max 50 | PTKP category label |
| notes | TEXT | Yes | max 500 | Additional notes |

## 6.6 Migration Strategy

**Phase A — Safe Addition (Zero Downtime):**

1. Create `client_profiles` table (no FK to `clients` required initially if `client_id` is nullable).
2. Create `client_family_members` table.
3. Add Sequelize model files for both tables.
4. Register associations in `models/index.js`.
5. Register new routes in `server.js`.

**No existing table is modified.** `sequelize.sync({ alter: true })` in development will add new tables automatically without touching `clients`, `tax_tracks`, or any other existing table.

**Phase B — Backfill (Optional):**

After phase A is deployed, run a one-time migration script that:
1. For each existing `Client` record, creates a corresponding `ClientProfile` with `name`, `npwp_15 = taxIdNumber`, `client_type = 'ORANG_PRIBADI'` (default), `client_id = client.id`.
2. This links existing thin client records to new profile records.

This backfill is a best-effort operation and does NOT block the feature deployment.

---

# PHASE 7 — API SPECIFICATION

## Base URL: `/api/clients`

All routes require `verifyToken` middleware.

---

### 7.1 GET /api/clients

**Purpose:** List all client profiles (paginated, filterable)  
**Auth:** Admin + Staff  
**Middleware:** `verifyToken` → `validateRequest(listClientsSchema)`

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| page | integer | No (default 1) | Page number |
| limit | integer | No (default 20, max 100) | Items per page |
| search | string | No | Search by name, NPWP 15, NPWP 16, NIK |
| client_type | string | No | 'ORANG_PRIBADI' or 'BADAN' |
| status | string | No | 'ACTIVE' or 'INACTIVE' |

**Response 200:**
```json
{
  "total": 142,
  "page": 1,
  "totalPages": 8,
  "data": [
    {
      "id": 1,
      "client_type": "ORANG_PRIBADI",
      "name": "JEFFIE",
      "npwp_15": "14.654.670.0-223.000",
      "npwp_16": null,
      "nik": "3210022305800011",
      "efin": "1131126798",
      "status": "ACTIVE",
      "phone": null,
      "email1": "jeffie_ku@yahoo.com",
      "kpp": null,
      "group_affiliation": "INTERCON",
      "createdAt": "2026-01-15T08:30:00.000Z",
      "updatedAt": "2026-06-01T10:00:00.000Z"
    }
  ]
}
```

Note: Sensitive credential fields (passwords, passphrase, PIN) are **included** in list response. This is intentional — staff need quick access. Pagination limits bulk extraction risk.

**Response 400:** `{ "error": "Validasi gagal: ..." }`  
**Response 401:** `{ "error": "Unauthorized" }`

---

### 7.2 POST /api/clients

**Purpose:** Create new client profile  
**Auth:** Admin only  
**Middleware:** `verifyToken` → `requireAdmin` → `validateRequest(createClientSchema)`

**Request Body:**
```json
{
  "client_type": "ORANG_PRIBADI",
  "name": "SOETRISNO",
  "npwp_15": "71.506.892.0-048.000",
  "npwp_16": "3172056202760001",
  "nik": "3172056202760001",
  "efin": "6681808471",
  "npwp_status": "AKTIF",
  "registered_date": "2020-12-09",
  "pkp_status": false,
  "klu_code": "47599",
  "klu_description": "PERDAGANGAN ECERAN PERALATAN...",
  "kanwil": "Kantor Wilayah DJP Banten",
  "kpp": "KPP Pratama Tigaraksa",
  "supervision_section": "Seksi Pengawasan III",
  "phone": "081219229371",
  "address": "CLUSTER LEONORA JL. LEONORA BARAT 3 NO. 8...",
  "group_affiliation": null,
  "djp_password": "djp123",
  "coretax_password": "PajakSoetrisno2025!",
  "passphrase": "PajakSoetrisno2025!",
  "pin_djp": null,
  "email1": "yaniar..@gmail.com",
  "email1_password": "djp123",
  "email2": null,
  "email2_password": null,
  "oss_username": null,
  "oss_password": null,
  "accurate_email": null,
  "accurate_password": null,
  "bpjs_kes_number": null,
  "bpjs_kes_password": null,
  "notes": null
}
```

**Validation Rules (Zod):**
- `client_type`: required, enum `['ORANG_PRIBADI', 'BADAN']`
- `name`: required, string, min 1, max 255
- `npwp_15`: optional, string, max 20
- `npwp_16`: optional, string, max 20
- `nik`: optional, string, max 20
- `efin`: optional, string, max 20
- All credential fields: optional strings max 255
- `email1`, `email2`, `accurate_email`: optional, email format if provided
- `registered_date`, `activation_date`, `pkp_date`: optional, ISO date string `YYYY-MM-DD`
- `pkp_status`: optional, boolean, default false
- `notes`: optional, string, max 2000
- Badan-only fields (`oss_*`, `accurate_*`, `bpjs_*`): accepted but stored only if `client_type = BADAN`
- OP-only fields (`nik`, `group_affiliation`): accepted but semantically only for OP

**Business Rules:**
- `normalized_name` is auto-computed from `name` using the existing `normalizeName()` utility
- If a `Client` record already exists with the same `normalizedName`, auto-link `client_id`
- If no existing `Client` record, do NOT auto-create one (the profile stands alone)

**Response 201:**
```json
{
  "message": "Profil klien berhasil dibuat",
  "data": { /* full ClientProfile object */ }
}
```

**Response 400:** Zod validation error  
**Response 409:** `{ "error": "Klien dengan nama ini sudah terdaftar" }` (normalizedName conflict)

---

### 7.3 GET /api/clients/:id

**Purpose:** Get full profile of a single client including family members  
**Auth:** Admin + Staff  
**Middleware:** `verifyToken` → `validateRequest({ params: { id: positiveInt } })`

**Response 200:**
```json
{
  "data": {
    "id": 4,
    "client_type": "ORANG_PRIBADI",
    "name": "SOETRISNO",
    "npwp_15": "71.506.892.0-048.000",
    "npwp_16": "3172056202760001",
    "nik": "3172056202760001",
    "efin": "6681808471",
    "djp_password": "djp123",
    "coretax_password": "PajakSoetrisno2025!",
    "passphrase": "PajakSoetrisno2025!",
    "email1": "yaniar@gmail.com",
    "email1_password": "djp123",
    "status": "ACTIVE",
    "createdAt": "2026-01-15T08:30:00Z",
    "updatedAt": "2026-06-01T10:00:00Z",
    "CreatedBy": { "id": 1, "name": "Administrator" },
    "UpdatedBy": { "id": 1, "name": "Administrator" },
    "FamilyMembers": [
      {
        "id": 1,
        "nik": "3603222111240019",
        "name": "MEICHEL FITRAJAYA",
        "birth_date": "1993-05-13",
        "relationship": "SUAMI",
        "occupation": "WIRASWASTA",
        "ptkp_status": "Kepala Unit Keluarga"
      }
    ]
  }
}
```

**Response 404:** `{ "error": "Klien tidak ditemukan" }`

---

### 7.4 PUT /api/clients/:id

**Purpose:** Update client profile  
**Auth:** Admin only  
**Middleware:** `verifyToken` → `requireAdmin` → `validateRequest(updateClientSchema)`

**Request Body:** Same structure as POST, all fields optional. Only provided fields are updated.

**Business Rules:**
- Build `changedFields` list (field names only, not values) for audit log
- Recompute `normalized_name` if `name` changed; re-check uniqueness
- If `name` changed and a matching `Client` record exists, update `client_id` link
- Update `updated_by` to `actor.id`

**Response 200:**
```json
{
  "message": "Profil klien berhasil diperbarui",
  "data": { /* full updated ClientProfile */ }
}
```

**Response 404:** `{ "error": "Klien tidak ditemukan" }`  
**Response 409:** Name conflict  

---

### 7.5 PATCH /api/clients/:id/status

**Purpose:** Activate or deactivate a client (soft delete)  
**Auth:** Admin only  
**Middleware:** `verifyToken` → `requireAdmin` → `validateRequest(statusSchema)`

**Request Body:**
```json
{ "status": "INACTIVE" }
```

**Response 200:**
```json
{
  "message": "Status klien berhasil diubah menjadi INACTIVE",
  "data": { "id": 4, "status": "INACTIVE" }
}
```

---

### 7.6 GET /api/clients/export

**Purpose:** Export all (or filtered) client profiles to Excel  
**Auth:** Admin + Staff  
**Middleware:** `verifyToken` → `validateRequest(exportClientsSchema)`

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| client_type | string | No | Filter by type |
| status | string | No | Default: 'ACTIVE' |

**Response:** Binary Excel file download

```
HTTP 200
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="Data_Klien_CSL_20260616_153000.xlsx"
```

**Audit:** Log `EXPORTED_CLIENTS` to HistoryLog with metadata `{ clientType, status, count, exportedBy }`

---

### 7.7 POST /api/clients/import

**Purpose:** Bulk import clients from uploaded Excel file  
**Auth:** Admin only  
**Middleware:** `verifyToken` → `requireAdmin` → `uploadWorkbook.single('file')` → `validateWorkbookMagicBytes`

**Request:** `multipart/form-data` with `file` field (xlsx)

**Response 201:**
```json
{
  "message": "Import selesai: 35 klien berhasil, 2 baris gagal.",
  "data": {
    "success": 35,
    "failed": 2,
    "errors": [
      { "row": 5, "reason": "Nama klien wajib diisi" }
    ]
  }
}
```

---

### 7.8 Family Member Endpoints

**GET /api/clients/:id/family**  
Auth: Admin + Staff  
Response: `{ "data": [ ...familyMembers ] }`

**POST /api/clients/:id/family**  
Auth: Admin  
Body: `{ nik, npwp, name, birth_date, relationship, occupation, ptkp_status, notes }`  
Validation: `name` required; `relationship` required enum; dates as `YYYY-MM-DD`  
Response 201: `{ "message": "Anggota keluarga berhasil ditambahkan", "data": {...} }`

**PUT /api/clients/:id/family/:memberId**  
Auth: Admin  
Body: Same as POST, all optional  
Response 200: Updated member

**DELETE /api/clients/:id/family/:memberId**  
Auth: Admin  
Response 200: `{ "message": "Anggota keluarga berhasil dihapus" }`

---

# PHASE 8 — FRONTEND SPECIFICATION

## 8.1 New Dashboard Tab

**File:** `frontend/src/pages/Dashboard.jsx`

**Change:** Add new tab to the `tabs` array (available to both Admin and Staff):
```javascript
{ id: "CLIENTS", label: "Data Klien", icon: Users2 }
```

Import `Users2` from lucide-react. Render `<ClientManager />` when `activeTab === "CLIENTS"`.

---

## 8.2 Component: ClientManager.jsx

**File:** `frontend/src/components/Client/ClientManager.jsx`  
**Purpose:** Root component for the Client Management feature. Owns state for search, filters, selected client, and modal visibility.

**State:**
```javascript
const [search, setSearch] = useState("");
const [clientType, setClientType] = useState("");        // "" | "ORANG_PRIBADI" | "BADAN"
const [statusFilter, setStatusFilter] = useState("ACTIVE");
const [page, setPage] = useState(1);
const [showForm, setShowForm] = useState(false);         // Create/Edit modal
const [editingClient, setEditingClient] = useState(null); // null = create, object = edit
const [viewingClient, setViewingClient] = useState(null); // Client detail modal
```

**Layout:**
```
[Title: "Data Klien"] [Admin: + Tambah Klien button]
[Search input] [Type filter dropdown] [Status filter dropdown] [Export button]
[ClientList component]
[Pagination]

<ClientForm modal> (conditional)
<ClientDetailModal> (conditional)
```

**API Integration (TanStack Query):**
```javascript
const { data, isLoading, refetch } = useQuery({
  queryKey: ['clients', { search, clientType, statusFilter, page }],
  queryFn: () => api.get('/clients', { params: { search, client_type: clientType, status: statusFilter, page } }).then(r => r.data),
  keepPreviousData: true,
});
```

**Export Handler:**
```javascript
const handleExport = async () => {
  const res = await api.get('/clients/export', {
    params: { client_type: clientType, status: statusFilter },
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = `Data_Klien_CSL_${Date.now()}.xlsx`;
  a.click();
};
```

---

## 8.3 Component: ClientList.jsx

**File:** `frontend/src/components/Client/ClientList.jsx`  
**Purpose:** Table/card grid of clients. Receives data as props.

**Props:** `{ clients, onView, onEdit (Admin only), isAdmin, isLoading }`

**Table Columns:**

| Column | Display |
|---|---|
| Nama | `name` with `group_affiliation` in grey below if present |
| Tipe | Badge: "OP" (blue) or "Badan" (purple) |
| NPWP | `npwp_15` or `npwp_16` |
| Email DJP | `email1` |
| Telp | `phone` |
| Status | Badge: ACTIVE (green) / INACTIVE (grey) |
| Actions | Eye icon (view) + [Admin] pencil icon (edit) |

**Behavior:**
- Row click → `onView(client)`
- Edit icon click → `onEdit(client)` (Admin only)
- Show skeleton loading state while `isLoading`
- Empty state: "Belum ada klien terdaftar. Klik 'Tambah Klien' untuk mulai." (Admin) or "Belum ada data klien." (Staff)

---

## 8.4 Component: ClientForm.jsx

**File:** `frontend/src/components/Client/ClientForm.jsx`  
**Purpose:** Modal form for creating and editing client profiles.

**Props:** `{ client (null for create, object for edit), onSuccess, onClose, isAdmin }`

**Form Sections (tabbed within modal):**

**Tab 1: Data Pokok**
- Client Type (radio: Orang Pribadi / Badan) — disabled on edit
- Nama (text, required)
- NPWP 15 digit (text)
- NPWP 16 digit (text)
- NIK (text — shown for OP)
- EFIN (text)
- Telepon/HP (text)
- Alamat (textarea)
- Afiliasi/Grup (text — shown for OP)
- Status NPWP (select: Aktif / Non-Aktif / Hapus)
- Catatan (textarea)

**Tab 2: Profil DJP**
- Tanggal Terdaftar (date)
- Tanggal Aktivasi (date)
- Status PKP (checkbox)
- Tanggal PKP (date — shown when PKP checked)
- Kode KLU (text)
- Deskripsi KLU (textarea)
- Kantor Wilayah (text)
- KPP (text)
- Seksi Pengawasan (text)

**Tab 3: Kredensial DJP**
- Password DJP (text + show/hide toggle)
- Password Coretax (text + show/hide toggle)
- Passphrase (text + show/hide toggle)
- PIN DJP (text + show/hide toggle)

**Tab 4: Kredensial Email**
- Email Utama (email input)
- Password Email Utama (text + show/hide toggle)
- Email Kedua (email input)
- Password Email Kedua (text + show/hide toggle)

**Tab 5: Kredensial Lainnya (Badan only — hidden for OP)**
- Username OSS (text)
- Password OSS (text + show/hide toggle)
- Email Accurate (email)
- Password Accurate (text + show/hide toggle)
- No. BPJS Kes (text)
- Password BPJS (text + show/hide toggle)

**Submit Behavior:**
- On create: `POST /api/clients`
- On edit: `PUT /api/clients/:id`
- On success: call `onSuccess()`, close modal, show toast notification
- Show field-level Zod errors inline below inputs
- Disable submit button while loading

**UX Details:**
- Tab with errors shows red dot indicator
- "Simpan" / "Simpan Perubahan" button + "Batal" button
- Confirm dialog before closing if form is dirty (has unsaved changes)

---

## 8.5 Component: ClientDetailModal.jsx

**File:** `frontend/src/components/Client/ClientDetailModal.jsx`  
**Purpose:** Read-only view of full client profile with all fields organized by section.

**Props:** `{ clientId, onClose, onEdit (Admin), isAdmin }`

**Data Fetching:**
```javascript
const { data } = useQuery({
  queryKey: ['client', clientId],
  queryFn: () => api.get(`/clients/${clientId}`).then(r => r.data.data),
  enabled: !!clientId,
});
```

**Layout:**

```
[Header: Nama Klien] [Badge: OP/Badan] [Badge: ACTIVE/INACTIVE]
[Admin: Edit button] [Admin: Deactivate/Reactivate button]

Section: Data Pokok
  NPWP | NIK | EFIN | Telepon | Alamat | Afiliasi

Section: Profil DJP
  Status NPWP | Tanggal Daftar | Status PKP | KLU | Kanwil | KPP

Section: Kredensial DJP
  Password DJP [eye] | Coretax [eye] | Passphrase [eye] | PIN [eye]

Section: Kredensial Email
  Email 1 | Password [eye] | Email 2 | Password [eye]

Section: Kredensial Lainnya (Badan only)
  OSS | Accurate | BPJS

[if OP] Section: Anggota Keluarga / Tanggungan
  Table: NIK | Nama | Hubungan | Pekerjaan | Status PTKP
  [Admin: + Tambah] [Admin: edit/delete per row]

Section: Catatan
  [notes text]

Footer: Dibuat oleh [name] pada [date] | Terakhir diubah [name] pada [date]
```

**Password Field Component (reusable):**
```javascript
// Shared sub-component used in both Form and Detail:
const PasswordField = ({ label, value }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-500">{label}:</span>
      <span className="font-mono">{visible ? value : '••••••••'}</span>
      <button onClick={() => setVisible(v => !v)}>
        {visible ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
};
```

---

## 8.6 Component: ClientFamilyTable.jsx

**File:** `frontend/src/components/Client/ClientFamilyTable.jsx`  
**Purpose:** Inline sub-table in ClientDetailModal for family members of OP clients.

**Props:** `{ clientProfileId, members, isAdmin, onRefresh }`

**Columns:** NIK | NPWP | Nama | Tgl Lahir | Hubungan | Pekerjaan | Status PTKP | [Admin: Actions]

**Actions (Admin only):**
- Add button → inline add form (small modal)
- Edit icon per row
- Delete icon per row (with confirmation dialog)

**API Calls:**
- Add: `POST /api/clients/:id/family`
- Edit: `PUT /api/clients/:id/family/:memberId`
- Delete: `DELETE /api/clients/:id/family/:memberId`
- On success: call `onRefresh()` to re-fetch parent detail

---

# PHASE 9 — IMPLEMENTATION PLAN

## Phase A: Database

| Step | Task | Notes |
|---|---|---|
| A1 | Create `backend/models/ClientProfile.js` | Full Sequelize model with all fields |
| A2 | Create `backend/models/ClientFamilyMember.js` | Sequelize model |
| A3 | Update `backend/models/index.js` | Add imports, associations, exports |
| A4 | Test `sequelize.sync({ alter: true })` in development | Verify new tables created cleanly |
| A5 | Write backfill script `backend/scripts/backfill-client-profiles.js` | One-time, optional |

## Phase B: Backend

| Step | Task | Notes |
|---|---|---|
| B1 | Create `backend/validators/clientSchemas.js` | Zod schemas for all endpoints |
| B2 | Extend `backend/services/clientService.js` | Add listClientProfiles, getClientProfile, createClientProfile, updateClientProfile, setClientStatus, exportClientProfiles, importClientProfiles, addFamilyMember, updateFamilyMember, removeFamilyMember |
| B3 | Create `backend/controllers/clientController.js` | Thin controllers calling service methods |
| B4 | Create `backend/routes/clientRoutes.js` | Wire all endpoints |
| B5 | Update `backend/server.js` | `import clientRoutes; app.use('/api/clients', clientRoutes)` |
| B6 | Add `CLIENT` action types to activityService | Add constants for new action types |
| B7 | Implement export logic in clientService | Use `xlsx` (already installed) to build workbook |
| B8 | Implement import logic in clientService | Parse uploaded xlsx, validate rows, upsert profiles |
| B9 | Test all endpoints with Postman/curl | Verify auth, validation, edge cases |

## Phase C: Frontend

| Step | Task | Notes |
|---|---|---|
| C1 | Create `frontend/src/components/Client/` directory | |
| C2 | Create `ClientManager.jsx` | Root component with search/filter state |
| C3 | Create `ClientList.jsx` | Table with pagination |
| C4 | Create `ClientForm.jsx` | Multi-tab create/edit modal |
| C5 | Create `ClientDetailModal.jsx` | Full-detail read modal |
| C6 | Create `ClientFamilyTable.jsx` | Sub-table for tanggungan |
| C7 | Update `Dashboard.jsx` | Add "Data Klien" tab, import ClientManager |
| C8 | Test create flow end-to-end | OP + Badan |
| C9 | Test edit flow end-to-end | Field changes, credential update |
| C10 | Test export flow | Download xlsx, verify sheet structure |
| C11 | Test search/filter | Name, NPWP, type, status combinations |
| C12 | Test family member CRUD | Add, edit, delete |

## Phase D: Testing

| Step | Task |
|---|---|
| D1 | Backend unit test: clientService.createClientProfile — normalizedName deduplication |
| D2 | Backend unit test: clientService.exportClientProfiles — correct sheet structure |
| D3 | Backend unit test: clientService.importClientProfiles — row validation errors |
| D4 | Backend integration test: Staff cannot POST/PUT/PATCH |
| D5 | Backend integration test: Admin can do everything |
| D6 | Frontend test: Form tab validation error indicators |
| D7 | Frontend test: Export download trigger |
| D8 | Frontend test: Password field show/hide toggle |

## Phase E: Deployment

| Step | Task |
|---|---|
| E1 | Deploy backend: `sequelize.sync({ alter: true, force: false })` creates new tables |
| E2 | Verify new tables in production DB |
| E3 | (Optional) Run backfill script: `node scripts/backfill-client-profiles.js` |
| E4 | Deploy frontend: rebuild Vite bundle |
| E5 | Smoke test: create 1 OP + 1 Badan client in production |
| E6 | Manually import existing Excel data using Import feature or via backfill |

---

# PHASE 10 — AI AGENT IMPLEMENTATION PACKAGE

This section is a self-contained specification for an AI coding agent to implement the feature without additional clarification.

---

## 10.1 Architecture Changes Summary

1. Two new Sequelize models: `ClientProfile`, `ClientFamilyMember`
2. Two new associations in `models/index.js`
3. One new router registered in `server.js` at `/api/clients`
4. New backend service functions added to `clientService.js`
5. New Zod validator file `clientSchemas.js`
6. New controller `clientController.js`
7. New frontend component directory `components/Client/` with 5 components
8. One new tab added to `Dashboard.jsx`

---

## 10.2 Backend File: `backend/models/ClientProfile.js`

```javascript
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const ClientProfile = sequelize.define(
  "ClientProfile",
  {
    client_id:            { type: DataTypes.INTEGER, allowNull: true },
    client_type:          { type: DataTypes.ENUM("ORANG_PRIBADI", "BADAN"), allowNull: false },
    name:                 { type: DataTypes.STRING(255), allowNull: false },
    normalized_name:      { type: DataTypes.STRING(255), allowNull: false, unique: true },
    npwp_15:              { type: DataTypes.STRING(20), allowNull: true },
    npwp_16:              { type: DataTypes.STRING(20), allowNull: true },
    nik:                  { type: DataTypes.STRING(20), allowNull: true },
    efin:                 { type: DataTypes.STRING(20), allowNull: true },
    taxpayer_type:        { type: DataTypes.STRING(100), allowNull: true },
    taxpayer_category:    { type: DataTypes.STRING(100), allowNull: true },
    npwp_status:          { type: DataTypes.ENUM("AKTIF","NON_AKTIF","HAPUS"), allowNull: true, defaultValue: "AKTIF" },
    registered_date:      { type: DataTypes.DATEONLY, allowNull: true },
    activation_date:      { type: DataTypes.DATEONLY, allowNull: true },
    pkp_status:           { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    pkp_date:             { type: DataTypes.DATEONLY, allowNull: true },
    klu_code:             { type: DataTypes.STRING(10), allowNull: true },
    klu_description:      { type: DataTypes.TEXT, allowNull: true },
    kanwil:               { type: DataTypes.STRING(255), allowNull: true },
    kpp:                  { type: DataTypes.STRING(255), allowNull: true },
    supervision_section:  { type: DataTypes.STRING(100), allowNull: true },
    phone:                { type: DataTypes.STRING(30), allowNull: true },
    address:              { type: DataTypes.TEXT, allowNull: true },
    group_affiliation:    { type: DataTypes.STRING(255), allowNull: true },
    djp_password:         { type: DataTypes.STRING(255), allowNull: true },
    coretax_password:     { type: DataTypes.STRING(255), allowNull: true },
    passphrase:           { type: DataTypes.STRING(255), allowNull: true },
    pin_djp:              { type: DataTypes.STRING(20), allowNull: true },
    email1:               { type: DataTypes.STRING(255), allowNull: true },
    email1_password:      { type: DataTypes.STRING(255), allowNull: true },
    email2:               { type: DataTypes.STRING(255), allowNull: true },
    email2_password:      { type: DataTypes.STRING(255), allowNull: true },
    oss_username:         { type: DataTypes.STRING(255), allowNull: true },
    oss_password:         { type: DataTypes.STRING(255), allowNull: true },
    accurate_email:       { type: DataTypes.STRING(255), allowNull: true },
    accurate_password:    { type: DataTypes.STRING(255), allowNull: true },
    bpjs_kes_number:      { type: DataTypes.STRING(50), allowNull: true },
    bpjs_kes_password:    { type: DataTypes.STRING(255), allowNull: true },
    status:               { type: DataTypes.ENUM("ACTIVE","INACTIVE"), allowNull: false, defaultValue: "ACTIVE" },
    notes:                { type: DataTypes.TEXT, allowNull: true },
    created_by:           { type: DataTypes.INTEGER, allowNull: true },
    updated_by:           { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: "client_profiles",
    timestamps: true,
    version: true,
    indexes: [
      { fields: ["client_id"] },
      { fields: ["client_type"] },
      { fields: ["status"] },
      { fields: ["npwp_15"] },
      { fields: ["npwp_16"] },
      { fields: ["nik"] },
      { fields: ["name"] },
      { fields: ["created_by"] },
      { fields: ["updated_by"] },
    ],
  }
);

export default ClientProfile;
```

---

## 10.3 Backend File: `backend/models/ClientFamilyMember.js`

```javascript
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const ClientFamilyMember = sequelize.define(
  "ClientFamilyMember",
  {
    client_profile_id: { type: DataTypes.INTEGER, allowNull: false },
    nik:               { type: DataTypes.STRING(20), allowNull: true },
    npwp:              { type: DataTypes.STRING(20), allowNull: true },
    name:              { type: DataTypes.STRING(255), allowNull: false },
    birth_date:        { type: DataTypes.DATEONLY, allowNull: true },
    relationship:      { type: DataTypes.ENUM("SUAMI","ISTRI","ANAK","TANGGUNGAN_LAIN"), allowNull: false },
    occupation:        { type: DataTypes.STRING(255), allowNull: true },
    ptkp_status:       { type: DataTypes.STRING(50), allowNull: true },
    notes:             { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "client_family_members",
    timestamps: true,
    indexes: [{ fields: ["client_profile_id"] }],
  }
);

export default ClientFamilyMember;
```

---

## 10.4 Additions to `backend/models/index.js`

Add these imports and associations:

```javascript
import ClientProfile from './ClientProfile.js';
import ClientFamilyMember from './ClientFamilyMember.js';

// === NEW ASSOCIATIONS ===
Client.hasOne(ClientProfile, { foreignKey: 'client_id' });
ClientProfile.belongsTo(Client, { foreignKey: 'client_id' });

ClientProfile.hasMany(ClientFamilyMember, { as: 'FamilyMembers', foreignKey: 'client_profile_id' });
ClientFamilyMember.belongsTo(ClientProfile, { foreignKey: 'client_profile_id' });

User.hasMany(ClientProfile, { as: 'CreatedProfiles', foreignKey: 'created_by' });
User.hasMany(ClientProfile, { as: 'UpdatedProfiles', foreignKey: 'updated_by' });
ClientProfile.belongsTo(User, { as: 'CreatedBy', foreignKey: 'created_by' });
ClientProfile.belongsTo(User, { as: 'UpdatedBy', foreignKey: 'updated_by' });

// Add to export:
export { sequelize, User, Client, ClientProfile, ClientFamilyMember, TaxTrack, ToDo, HistoryLog, TaskAssignment };
```

---

## 10.5 Backend File: `backend/validators/clientSchemas.js`

```javascript
import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD").optional().nullable();
const optionalStr = (max = 255) => z.string().trim().max(max).optional().nullable();
const optionalEmail = z.string().trim().email("Format email tidak valid").max(255).optional().nullable();

const clientBodySchema = z.object({
  client_type:         z.enum(["ORANG_PRIBADI", "BADAN"]),
  name:                z.string().trim().min(1).max(255),
  npwp_15:             optionalStr(20),
  npwp_16:             optionalStr(20),
  nik:                 optionalStr(20),
  efin:                optionalStr(20),
  taxpayer_type:       optionalStr(100),
  taxpayer_category:   optionalStr(100),
  npwp_status:         z.enum(["AKTIF","NON_AKTIF","HAPUS"]).optional().nullable(),
  registered_date:     dateString,
  activation_date:     dateString,
  pkp_status:          z.boolean().optional().default(false),
  pkp_date:            dateString,
  klu_code:            optionalStr(10),
  klu_description:     optionalStr(500),
  kanwil:              optionalStr(255),
  kpp:                 optionalStr(255),
  supervision_section: optionalStr(100),
  phone:               optionalStr(30),
  address:             optionalStr(1000),
  group_affiliation:   optionalStr(255),
  djp_password:        optionalStr(255),
  coretax_password:    optionalStr(255),
  passphrase:          optionalStr(255),
  pin_djp:             optionalStr(20),
  email1:              optionalEmail,
  email1_password:     optionalStr(255),
  email2:              optionalEmail,
  email2_password:     optionalStr(255),
  oss_username:        optionalStr(255),
  oss_password:        optionalStr(255),
  accurate_email:      optionalEmail,
  accurate_password:   optionalStr(255),
  bpjs_kes_number:     optionalStr(50),
  bpjs_kes_password:   optionalStr(255),
  notes:               optionalStr(2000),
});

export const createClientSchema = z.object({ body: clientBodySchema });

export const updateClientSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: clientBodySchema.partial().omit({ client_type: true }),
});

export const listClientProfilesSchema = z.object({
  query: z.object({
    page:        z.coerce.number().int().positive().default(1),
    limit:       z.coerce.number().int().positive().max(100).default(20),
    search:      z.string().trim().max(255).optional(),
    client_type: z.enum(["ORANG_PRIBADI","BADAN"]).optional(),
    status:      z.enum(["ACTIVE","INACTIVE"]).optional(),
  }),
});

export const clientIdParamSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});

export const clientStatusSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({ status: z.enum(["ACTIVE","INACTIVE"]) }),
});

export const exportClientsSchema = z.object({
  query: z.object({
    client_type: z.enum(["ORANG_PRIBADI","BADAN"]).optional(),
    status:      z.enum(["ACTIVE","INACTIVE"]).optional(),
  }),
});

export const familyMemberBodySchema = z.object({
  nik:          optionalStr(20),
  npwp:         optionalStr(20),
  name:         z.string().trim().min(1).max(255),
  birth_date:   dateString,
  relationship: z.enum(["SUAMI","ISTRI","ANAK","TANGGUNGAN_LAIN"]),
  occupation:   optionalStr(255),
  ptkp_status:  optionalStr(50),
  notes:        optionalStr(500),
});

export const addFamilyMemberSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: familyMemberBodySchema,
});

export const updateFamilyMemberSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    memberId: z.coerce.number().int().positive(),
  }),
  body: familyMemberBodySchema.partial(),
});

export const deleteFamilyMemberSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    memberId: z.coerce.number().int().positive(),
  }),
});
```

---

## 10.6 Backend File: `backend/services/clientService.js` (extended)

**Replace entire file with this. Preserve existing `findOrCreateClientByName` function at top.**

Key functions to implement:

```javascript
// PRESERVE EXISTING:
export const findOrCreateClientByName = async (name, transaction) => { ... }; // unchanged

// NEW FUNCTIONS:

export const listClientProfiles = async ({ page=1, limit=20, search, client_type, status } = {}) => {
  const where = {};
  if (client_type) where.client_type = client_type;
  if (status) where.status = status;
  if (search) {
    where[Op.or] = [
      { name:    { [Op.like]: `%${search}%` } },
      { npwp_15: { [Op.like]: `%${search}%` } },
      { npwp_16: { [Op.like]: `%${search}%` } },
      { nik:     { [Op.like]: `%${search}%` } },
    ];
  }
  const offset = (page - 1) * limit;
  const { count, rows } = await ClientProfile.findAndCountAll({
    where,
    order: [["name", "ASC"]],
    limit: parseInt(limit),
    offset,
  });
  return { total: count, page: parseInt(page), totalPages: Math.ceil(count / limit), data: rows };
};

export const getClientProfile = async (id) => {
  const profile = await ClientProfile.findByPk(id, {
    include: [
      { model: ClientFamilyMember, as: 'FamilyMembers', order: [['createdAt', 'ASC']] },
      { model: User, as: 'CreatedBy', attributes: ['id', 'name'] },
      { model: User, as: 'UpdatedBy', attributes: ['id', 'name'] },
    ],
  });
  if (!profile) { const e = new Error("Klien tidak ditemukan"); e.statusCode = 404; throw e; }
  return profile;
};

export const createClientProfile = async (body, actor) => {
  return runInTransaction(async (transaction) => {
    const cleanName = String(body.name || "").trim().replace(/\s+/g, " ");
    const normalized_name = normalizeName(cleanName);

    // Check uniqueness
    const existing = await ClientProfile.findOne({ where: { normalized_name }, transaction });
    if (existing) { const e = new Error("Klien dengan nama ini sudah terdaftar"); e.statusCode = 409; throw e; }

    // Try to link to existing Client record
    let client_id = null;
    const existingClient = await Client.findOne({ where: { normalizedName: normalized_name }, transaction });
    if (existingClient) { client_id = existingClient.id; }

    const profile = await ClientProfile.create({
      ...body,
      name: cleanName,
      normalized_name,
      client_id,
      created_by: actor.id,
      updated_by: actor.id,
    }, { transaction });

    await logActivity({
      actionType: "CREATED_CLIENT",
      actorId: actor.id,
      targetType: "CLIENT",
      targetId: profile.id,
      metadata: { name: profile.name, client_type: profile.client_type },
      legacy: { recordType: "TAX", recordId: profile.id },
      transaction,
    });

    return profile;
  });
};

export const updateClientProfile = async (id, body, actor) => {
  return runInTransaction(async (transaction) => {
    const profile = await ClientProfile.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!profile) { const e = new Error("Klien tidak ditemukan"); e.statusCode = 404; throw e; }

    // Compute changed fields for audit (exclude credential values from metadata)
    const SENSITIVE_FIELDS = ['djp_password','coretax_password','passphrase','pin_djp','email1_password','email2_password','oss_password','accurate_password','bpjs_kes_password'];
    const changedFields = Object.keys(body).filter(k => body[k] !== undefined && String(profile[k]) !== String(body[k]));

    if (body.name) {
      const cleanName = String(body.name).trim().replace(/\s+/g, " ");
      const normalized_name = normalizeName(cleanName);
      if (normalized_name !== profile.normalized_name) {
        const conflict = await ClientProfile.findOne({ where: { normalized_name }, transaction });
        if (conflict) { const e = new Error("Nama klien ini sudah digunakan"); e.statusCode = 409; throw e; }
        body.name = cleanName;
        body.normalized_name = normalized_name;
      }
    }

    await profile.update({ ...body, updated_by: actor.id }, { transaction });

    await logActivity({
      actionType: "UPDATED_CLIENT",
      actorId: actor.id,
      targetType: "CLIENT",
      targetId: profile.id,
      metadata: {
        changedFields: changedFields.filter(f => !SENSITIVE_FIELDS.includes(f)),
        credentialFieldsChanged: changedFields.filter(f => SENSITIVE_FIELDS.includes(f)).length > 0,
      },
      legacy: { recordType: "TAX", recordId: profile.id },
      transaction,
    });

    return ClientProfile.findByPk(id, { transaction });
  });
};

export const setClientProfileStatus = async (id, status, actor) => {
  return runInTransaction(async (transaction) => {
    const profile = await ClientProfile.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!profile) { const e = new Error("Klien tidak ditemukan"); e.statusCode = 404; throw e; }
    if (profile.status === status) { const e = new Error("Status sudah sama"); e.statusCode = 400; throw e; }
    await profile.update({ status, updated_by: actor.id }, { transaction });
    const actionType = status === "INACTIVE" ? "DEACTIVATED_CLIENT" : "REACTIVATED_CLIENT";
    await logActivity({
      actionType,
      actorId: actor.id,
      targetType: "CLIENT",
      targetId: profile.id,
      metadata: { status },
      legacy: { recordType: "TAX", recordId: profile.id },
      transaction,
    });
    return profile;
  });
};

export const exportClientProfiles = async ({ client_type, status }, actor) => {
  const where = {};
  if (client_type) where.client_type = client_type;
  if (status) where.status = status;

  const profiles = await ClientProfile.findAll({
    where,
    include: [{ model: ClientFamilyMember, as: 'FamilyMembers' }],
    order: [["name", "ASC"]],
  });

  const xlsx = await import("xlsx"); // already installed
  const wb = xlsx.utils.book_new();

  // Sheet 1: Orang Pribadi
  const opRows = profiles.filter(p => p.client_type === 'ORANG_PRIBADI').map(p => ({
    Nama: p.name, "NPWP 15": p.npwp_15, "NPWP 16": p.npwp_16, NIK: p.nik,
    "Password DJP": p.djp_password, "Password Coretax": p.coretax_password,
    Passphrase: p.passphrase, "Email 1": p.email1, "Password Email 1": p.email1_password,
    EFIN: p.efin, HP: p.phone, "Email 2": p.email2, "Password Email 2": p.email2_password,
    Alamat: p.address, PIN: p.pin_djp, Status: p.status,
    KPP: p.kpp, "Tanggal Daftar": p.registered_date, Catatan: p.notes,
  }));
  const wsOP = xlsx.utils.json_to_sheet(opRows.length ? opRows : [{}]);
  xlsx.utils.book_append_sheet(wb, wsOP, "Orang Pribadi");

  // Sheet 2: Badan
  const badanRows = profiles.filter(p => p.client_type === 'BADAN').map(p => ({
    Nama: p.name, "NPWP 16": p.npwp_16, "Password DJP": p.djp_password,
    "Password Coretax": p.coretax_password, "Email 1": p.email1,
    "Password Email 1": p.email1_password, EFIN: p.efin, HP: p.phone,
    "Email 2": p.email2, "Password Email 2": p.email2_password,
    "Username OSS": p.oss_username, "Password OSS": p.oss_password,
    "Email Accurate": p.accurate_email, "Password Accurate": p.accurate_password,
    "No BPJS Kes": p.bpjs_kes_number, "Password BPJS": p.bpjs_kes_password,
    Alamat: p.address, Status: p.status, Catatan: p.notes,
  }));
  const wsBadan = xlsx.utils.json_to_sheet(badanRows.length ? badanRows : [{}]);
  xlsx.utils.book_append_sheet(wb, wsBadan, "Badan");

  // Sheet 3: Tanggungan
  const tanggunganRows = profiles.flatMap(p =>
    (p.FamilyMembers || []).map(m => ({
      "Nama Klien": p.name, NIK: m.nik, NPWP: m.npwp, Nama: m.name,
      "Tgl Lahir": m.birth_date, Hubungan: m.relationship,
      Pekerjaan: m.occupation, "Status PTKP": m.ptkp_status,
    }))
  );
  const wsTanggungan = xlsx.utils.json_to_sheet(tanggunganRows.length ? tanggunganRows : [{}]);
  xlsx.utils.book_append_sheet(wb, wsTanggungan, "Tanggungan");

  const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

  // Fire-and-forget audit log
  logActivity({
    actionType: "EXPORTED_CLIENTS",
    actorId: actor.id,
    targetType: "CLIENT",
    targetId: 0,
    metadata: { client_type: client_type || "ALL", status: status || "ALL", count: profiles.length },
    legacy: { recordType: "TAX", recordId: 0 },
  }).catch(() => {});

  return { buffer, count: profiles.length };
};

// Family Member CRUD
export const addFamilyMember = async (clientProfileId, body, actor) => {
  const profile = await ClientProfile.findByPk(clientProfileId);
  if (!profile) { const e = new Error("Klien tidak ditemukan"); e.statusCode = 404; throw e; }
  const member = await ClientFamilyMember.create({ client_profile_id: clientProfileId, ...body });
  await logActivity({
    actionType: "ADDED_FAMILY_MEMBER",
    actorId: actor.id, targetType: "CLIENT", targetId: clientProfileId,
    metadata: { memberName: body.name, relationship: body.relationship },
    legacy: { recordType: "TAX", recordId: clientProfileId },
  });
  return member;
};

export const updateFamilyMember = async (clientProfileId, memberId, body, actor) => {
  const member = await ClientFamilyMember.findOne({ where: { id: memberId, client_profile_id: clientProfileId } });
  if (!member) { const e = new Error("Anggota keluarga tidak ditemukan"); e.statusCode = 404; throw e; }
  await member.update(body);
  await logActivity({
    actionType: "UPDATED_FAMILY_MEMBER",
    actorId: actor.id, targetType: "CLIENT", targetId: clientProfileId,
    metadata: { memberId },
    legacy: { recordType: "TAX", recordId: clientProfileId },
  });
  return member;
};

export const removeFamilyMember = async (clientProfileId, memberId, actor) => {
  const member = await ClientFamilyMember.findOne({ where: { id: memberId, client_profile_id: clientProfileId } });
  if (!member) { const e = new Error("Anggota keluarga tidak ditemukan"); e.statusCode = 404; throw e; }
  await member.destroy();
  await logActivity({
    actionType: "REMOVED_FAMILY_MEMBER",
    actorId: actor.id, targetType: "CLIENT", targetId: clientProfileId,
    metadata: { memberId },
    legacy: { recordType: "TAX", recordId: clientProfileId },
  });
};
```

---

## 10.7 Backend File: `backend/controllers/clientController.js`

```javascript
import {
  listClientProfiles, getClientProfile, createClientProfile,
  updateClientProfile, setClientProfileStatus, exportClientProfiles,
  addFamilyMember, updateFamilyMember, removeFamilyMember,
} from "../services/clientService.js";
import logger from "../utils/logger.js";

export const getClients = async (req, res) => {
  try {
    const result = await listClientProfiles(req.query);
    res.status(200).json(result);
  } catch (e) { logger.error(e); res.status(500).json({ error: "Gagal mengambil data klien" }); }
};

export const getClient = async (req, res) => {
  try {
    const profile = await getClientProfile(req.params.id);
    res.status(200).json({ data: profile });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
};

export const createClient = async (req, res) => {
  try {
    const profile = await createClientProfile(req.body, req.user);
    res.status(201).json({ message: "Profil klien berhasil dibuat", data: profile });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
};

export const updateClient = async (req, res) => {
  try {
    const profile = await updateClientProfile(req.params.id, req.body, req.user);
    res.status(200).json({ message: "Profil klien berhasil diperbarui", data: profile });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
};

export const updateClientStatus = async (req, res) => {
  try {
    const profile = await setClientProfileStatus(req.params.id, req.body.status, req.user);
    res.status(200).json({ message: `Status klien berhasil diubah menjadi ${req.body.status}`, data: { id: profile.id, status: profile.status } });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
};

export const exportClients = async (req, res) => {
  try {
    const { buffer, count } = await exportClientProfiles(req.query, req.user);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Data_Klien_CSL_${timestamp}.xlsx"`);
    res.send(buffer);
  } catch (e) { logger.error(e); res.status(500).json({ error: "Gagal mengekspor data klien" }); }
};

export const addMember = async (req, res) => {
  try {
    const member = await addFamilyMember(req.params.id, req.body, req.user);
    res.status(201).json({ message: "Anggota keluarga berhasil ditambahkan", data: member });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
};

export const updateMember = async (req, res) => {
  try {
    const member = await updateFamilyMember(req.params.id, req.params.memberId, req.body, req.user);
    res.status(200).json({ message: "Anggota keluarga berhasil diperbarui", data: member });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
};

export const deleteMember = async (req, res) => {
  try {
    await removeFamilyMember(req.params.id, req.params.memberId, req.user);
    res.status(200).json({ message: "Anggota keluarga berhasil dihapus" });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
};
```

---

## 10.8 Backend File: `backend/routes/clientRoutes.js`

```javascript
import express from "express";
import { verifyToken } from "../middleware/authCheck.js";
import { requireAdmin } from "../middleware/roleCheck.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  getClients, getClient, createClient, updateClient, updateClientStatus,
  exportClients, addMember, updateMember, deleteMember,
} from "../controllers/clientController.js";
import {
  listClientProfilesSchema, createClientSchema, updateClientSchema,
  clientIdParamSchema, clientStatusSchema, exportClientsSchema,
  addFamilyMemberSchema, updateFamilyMemberSchema, deleteFamilyMemberSchema,
} from "../validators/clientSchemas.js";

const router = express.Router();
router.use(verifyToken);

// Client profile CRUD
router.get("/export", validateRequest(exportClientsSchema), exportClients);   // BEFORE /:id
router.get("/", validateRequest(listClientProfilesSchema), getClients);
router.post("/", requireAdmin, validateRequest(createClientSchema), createClient);
router.get("/:id", validateRequest(clientIdParamSchema), getClient);
router.put("/:id", requireAdmin, validateRequest(updateClientSchema), updateClient);
router.patch("/:id/status", requireAdmin, validateRequest(clientStatusSchema), updateClientStatus);

// Family members
router.get("/:id/family", validateRequest(clientIdParamSchema), async (req, res) => {
  // Inline simple handler — returns FamilyMembers from getClientProfile
  const { getClientProfile } = await import("../services/clientService.js");
  try {
    const profile = await getClientProfile(req.params.id);
    res.status(200).json({ data: profile.FamilyMembers });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});
router.post("/:id/family", requireAdmin, validateRequest(addFamilyMemberSchema), addMember);
router.put("/:id/family/:memberId", requireAdmin, validateRequest(updateFamilyMemberSchema), updateMember);
router.delete("/:id/family/:memberId", requireAdmin, validateRequest(deleteFamilyMemberSchema), deleteMember);

export default router;
```

---

## 10.9 Addition to `backend/server.js`

```javascript
// Add import at top with other route imports:
import clientRoutes from "./routes/clientRoutes.js";

// Add after other route registrations:
app.use("/api/clients", clientRoutes);
```

---

## 10.10 Frontend Addition to `Dashboard.jsx`

```javascript
// Add import:
import ClientManager from "../components/Client/ClientManager";
import { Users2 } from "lucide-react";

// Add to tabs array:
{ id: "CLIENTS", label: "Data Klien", icon: Users2 },

// Add inside AnimatePresence content switch:
{activeTab === "CLIENTS" && <ClientManager />}
```

---

## 10.11 Validation Rules Summary

| Rule | Enforcement |
|---|---|
| `name` required on create | Zod `min(1)` |
| `client_type` required on create, immutable on update | Zod required + omitted from update schema |
| Email fields must be valid email format if provided | Zod `.email()` on optional nullable |
| Date fields must be `YYYY-MM-DD` | Zod `.regex()` |
| `normalized_name` must be globally unique | DB unique constraint + service-layer check with 409 error |
| Credential fields max 255 chars | Zod `.max(255)` |
| `notes` max 2000 chars | Zod `.max(2000)` |
| `relationship` for family members is a strict enum | Zod `.enum()` |
| `limit` max 100 | Zod `.max(100)` |
| Only Admin can write | `requireAdmin` middleware |
| Both Admin + Staff can read and export | `verifyToken` only |

---

## 10.12 Error Handling Rules

| Scenario | HTTP Status | Response |
|---|---|---|
| Client not found by ID | 404 | `{ error: "Klien tidak ditemukan" }` |
| Duplicate normalized name on create | 409 | `{ error: "Klien dengan nama ini sudah terdaftar" }` |
| Staff tries to create/update/delete | 403 | `{ error: "Akses Ditolak. Hanya Admin yang bisa melakukan aksi ini." }` |
| Zod validation failure | 400 | `{ error: "Validasi gagal: [field] [message]" }` |
| Deactivating already inactive client | 400 | `{ error: "Status sudah sama" }` |
| Family member not found | 404 | `{ error: "Anggota keluarga tidak ditemukan" }` |
| Unauthenticated request | 401 | `{ error: "Unauthorized" }` |
| Database/internal error | 500 | `{ error: "Gagal mengambil data klien" }` |

---

## 10.13 Acceptance Criteria

**AC1:** Admin can open "Data Klien" tab from the Dashboard.

**AC2:** Admin can create an Orang Pribadi client with all fields (NPWP, NIK, DJP credentials, email credentials) and see it in the list.

**AC3:** Admin can create a Badan client with all fields including OSS, Accurate, and BPJS credentials.

**AC4:** Staff (non-Admin) can see the client list and open a client detail view, but the "Tambah Klien" and "Edit" buttons are not visible.

**AC5:** Staff cannot successfully call POST/PUT/PATCH /api/clients (returns 403).

**AC6:** Admin can edit any field of an existing client, including credential fields.

**AC7:** Credential fields (passwords, passphrase, PIN) are hidden behind a show/hide toggle (eye icon) in both the form and detail view.

**AC8:** Admin can click "Export Excel" and download a `.xlsx` file with three sheets: "Orang Pribadi", "Badan", "Tanggungan".

**AC9:** Staff can also download the Excel export.

**AC10:** Admin can deactivate a client. The client remains in the list with "INACTIVE" status badge. Inactive clients are still linked to their TaxTrack records.

**AC11:** Admin can add, edit, and remove family members (tanggungan) for an Orang Pribadi client from the detail modal.

**AC12:** The search box filters clients by name, NPWP 15, NPWP 16, or NIK.

**AC13:** The type filter ("Orang Pribadi" / "Badan") correctly filters the list.

**AC14:** Every create/update/deactivate action is recorded in `history_logs` with `targetType: "CLIENT"`.

**AC15:** Creating a client with the same name (after normalization) as an existing client returns a 409 error with a user-friendly message.

**AC16:** The existing TaxTrack and workbook import flows continue to work unchanged after this feature is deployed (regression test).

**AC17:** Client list is paginated with 20 items per page by default, with page navigation controls.

---

## 10.14 Files to Create (Checklist for AI Agent)

```
BACKEND (new files):
□ backend/models/ClientProfile.js
□ backend/models/ClientFamilyMember.js
□ backend/validators/clientSchemas.js
□ backend/controllers/clientController.js
□ backend/routes/clientRoutes.js
□ backend/scripts/backfill-client-profiles.js  (optional)

BACKEND (modified files):
□ backend/models/index.js  — add imports + associations + exports
□ backend/services/clientService.js  — add new functions, keep findOrCreateClientByName
□ backend/server.js  — add clientRoutes import + app.use("/api/clients", clientRoutes)

FRONTEND (new files):
□ frontend/src/components/Client/ClientManager.jsx
□ frontend/src/components/Client/ClientList.jsx
□ frontend/src/components/Client/ClientForm.jsx
□ frontend/src/components/Client/ClientDetailModal.jsx
□ frontend/src/components/Client/ClientFamilyTable.jsx

FRONTEND (modified files):
□ frontend/src/pages/Dashboard.jsx  — add CLIENTS tab + ClientManager render
```

---

*End of Software Design Document*  
*Document Version: 1.0.0*  
*System: Catat Susun Lapor (CSL)*  
*Feature: Manajemen Data Klien*  
*Prepared: June 2026*
