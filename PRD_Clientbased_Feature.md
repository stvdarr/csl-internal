Product Requirements Document
Feature: Client-Based Tax Track (Obligation/Period Restructure)
System: Catat Susun Lapor (CSL)
Version 1.0 — Draft for Implementation

A note on scope and confidence, before anything else
This PRD is written against two verified sources of truth:

The live, currently-running architecture — confirmed by direct inspection of backend/controllers/taxController.js, backend/routes/taxRoutes.js, backend/services/taxService.js, and backend/models/index.js as they exist on disk right now. The service layer, controller, routes, validators, and all three frontend Tax components (TaxTracker.jsx, TaxMatrixView.jsx, TaxListView.jsx) are still running on the old flat TaxTrack model. This is not a guess — I just re-read the files.
The target data layer — backend/models/TaxObligation.js, backend/models/TaxPeriod.js, and the association wiring in backend/models/index.js have already been authored and are sitting on disk in a self-consistent state (verified by re-reading them this turn). They are not yet referenced by any service, controller, or route — taxService.js still imports and uses the old TaxTrack model exclusively.

So: the database target shape is settled and real. Everything above the model layer (service, controller, routes, validators, frontend) is not yet built, despite earlier discussion implying otherwise. This PRD treats the obligation/period model as the agreed target and specifies the remaining work needed to wire the rest of the stack to it. I will not describe service functions, endpoints, or components that don't exist yet as if they're shipped — every "current state" section below is annotated with what's actually true today versus what's being proposed.

1. Ringkasan Fitur
Nama fitur: Client-Based Tax Obligation Tracking (restrukturisasi dari flat tax_tracks ke model TaxObligation + TaxPeriod)
Tujuan bisnis: Menghilangkan duplikasi nama klien pada tabel pajak, memungkinkan satu klien memiliki banyak jenis pajak sekaligus (PPh 21, PPN, UNIFIKASI, dst.) dengan PIC yang berbeda per jenis pajak, dan membuat data pajak per klien terlihat utuh dalam satu tempat.
Masalah yang diselesaikan:

Nama klien berulang di setiap baris bulanan pada tabel tax_tracks (1 row = 1 client + 1 taxType + 1 period).
Tidak ada cara melihat semua jenis pajak satu klien dalam satu pandangan tanpa scan manual di frontend.
Import dari Master Workbook menghasilkan ratusan row datar yang secara struktural tidak menyatakan hubungan "klien ini punya obligasi pajak ini" — hubungan itu hanya tersirat dari keberadaan row.
PIC assignment saat ini di level row per bulan (TaxTrack.pic_id), padahal kebutuhan bisnis adalah PIC per (klien, jenis pajak) — satu orang menangani PPN klien X sepanjang tahun, bukan PIC yang bisa berbeda tiap bulan untuk pajak yang sama.

Nilai bisnis: Mengurangi waktu admin menyusun ulang data pajak per klien secara manual, mengurangi risiko salah assign PIC akibat data tersebar di banyak row, dan membuat workbook Excel impor lebih murah secara struktural (obligasi dibuat sekali, bukan per baris bulan).

2. Kondisi Sistem Saat Ini
Cara kerja sistem saat ini (verified, live)
Backend Node.js (Express 5 + Sequelize 6 + MySQL), frontend React 19 + Vite, realtime via Socket.IO, auth JWT. Semua pajak disimpan datar di tabel tax_tracks:
js// backend/models/TaxTrack.js (MASIH AKTIF DI taxService.js SAAT INI)
{
  clientName: STRING,
  clientId: INTEGER (FK -> clients.id, nullable),
  taxType: STRING (default "UMUM"),
  period: STRING,
  amount: DECIMAL(15,2),
  status: STRING (default "NOT_STARTED"),
  pic_id: INTEGER (FK -> users.id, via index, not declared FK constraint)
}
Satu klien dengan PPN 12 bulan + PPh 21 12 bulan menghasilkan 24 row di tax_tracks, masing-masing dengan clientName yang sama diulang.
Komponen yang relevan (verified, live)
LayerFilePeranModelbackend/models/TaxTrack.jsTabel flat saat ini — akan dihapusModelbackend/models/Client.jsIdentity tipis: name, normalizedName, taxIdNumber, status — tidak berubahServicebackend/services/taxService.jsSemua logika bisnis pajak: list, create, status update, assign, import, workload, overview — akan ditulis ulang totalServicebackend/services/taxWorkbookParser.jsParse file Excel multi-sheet jadi array flat {clientName, picName, taxType, period, status, amount, sourceSheet, sourceRow, sourceColumn} — logic parsing TIDAK berubah, hanya consumer-nyaServicebackend/services/clientService.jsBerisi findOrCreateClientByName() yang dipakai taxService — tidak berubah, akan di-reuseServicebackend/services/bootstrapService.jsbackfillTaxClients() — backfill clientId ke row TaxTrack lama yang belum punya — menjadi dead code setelah migrasi karena tabel sumbernya dihapusControllerbackend/controllers/taxController.jsHTTP handler untuk semua endpoint /api/tax/* — akan ditulis ulangRoutesbackend/routes/taxRoutes.jsDefinisi endpoint — akan ditulis ulang sebagianValidatorbackend/validators/taxSchemas.jsSchema Zod untuk setiap endpoint pajak — akan ditulis ulang sebagianFrontendfrontend/src/components/Tax/TaxTracker.jsxContainer: tab jenis pajak, toggle List/Matrix, upload workbook, fetch data per tab — akan diubah, struktur tab dipertahankanFrontendfrontend/src/components/Tax/TaxMatrixView.jsxRender matrix klien (baris) × periode (kolom), keyboard hotkey status update, inline PIC editor per row — akan diubah signifikan, keying berubah dari clientName string ke obligationIdFrontendfrontend/src/components/Tax/TaxListView.jsxRender list flat dengan dropdown status per row — perubahan minor, shape data berubahFrontendfrontend/src/components/Tax/MasterWorkbookUploader.jsxUI upload + preview + confirm — tidak berubah, tidak tahu apa-apa soal DB shapeSocketbackend/services/socketEventBus.jsemitTaxUpdated() mengirim event TAX_UPDATED ke room user_{pic_id} dan admin_room — payload diperluas, bukan diganti struktur eventnya
Endpoint yang relevan (verified, live — backend/routes/taxRoutes.js)
GET    /api/tax                       -> listTaxes (flat, by taxType/clientId/status/assigneeId, paginated)
GET    /api/tax/clients               -> getClientTaxOverview (per-client grouping, computed client-side from flat rows)
GET    /api/tax/workload              -> getWorkloadSummary
DELETE /api/tax/clear-all             -> resetAllTaxData (admin only, rate-limited 3x/jam)
POST   /api/tax                       -> createTaxTask (admin only)
POST   /api/tax/workbook/preview      -> previewTaxWorkbook (admin only, parse only, no DB write)
POST   /api/tax/workbook/confirm      -> confirmTaxWorkbookImport (admin only, commits to DB)
PUT    /api/tax/:id/status            -> updateTaxStatus (PIC atau admin, dengan checkApprovalAccess untuk status COMPLETED/APPROVED)
PUT    /api/tax/:id/assign            -> assignTax (admin only) — assign PIC ke SATU row TaxTrack
PUT    /api/tax/client/:clientId/assign -> bulkAssignClientTaxes (admin only) — assign PIC ke SEMUA row TaxTrack milik satu client, lintas semua jenis pajak
Catatan penting: endpoint terakhir (PUT /api/tax/client/:clientId/assign) secara desain saat ini meng-assign PIC yang sama untuk semua jenis pajak klien tersebut sekaligus. Ini bertentangan langsung dengan kebutuhan bisnis baru (PIC berbeda per jenis pajak per klien), jadi endpoint ini akan di-deprecate, bukan dipertahankan.
Model yang relevan (verified, live)

tax_tracks — tabel sumber masalah, lihat di atas.
clients — id, name, normalizedName (unique), taxIdNumber, status (ACTIVE/INACTIVE). Tidak berubah.
task_assignments — id, targetType (ENUM: TAX, TODO), targetId, fromUserId, toUserId, assignedById, reason. Polimorfik via targetId, tidak ada FK constraint formal ke TaxTrack — artinya targetId bisa direpoint ke entity baru tanpa migrasi skema di tabel ini.
history_logs — id, actionType, actorId, targetType (ENUM: TAX, TODO, CLIENT, USER), targetId, recordType (ENUM: TAX, TODO), recordId, oldStatus, newStatus, metadata (JSON). Sama seperti task_assignments, polimorfik dan tidak terkunci ke struktur TaxTrack spesifik.

Service yang relevan (verified, live)
taxService.js (652 baris) berisi: listTaxes, resetAllTaxData, createTaxTask, updateTaxTaskStatus, assignTaxTask, assignTaxTasksByClient, importTaxWorkbookRows (dengan batch processing 100 row/transaksi), getWorkloadSummary, getClientTaxOverview. Semua menggunakan runInTransaction() helper dan Sequelize row locking (transaction.LOCK.UPDATE) untuk concurrency safety pada update status/assign.
Target data layer (already built, verified on disk, not yet wired)
js// backend/models/TaxObligation.js — SUDAH DIBUAT
{
  clientId: INTEGER (FK -> clients.id),
  taxType: STRING,
  frequency: ENUM("MONTHLY", "ANNUAL"),
  pic_id: INTEGER (FK -> users.id, nullable),
  status: ENUM("ACTIVE", "INACTIVE")
}
// unique index: (clientId, taxType) — satu klien hanya boleh punya SATU obligasi per jenis pajak

// backend/models/TaxPeriod.js — SUDAH DIBUAT
{
  obligationId: INTEGER (FK -> tax_obligations.id, CASCADE on delete),
  period: STRING,        // "JANUARI 2026", atau "TAHUNAN 2026" untuk tipe ANNUAL
  amount: DECIMAL(15,2),
  status: STRING
}
// unique index: (obligationId, period)
Asosiasi di backend/models/index.js sudah benar: Client.hasMany(TaxObligation), TaxObligation.hasMany(TaxPeriod, {onDelete: CASCADE}), User.hasMany(TaxObligation, {foreignKey: 'pic_id'}).

3. User Story
US-01

Sebagai Admin

Saya ingin melihat semua jenis pajak satu klien dalam satu baris/grup

Sehingga saya tidak perlu mencari klien yang sama di setiap tab jenis pajak secara manual.
US-02

Sebagai Admin

Saya ingin menetapkan PIC yang berbeda untuk PPh 21 dan PPN pada klien yang sama

Sehingga pembagian kerja staff bisa sesuai keahlian per jenis pajak, bukan per klien.
US-03

Sebagai Staff

Saya ingin hanya melihat dan mengubah status pajak yang menjadi tanggung jawab saya (berdasarkan jenis pajak, bukan berdasarkan bulan tertentu)

Sehingga saya tidak terganggu data pajak klien lain yang bukan tugas saya.
US-04

Sebagai Admin

Saya ingin mengimpor Master Workbook Excel multi-sheet dan sistem otomatis mengelompokkan baris-baris bulanan ke dalam satu obligasi pajak per klien per jenis pajak

Sehingga saya tidak perlu membuat ulang relasi klien-jenis pajak setiap kali impor.
US-05

Sebagai Admin

Saya ingin menambahkan klien ke suatu jenis pajak secara manual sebelum data bulanan tersedia

Sehingga saya bisa menyiapkan PIC dan struktur sebelum bulan pertama datang.
US-06

Sebagai Admin atau Staff

Saya ingin melihat matrix klien × periode per tab jenis pajak, sama seperti sekarang

Sehingga workflow update status cell-by-cell yang sudah familiar tidak berubah drastis.
US-07

Sebagai Admin

Saya ingin riwayat perubahan (history log) tetap mencatat siapa mengubah apa, kapan, dan status apa ke apa

Sehingga audit trail tidak hilang setelah restrukturisasi data.
US-08

Sebagai Admin

Saya ingin mereset seluruh data pajak (clear-all) untuk memulai ulang

Sehingga saya bisa migrasi bersih dari struktur lama tanpa data sisa yang bercampur.

4. Functional Requirements
IDDeskripsiAktorPreconditionTriggerExpected ResultFR-01Sistem membuat TaxObligation baru saat klien pertama kali memiliki jenis pajak tertentu (manual atau via import)Admin / SystemClient sudah ada atau akan dibuat via findOrCreateClientByNamePOST /api/tax/obligations atau baris pertama suatu (client, taxType) ditemukan saat importRow baru di tax_obligations dengan frequency ditentukan dari taxType (lihat FR-08)FR-02Sistem mencegah duplikasi obligasi untuk (client, taxType) yang samaSystem—Insert ke tax_obligations dengan (clientId, taxType) yang sudah adaInsert ditolak oleh unique index; service melempar error 409 dengan pesan jelasFR-03Admin dapat menetapkan/mengubah PIC pada level obligasi (bukan per periode)AdminObligasi sudah adaPUT /api/tax/obligations/:id/assign dengan toUserIdtax_obligations.pic_id diperbarui; task_assignments baru dibuat (targetType: TAX, targetId: obligationId); semua TaxPeriod di bawah obligasi tersebut menyiarkan event TAX_UPDATED dengan pic_id baruFR-04Staff hanya dapat mengubah status TaxPeriod jika dia adalah PIC dari TaxObligation induknyaStaffUser login sebagai StaffPUT /api/tax/periods/:id/statusJika obligation.pic_id !== actor.id dan role bukan Admin → 403 ForbiddenFR-05Perubahan status mengikuti state machine yang sama seperti sekarang (VALID_TRANSITIONS)Admin / StaffStatus saat ini dan status baru valid menurut taskStatus.jsPUT /api/tax/periods/:id/statusJika transisi tidak valid → 400; jika valid → status di-update, history log dibuat, event disiarkanFR-06Import Master Workbook menghasilkan satu obligasi per (client, taxType) yang ditemukan di seluruh sheet, dengan periode-periode di bawahnyaAdminFile .xlsx valid, sudah lolos previewPOST /api/tax/workbook/confirmUntuk tiap baris hasil parse: cari/buat obligasi, lalu cari/buat/update period di bawah obligasi tersebut. Tidak ada duplikasi row per bulan yang menciptakan obligasi baruFR-07Baris pertama dengan PIC name yang valid pada suatu (client, taxType) menetapkan pic_id obligasi jika obligasi belum punya PICSystemObligasi pic_id masih nullImport baris dengan picName terisi dan cocok dengan user terdaftartax_obligations.pic_id diisi sekali; baris berikutnya untuk obligasi yang sama TIDAK menimpa PIC yang sudah ada (PIC hanya diubah lewat endpoint assign eksplisit)FR-08Sistem menentukan frequency obligasi otomatis berdasarkan taxTypeSystem—Obligasi baru dibuattaxType dalam himpunan {"1770 OP", "1771 BADAN"} → frequency = ANNUAL; selain itu → MONTHLYFR-09Untuk obligasi ANNUAL, semua variasi string periode yang mengandung tahun yang sama dinormalisasi ke satu label "TAHUNAN <tahun>"Systemfrequency = ANNUALImport atau create manual dengan periode apapun yang memuat 4 digit tahunHanya ada SATU TaxPeriod per tahun per obligasi ANNUAL, walau sumber data menyebut periode dengan format berbeda-bedaFR-10Admin dapat membuat obligasi kosong (tanpa periode) secara manualAdminKlien ada atau dibuat otomatis dari namaPOST /api/tax/obligations dengan clientName, taxType, opsional pic_idObligasi tercipta dengan 0 periode; muncul di Matrix View sebagai baris kosong (semua kolom strip)FR-11Matrix View menampilkan baris per obligasi (bukan per nama klien string), dikelompokkan per tab jenis pajakAdmin / StaffTab jenis pajak aktif dipilihBuka tab tertentu di TaxTracker.jsxSetiap baris matrix = satu TaxObligation; kolom = TaxPeriod yang ada di bawahnya, di-sort berdasarkan urutan periodeFR-12Reset seluruh data pajak menghapus tax_obligations, tax_periods, dan task_assignments bertipe TAXAdminKonfirmasi literal string sesuai CLEAR_ALL_TAX_CONFIRMATIONDELETE /api/tax/clear-allSemua baris di tiga tabel tersebut terhapus dalam satu transaksi; history log mencatat jumlah yang terhapusFR-13Endpoint assign massal per klien (lintas semua jenis pajak) dihapusAdmin——PUT /api/tax/client/:clientId/assign tidak tersedia lagi; UI tombol bulk-assign-per-klien dihapus dari Matrix ViewFR-14Parsing workbook Excel (deteksi sheet, deteksi periode dari header, deteksi status dari marker "OK"/angka) tidak berubah sama sekaliSystem—Upload file ke /api/tax/workbook/previewOutput parser identik strukturnya dengan sebelumnya: array {clientName, picName, taxType, period, status, amount, sourceSheet, sourceRow, sourceColumn}

5. Non-Functional Requirements
Performance: Query daftar obligasi + periode per tab harus tetap di bawah batas waktu yang sama dengan implementasi flat saat ini untuk volume data yang sebanding (~ratusan klien × puluhan periode). Join dua level (Client -> TaxObligation -> TaxPeriod) menambah satu level JOIN dibanding query flat sebelumnya — perlu index pada tax_obligations.clientId, tax_obligations.taxType, tax_periods.obligationId (semua sudah didefinisikan di model).
Scalability: Struktur baru secara desain lebih scalable untuk pertumbuhan jumlah tahun (karena periode bertambah sebagai child row, bukan kolom baru), tapi tidak secara otomatis mengurangi jumlah total row di database — jumlah TaxPeriod per tahun tetap sama dengan jumlah TaxTrack lama. Keuntungan utama bersifat struktural/query, bukan volumetrik.
Maintainability: Pemisahan obligasi vs periode mengikuti pola yang sudah ada di codebase (ClientProfile + ClientFamilyMember sebagai parent-child pattern yang serupa), sehingga konsisten dengan konvensi arsitektur yang sudah dipakai tim untuk fitur Client Profile.
Security: Tidak ada perubahan pada mekanisme auth (JWT) atau middleware (verifyToken, requireAdmin, checkApprovalAccess). Authorization check pada level service (PIC ownership) dipindah dari TaxTrack.pic_id ke TaxObligation.pic_id — perlu regression test eksplisit karena ini titik rawan privilege-check yang salah arah.
Auditability: history_logs dan task_assignments tetap dipakai dengan targetType: "TAX" untuk obligasi maupun event terkait periode, dibedakan lewat metadata.obligationId / recordId. Tidak ada perubahan skema ENUM di kedua tabel ini — pendekatan ini dipilih secara sengaja untuk menghindari ALTER TABLE pada ENUM yang berisiko di MySQL dengan sequelize.sync({alter:true}).
Reliability: Semua operasi tulis (create obligation+period, assign, status update, import) tetap dibungkus runInTransaction() dengan row locking yang sama seperti implementasi lama, mempertahankan jaminan konsistensi pada concurrent update.

6. Database Impact
Tabel yang dihapus: tax_tracks
Tabel baru:
tax_obligations (sudah didefinisikan di TaxObligation.js, model sudah dibuat, migrasi/sync belum dijalankan terhadap database aktual)

clientId INT, FK → clients.id
taxType VARCHAR
frequency ENUM('MONTHLY','ANNUAL')
pic_id INT, FK → users.id, nullable
status ENUM('ACTIVE','INACTIVE')
version INT (optimistic locking)
timestamps
unique index (clientId, taxType)

tax_periods (sudah didefinisikan di TaxPeriod.js)

obligationId INT, FK → tax_obligations.id, ON DELETE CASCADE
period VARCHAR
amount DECIMAL(15,2)
status VARCHAR
version INT
timestamps
unique index (obligationId, period)

Relasi baru: Client.hasMany(TaxObligation), TaxObligation.belongsTo(Client), User.hasMany(TaxObligation, {foreignKey:'pic_id'}), TaxObligation.hasMany(TaxPeriod, {onDelete:'CASCADE'}) — semua sudah ditulis di models/index.js dan terverifikasi konsisten.
Migrasi yang diperlukan:

Karena repo ini tidak memakai migration framework formal (Sequelize sync({alter: shouldAlterSchema}) di server.js, di mana shouldAlterSchema = NODE_ENV !== "production"), penerapan skema baru di development otomatis lewat restart server. Di production, alter bernilai false — berarti tim harus menjalankan DDL manual atau menjalankan satu kali deploy dengan NODE_ENV di-override sementara untuk memicu sync({alter:true}). Ini harus didokumentasikan eksplisit di deployment plan, bukan diasumsikan otomatis.
Drop tabel tax_tracks dilakukan manual (DROP TABLE tax_tracks;) — tidak ada fitur "drop model" otomatis dari Sequelize sync.
Tidak ada migrasi data dari tax_tracks ke tax_obligations/tax_periods — keputusan bisnis: data lama dihapus, mulai fresh (acceptable, sudah dikonfirmasi sebelumnya).
task_assignments dan history_logs tidak butuh ALTER skema — keduanya polimorfik via targetId/recordId integer tanpa FK constraint formal ke tabel pajak, sehingga bisa langsung dipakai untuk ID dari TaxObligation/TaxPeriod tanpa migrasi.


7. Backend Impact
Endpoint baru (belum ada, perlu dibuat):
POST /api/tax/obligations              — buat obligasi manual (FR-10)
GET  /api/tax/obligations              — list obligasi (untuk render baris matrix walau 0 periode, FR-11)
PUT  /api/tax/obligations/:id/assign   — assign PIC level obligasi (FR-03), menggantikan PUT /api/tax/:id/assign
Endpoint yang berubah perilaku (path sama atau mirip, semantik beda):
GET  /api/tax              — sekarang query TaxPeriod join TaxObligation, bukan TaxTrack langsung
GET  /api/tax/clients       — getClientTaxOverview mengembalikan struktur bersarang per taxType, bukan flat task array
POST /api/tax               — createTaxTask sekarang dua-fase: find/create obligation lalu create period
PUT  /api/tax/:id/status    — id sekarang merujuk ke TaxPeriod.id, bukan TaxTrack.id (perlu rename path jadi /api/tax/periods/:id/status agar tidak ambigu — direkomendasikan, bukan keharusan teknis)
POST /api/tax/workbook/confirm — importTaxWorkbookRows menjalankan two-phase upsert (obligation lalu period) — lihat FR-06
Endpoint yang dihapus:
PUT /api/tax/client/:clientId/assign  — bulkAssignClientTaxes, dihapus karena bertentangan dengan PIC-per-taxType (FR-13)
Service yang berubah:

taxService.js — ditulis ulang total. Fungsi baru: findOrCreateObligation, createTaxObligation, listTaxObligations, assignTaxObligation. Fungsi yang dipertahankan namanya tapi diubah implementasinya: listTaxes, createTaxTask, updateTaxTaskStatus, importTaxWorkbookRows, getWorkloadSummary, getClientTaxOverview. Fungsi yang dihapus: assignTaxTask (diganti assignTaxObligation), assignTaxTasksByClient (dihapus, lihat FR-13).
bootstrapService.js — backfillTaxClients() jadi dead code, import-nya di server.js harus dihapus juga.
taxWorkbookParser.js — tidak berubah.
clientService.js — tidak berubah, findOrCreateClientByName di-reuse langsung.
socketEventBus.js — emitTaxUpdated() payload ditambah field taxType dan obligationId (additive, tidak breaking terhadap consumer lama).

Middleware yang berubah: Tidak ada. verifyToken, requireAdmin, checkApprovalAccess, validateRequest semua tetap dipakai apa adanya — hanya schema yang divalidasi yang berubah (di validators/taxSchemas.js), bukan middleware itu sendiri.

8. Frontend Impact
Halaman yang berubah: Tidak ada perubahan routing (App.jsx tetap satu halaman Dashboard). Dashboard.jsx tidak berubah strukturnya, karena TaxTracker sudah self-contained sebagai satu tab.
Komponen baru: Tidak ada komponen file baru yang wajib, tapi disarankan komponen kecil baru ObligationPicEditor jika ingin memisahkan logic inline-PIC-editor dari TaxMatrixView.jsx (opsional, tidak blocking).
Komponen yang diubah:

TaxTracker.jsx — query key dan fetch function (fetchTaxesForType) berubah untuk membaca data periode+obligasi alih-alih flat tax array. Struktur tab (TAX_CATEGORIES) tidak berubah.
TaxMatrixView.jsx — perubahan paling signifikan. Saat ini matrix di-key oleh clientName (string) lewat mData[clientName]; harus diubah jadi key oleh obligationId agar baris tidak pecah/duplikat akibat variasi string nama klien, dan agar baris bisa tampil walau 0 periode (FR-11 / keputusan yang sudah dikonfirmasi). PIC editor inline harus memanggil endpoint assign-obligasi baru, bukan bulkAssignClientTaxes.
TaxListView.jsx — perubahan minor: tax.Client?.name jadi period.TaxObligation.Client?.name, dan kolom PIC merujuk period.TaxObligation.User?.name.

Komponen yang tidak berubah: MasterWorkbookUploader.jsx (tidak tahu apa-apa soal DB shape, hanya UI upload/preview), HistoryLogViewer.jsx, ToDoList.jsx, semua komponen Client/*.
State management yang terdampak: TanStack Query key ["taxes", activeTab] dipertahankan strukturnya, tapi shape data di dalamnya berubah dari flat array TaxTrack ke array TaxPeriod (dengan TaxObligation ter-include). Optimistic update di updateStatusMutation (onMutate) di TaxTracker.jsx perlu disesuaikan path field yang di-mutate.

9. WebSocket Impact
Event yang sudah ada, payload diperluas:

TAX_UPDATED — saat ini payload: {id, status, updatedAt} (untuk PIC room) dan {id, status, pic_id, updatedAt} (untuk admin room). Diperluas dengan taxType dan obligationId agar frontend punya cukup informasi untuk tahu tab mana yang relevan tanpa harus refetch semua tab. Ini perubahan additive — consumer lama yang hanya membaca id/status tidak akan rusak.
Publisher: backend/services/socketEventBus.js fungsi emitTaxUpdated(), dipanggil dari taxService.js setelah updateTaxTaskStatus (status berubah di level periode) dan assignTaxObligation (PIC berubah di level obligasi, disiarkan ke semua periode anak agar UI yang sedang terbuka langsung lihat PIC baru).
Consumer: frontend/src/components/Tax/TaxTracker.jsx, listener socket.on("TAX_UPDATED", handleTaxUpdate) — logic invalidate/update cache TanStack Query perlu disesuaikan jika ingin memanfaatkan field baru (taxType) untuk invalidasi lebih presisi; saat ini cukup tetap memakai invalidateQueries({queryKey:["taxes"]}) yang menyapu semua tab, tidak wajib diubah untuk MVP.
Tidak ada event baru yang diperlukan untuk fitur ini — perubahan PIC pada obligasi cukup ditumpangkan ke event TAX_UPDATED yang sudah ada, bukan event terpisah.

10. Permission Matrix
RoleActionAllowedAdminBuat obligasi baru✅StaffBuat obligasi baru❌AdminAssign/ubah PIC obligasi✅StaffAssign/ubah PIC obligasi❌AdminUbah status periode pajak (semua)✅StaffUbah status periode pajak (hanya yang dia jadi PIC-nya)✅ (terbatas)StaffUbah status periode pajak milik PIC lain❌AdminSet status ke COMPLETED / APPROVED✅StaffSet status ke COMPLETED / APPROVED❌ (checkApprovalAccess tetap berlaku)AdminLihat semua obligasi/periode lintas PIC✅StaffLihat obligasi/periode yang bukan miliknya❌AdminUpload & konfirmasi import Master Workbook✅StaffUpload & konfirmasi import Master Workbook❌AdminReset seluruh data pajak (clear-all)✅ (rate-limited 3x/jam)StaffReset seluruh data pajak❌AdminLihat history log global✅StaffLihat history log global❌

11. Acceptance Criteria
AC-01

Given seorang Admin membuat obligasi baru untuk klien "PT Maju Jaya" dengan taxType "PPN"

When request POST /api/tax/obligations dikirim dengan clientName dan taxType tersebut

Then satu row baru muncul di tax_obligations dengan frequency = MONTHLY dan 0 periode
AC-02

Given obligasi PPN untuk "PT Maju Jaya" sudah ada

When Admin mencoba membuat obligasi PPN lagi untuk klien yang sama

Then sistem mengembalikan error 409 dan tidak ada row baru tercipta
AC-03

Given klien "PT Maju Jaya" punya obligasi PPh 21 dengan PIC Andi dan obligasi PPN dengan PIC Budi

When Admin mengubah PIC obligasi PPN ke Citra

Then PIC obligasi PPh 21 tetap Andi (tidak ikut berubah), dan PIC obligasi PPN menjadi Citra
AC-04

Given Staff bernama Budi adalah PIC obligasi PPN klien "PT Maju Jaya" tapi BUKAN PIC obligasi PPh 21 klien yang sama

When Budi mencoba mengubah status periode PPh 21 klien tersebut

Then sistem mengembalikan 403 Forbidden
AC-05

Given file Master Workbook diupload berisi sheet PPN dengan 12 kolom bulan untuk klien "PT Maju Jaya"

When Admin konfirmasi import

Then hanya SATU row tercipta di tax_obligations (clientId, "PPN"), dan hingga 12 row tercipta di tax_periods di bawah obligasi tersebut — bukan 12 row terpisah tanpa relasi
AC-06

Given obligasi dengan taxType "1770 OP" (ANNUAL) sudah ada untuk suatu klien

When dua baris import berbeda merujuk periode "2026" dan "TAHUN 2026" untuk obligasi yang sama

Then hanya SATU TaxPeriod tercipta dengan label "TAHUNAN 2026", bukan dua row terpisah
AC-07

Given Admin membuat obligasi PPN untuk klien baru tanpa periode apapun

When Admin membuka Matrix View tab PPN

Then baris klien tersebut muncul dengan semua kolom periode bertanda strip ("-"), bukan hilang dari tampilan
AC-08

Given Admin menjalankan DELETE /api/tax/clear-all dengan konfirmasi yang benar

When request berhasil

Then seluruh row di tax_obligations, tax_periods, dan task_assignments bertipe TAX terhapus, dan satu history log "DELETED_ALL_TAX_DATA" tercatat dengan jumlah yang terhapus
AC-09

Given Staff mengubah status periode pajak dari NOT_STARTED ke COMPLETED

When request dikirim ke endpoint update status

Then sistem menolak dengan 403 karena checkApprovalAccess mensyaratkan role Admin untuk status COMPLETED, terlepas dari apakah Staff tersebut PIC-nya

12. Edge Cases

Import workbook berisi picName yang tidak cocok dengan user manapun di sistem → obligasi tercipta dengan pic_id = null, tidak boleh gagal seluruh baris.
Dua baris import dalam batch yang sama merujuk (client, taxType) yang sama tapi belum ada di lookup cache saat batch dimulai → race kondisi within-batch harus ditangani lewat unique index (clientId, taxType) sebagai safety net, bukan hanya in-memory lookup.
Klien dengan nama yang hampir identik tapi beda kapitalisasi/spasi ("PT Maju Jaya" vs "PT  MAJU JAYA") → ditangani oleh normalizeName() yang sudah ada di clientService.js, tidak berubah oleh fitur ini.
Obligasi ANNUAL menerima periode dengan format yang sama sekali tidak memuat angka tahun (misal hanya "TAHUNAN" tanpa tahun) → harus tetap punya label valid (fallback ke "TAHUNAN" tanpa tahun), tidak boleh menyebabkan row gagal tersimpan.
Admin menghapus akun Staff yang sedang menjadi PIC suatu obligasi → pic_id mengacu user yang sudah tidak ada; perlu definisikan perilaku (set null otomatis, atau larang hapus user yang masih jadi PIC aktif) — belum diputuskan, perlu keputusan eksplisit sebelum implementasi, bukan diasumsikan.
Obligasi dengan status INACTIVE (misal klien berhenti jadi wajib pajak untuk jenis tertentu) — bagaimana ini ditampilkan di Matrix View? Disembunyikan total, atau tetap muncul dengan indikator visual berbeda? Belum didefinisikan requirement-nya secara eksplisit di luar field schema, perlu klarifikasi sebelum implementasi UI.
Concurrent: dua Admin mencoba assign PIC obligasi yang sama di waktu hampir bersamaan → ditangani oleh row locking (transaction.LOCK.UPDATE) yang sudah jadi pola standar di codebase ini.


13. Risk Analysis
RisikoSeverityImpactMitigationTidak ada migration framework formal; production memakai sync({alter:false})HighSkema baru tidak otomatis ter-deploy ke production, developer bisa lupa langkah manualDokumentasikan deployment runbook eksplisit: jalankan sync({alter:true}) sekali secara terkontrol, atau tulis SQL DDL manual sebagai bagian dari rilisHistoryLog.targetType dan TaskAssignment.targetType tetap pakai "TAX" untuk dua entity berbeda (obligation vs period)MediumQuery audit yang tidak hati-hati bisa salah menafsirkan targetId sebagai ID period padahal itu ID obligation, atau sebaliknyaSelalu sertakan metadata.obligationId atau metadata.entityType di setiap log entry; dokumentasikan konvensi ini secara jelas di komentar kodeFrontend TaxMatrixView.jsx parsing periode (parsePeriod) berbasis regex string yang rapuh, belum diuji terhadap label "TAHUNAN <tahun>"MediumSorting kolom periode di Matrix View bisa salah urutan untuk tab ANNUAL (1770 OP, 1771 BADAN)Tambahkan unit test khusus untuk kasus label "TAHUNAN" di parser periode frontend sebelum rilisPenghapusan PUT /api/tax/client/:clientId/assign adalah breaking change bagi siapapun yang memakai endpoint ini (jika ada integrasi eksternal)LowTidak diketahui adanya konsumen eksternal selain frontend internal, tapi tidak terverifikasi 100%Cek log akses endpoint sebelum rilis jika memungkinkan; jika tidak ada cara mengecek, terima risiko karena ini aplikasi internal single-tenantData lama di tax_tracks dihapus permanen tanpa migrasi balikHigh (jika keputusan bisnis berubah)Tidak ada cara mengembalikan riwayat status pajak lama jika ternyata dibutuhkan kembaliSudah dikonfirmasi sebagai keputusan bisnis yang diterima; sebagai mitigasi minimal, lakukan mysqldump manual atas tabel tax_tracks sebelum drop, disimpan di luar sistem produksi sebagai cadangan dinginAuthorization check pindah dari TaxTrack.pic_id ke TaxObligation.pic_id melalui join tambahanMediumJika join salah arah atau lupa di-include, staff bisa salah ditolak/diizinkan mengubah statusWajib ada test eksplisit (FR-04, AC-04) yang menguji staff bukan-PIC ditolak, dan staff PIC diizinkan

14. Technical Implementation Plan
File yang sudah dibuat (verified, tidak perlu dikerjakan ulang):

backend/models/TaxObligation.js
backend/models/TaxPeriod.js
backend/models/index.js (asosiasi sudah benar)
backend/constants/taxFrequency.js (resolveFrequency, normalizePeriodLabel)

File yang akan dimodifikasi:

backend/services/taxService.js — tulis ulang total mengikuti fungsi-fungsi di FR-01 s.d. FR-14
backend/controllers/taxController.js — sesuaikan import dan handler ke fungsi service baru
backend/routes/taxRoutes.js — tambah route obligasi baru, hapus route bulk-assign-per-klien, sesuaikan path id periode
backend/validators/taxSchemas.js — tambah schema untuk endpoint obligasi, sesuaikan schema existing
backend/server.js — hapus import dan pemanggilan backfillTaxClients()
frontend/src/components/Tax/TaxTracker.jsx — sesuaikan fetch function dan mutation
frontend/src/components/Tax/TaxMatrixView.jsx — ubah keying dari clientName ke obligationId, ubah PIC editor target endpoint
frontend/src/components/Tax/TaxListView.jsx — sesuaikan path field data

File yang akan dihapus:

backend/models/TaxTrack.js (sudah dihapus, terverifikasi)
backend/services/bootstrapService.js (jadi dead code, disarankan dihapus daripada dibiarkan menggantung)

Urutan implementasi yang disarankan:

Pastikan model layer (sudah selesai) benar-benar tersinkron ke database development (sync({alter:true}) jalan tanpa error)
Tulis ulang taxService.js lengkap dengan unit test dasar sebelum menyentuh controller
Sesuaikan taxController.js dan taxRoutes.js bersamaan (saling tergantung)
Sesuaikan taxSchemas.js
Jalankan manual smoke test backend lewat Postman/curl untuk setiap endpoint sebelum sentuh frontend
Sesuaikan frontend TaxMatrixView.jsx (paling kompleks), lalu TaxListView.jsx, lalu TaxTracker.jsx
Uji ulang seluruh flow: import workbook → lihat matrix → assign PIC → ubah status → cek history log
Hapus bootstrapService.js dan referensinya di server.js sebagai langkah pembersihan akhir, bukan langkah pertama (agar tidak ada error import yang mengganggu testing di tengah jalan)


15. Testing Plan
Unit test:

taxFrequency.js: resolveFrequency untuk tiap taxType yang dikenal vs tidak dikenal; normalizePeriodLabel untuk berbagai format input tahun pada tipe ANNUAL
taxService.js: findOrCreateObligation (kasus obligasi sudah ada vs belum), createTaxObligation (kasus duplikat → 409), assignTaxObligation (kasus user tujuan tidak ditemukan), updateTaxTaskStatus (kasus ownership ditolak, kasus transisi status invalid)

Integration test:

Import workbook dengan data sintetis berisi satu klien dengan 12 bulan PPN dan 12 bulan PPh 21 → verifikasi hanya 2 row tax_obligations dan 24 row tax_periods tercipta, bukan 24 obligasi
Assign PIC pada satu obligasi → verifikasi obligasi lain milik klien yang sama tidak terpengaruh
Reset clear-all → verifikasi ketiga tabel (tax_obligations, tax_periods, task_assignments bertipe TAX) benar-benar kosong dalam satu assertion setelah panggilan

E2E test:

Skenario penuh: login sebagai Admin → upload Master Workbook → konfirmasi import → buka Matrix View tab PPN → ubah PIC salah satu baris → login sebagai Staff yang baru ditugaskan → ubah status salah satu cell → verifikasi staff lain (bukan PIC) tidak bisa mengubah cell yang sama

Manual test scenario:

Buka Matrix View untuk tab "1770 OP" dan "1771 BADAN" — pastikan kolom periode menunjukkan label tahunan, bukan kolom bulanan kosong 11 dari 12
Buat obligasi manual lewat UI (jika ada form-nya) untuk klien yang belum pernah diimpor, pastikan baris muncul kosong di matrix sesuai keputusan FR-11/AC-07
Refresh browser di dua sesi berbeda (Admin dan Staff) secara bersamaan, ubah PIC dari sesi Admin, pastikan sesi Staff menerima event TAX_UPDATED dan PIC ter-update tanpa perlu refresh manual