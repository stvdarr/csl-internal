# WORKLOAD_FEATURE_PLAN.md
## Sistem: Catat Susun Lapor (CSL)
## Versi 1.0

---

## Executive Summary

Fitur Workload Management akan dibangun di atas data yang sudah ada dan sudah lengkap — `TaxObligation.pic_id`, `TaxPeriod.status`, `ToDo.pic_id`/`status`, `TaskAssignment` (riwayat reassignment), dan `HistoryLog` (riwayat perubahan status). Tidak ada satupun tabel baru yang dibutuhkan untuk current workload maupun historical performance.

Temuan paling penting dari analisis: sistem ini sudah punya fungsi `getWorkloadSummary()` dan endpoint `GET /api/tax/workload`, lengkap dan berfungsi di backend — tapi tidak pernah dipanggil dari frontend manapun, dan hanya menghitung TaxPeriod, mengabaikan ToDo sepenuhnya. Fitur ini bukan membangun dari nol, melainkan memperluas dan akhirnya mengekspos kapabilitas yang sudah setengah jadi.

Temuan kedua yang krusial: PIC (`pic_id`) pada `TaxObligation` dan `ToDo` adalah field mutable tanpa snapshot. Tidak ada baris manapun di `HistoryLog` yang merekam "siapa PIC saat status ini berubah." Ini berarti aturan bisnis "perubahan PIC tidak mengubah workload historis" tidak otomatis benar dengan struktur data saat ini — perlu penambahan kecil (bukan tabel baru) untuk menjaminnya, dijelaskan di bagian Workload Design.

---

## Business Goal

Memberi visibilitas akurat atas beban kerja tiap staff untuk: (1) mendukung keputusan assignment baru, (2) mencegah satu staff kelebihan beban sementara yang lain kosong, (3) memberi Admin (yang berperan sebagai supervisor/manager pada sistem ini — lihat catatan peran di Permission Matrix) alat bantu distribusi kerja yang konkret, bukan tebakan.

---

## Current State Analysis

### Assignment flow (terverifikasi, identik untuk TAX dan TODO)

Pola assignment di sistem ini konsisten di dua domain:
- Tax: `assignTaxObligation()` di `taxService.js` — mengubah `TaxObligation.pic_id` langsung (in-place, tidak versioned), membuat satu baris `TaskAssignment` (`fromUserId`, `toUserId`, `assignedById`, `reason`), broadcast `TAX_UPDATED` via socket ke `user_{pic_id}` dan `admin_room`.
- ToDo: `assignTodoTask()` di `todoService.js` — pola identik: ubah `ToDo.pic_id` in-place, buat `TaskAssignment` (`targetType: "TODO"`), broadcast `TODO_UPDATED`.

PIC pada Tax di-assign di level `TaxObligation` (satu PIC untuk semua periode di bawah satu obligasi pajak — hasil dari restrukturisasi sebelumnya), bukan per `TaxPeriod`. PIC pada ToDo di-assign di level `ToDo` itu sendiri (granularitas tunggal, tidak ada sub-entity).

### Tax flow (terverifikasi)

`TaxObligation` (clientId, taxType, frequency, pic_id) memiliki banyak `TaxPeriod` (obligationId, period, status, amount). State machine status `TaxPeriod` (`taskStatus.js`): 10 status, `COMPLETED` adalah satu-satunya status terminal (`VALID_TRANSITIONS.COMPLETED = []`). Status lain seperti `WAITING_REVIEW`, `WAITING_CLIENT`, `WAITING_SIGNATURE`, `BLOCKED`, `FILED`, `PAID` semuanya bukan terminal — bisa kembali ke status lain.

### ToDo flow (terverifikasi)

`ToDo` (clientName, jobType, status, pic_id, deadline). State machine status (`todoStatus.js`): 4 status (`TODO, ONGOING, DONE, APPROVED`). Catatan penting yang sering salah diasumsikan: `DONE` BUKAN status terminal — `TODO_VALID_TRANSITIONS.DONE = ["ONGOING"]`, artinya tugas yang sudah `DONE` masih bisa dikembalikan ke `ONGOING`. Hanya `APPROVED` yang terminal (`TODO_VALID_TRANSITIONS.APPROVED = []`), dan transisi ke `APPROVED` hanya bisa dilakukan Admin (`validateTodoTransition`). Ini berarti definisi "selesai" untuk ToDo dan untuk Tax menggunakan kata kunci status yang berbeda — workload engine harus tahu ini secara eksplisit per entity type, tidak bisa menyamakan "status terakhir di daftar enum" sebagai terminal untuk keduanya.

### Authentication & Authorization (terverifikasi)

JWT via cookie/header (`verifyToken`), dua role saja: `ROLES.ADMIN = "Admin"`, `ROLES.STAFF = "Staff"` (`backend/constants/roles.js`). Tidak ada role Supervisor atau Manager di sistem ini. Permintaan fitur menyebut "supervisor dan manager" sebagai pengguna — pada sistem ini, peran tersebut secara fungsional dipegang oleh role Admin yang sudah ada. Dokumen ini tidak merekomendasikan penambahan role baru karena tidak ada bukti kebutuhan teknis untuk itu di luar penamaan use case; jika ke depannya benar-benar dibutuhkan pembedaan Supervisor vs Manager vs Admin, itu adalah keputusan terpisah yang harus dibahas eksplisit, bukan diasumsikan sebagai bagian dari fitur ini.

Ownership check konsisten di kedua domain: Staff hanya bisa mengubah resource yang `pic_id`-nya adalah dirinya sendiri; Admin bisa semua. `checkApprovalAccess` middleware mengunci status final (`COMPLETED` untuk Tax, `APPROVED` untuk ToDo) hanya untuk Admin — dipasang di route (`PUT /tax/periods/:periodId/status` memakai `checkApprovalAccess` setelah `validateRequest`).

### WebSocket (terverifikasi)

`socketEventBus.js`: dua event (`TAX_UPDATED`, `TODO_UPDATED`), konvensi room `user_{id}` (personal) dan `admin_room` (broadcast ke semua admin). Tidak ada redis adapter aktif (kode untuk itu ada tapi di-comment, untuk skenario multi-instance scaling nanti).

### Dashboard & Reporting yang ada (terverifikasi)

`Dashboard.jsx` punya 5 tab: `CLIENT, TAX, TODO, HISTORY, ADMIN`. Tab HISTORY menampilkan `HistoryLogViewer` — daftar mentah `HistoryLog` (paginated, Admin-only, tanpa agregasi apapun). Tab ADMIN hanya berisi form registrasi staff dan daftar staff — tidak ada widget, chart, atau angka ringkasan apapun di seluruh dashboard saat ini. Tidak ada satupun bentuk "reporting" di luar log mentah ini.

Temuan kunci: `getWorkloadSummary()` di `taxService.js` dan endpoint `GET /api/tax/workload` di `taxRoutes.js` sudah ada, lengkap, dan berfungsi — tapi (1) hanya menghitung `TaxPeriod` yang `status !== "COMPLETED"`, (2) sengaja memfilter `role: ROLES.STAFF` saja sehingga Admin yang menjadi PIC tidak terhitung, (3) tidak pernah dipanggil dari frontend manapun (diverifikasi lewat pencarian penuh di seluruh `frontend/src/`). Fitur ini bukan dimulai dari nol.

---

## Existing Data Model Analysis

| Model | Field relevan | Peran dalam Workload |
|---|---|---|
| User | id, name, email, role | Subjek yang diukur workload-nya. Hanya `role` (Admin/Staff) yang membedakan, tidak ada field kapasitas/jam kerja apapun saat ini. |
| Client | id, name | Tidak langsung relevan ke workload, hanya konteks (nama klien ditampilkan di breakdown). |
| TaxObligation | id, clientId, taxType, frequency, pic_id | Sumber utama Current Workload sisi Tax. Satu pic_id = satu PIC untuk seluruh periode di bawahnya. PIC mutable, tidak versioned. |
| TaxPeriod | id, obligationId, period, status, amount | Unit kerja aktual yang dihitung. Status COMPLETED = selesai (terminal, satu-satunya). |
| ToDo | id, pic_id, status, jobType, deadline | Sumber utama Current Workload sisi ToDo. PIC di level ToDo itu sendiri, mutable, tidak versioned. Status APPROVED = selesai (terminal, satu-satunya — BUKAN DONE). |
| TaskAssignment | targetType, targetId, fromUserId, toUserId, assignedById, createdAt | Sumber kebenaran untuk riwayat siapa-pernah-jadi-PIC-kapan. Polimorfik (TAX/TODO), satu baris per event reassignment. |
| HistoryLog | actorId, targetType, targetId, recordType, recordId, oldStatus, newStatus, metadata, createdAt | Sumber kebenaran untuk riwayat perubahan status, termasuk siapa (actorId) yang melakukan perubahan status terakhir. GAP YANG DITEMUKAN: metadata saat ini hanya berisi {oldStatus, newStatus} — TIDAK merekam siapa pic_id obligasi/todo pada saat status berubah. actorId adalah siapa yang MENGKLIK tombol ubah status, yang bisa berbeda dari PIC yang sebenarnya mengerjakan (misal Admin yang melakukan approval final). |

Model yang dapat digunakan kembali tanpa perubahan struktur: User, Client (sebagai konteks tampilan), TaxObligation, TaxPeriod, ToDo, TaskAssignment, HistoryLog — keenamnya cukup untuk current workload dan historical performance lewat query agregasi, bukan tabel baru.

---

## Workload Design

### Bagaimana workload dihitung

Dua angka yang harus dibedakan tegas sesuai instruksi:

Current Workload = COUNT semua unit kerja aktif yang PIC-nya (HARI INI, dari pic_id saat ini) adalah user tersebut, di mana:
- Untuk TaxPeriod: status != 'COMPLETED'
- Untuk ToDo: status != 'APPROVED'

Ini murni query agregasi langsung terhadap state saat ini (TaxObligation.pic_id JOIN TaxPeriod.status, ToDo.pic_id/status). Tidak butuh data historis sama sekali — selalu mencerminkan kondisi real-time, otomatis benar setiap kali PIC berubah karena yang dibaca adalah pic_id kolom saat ini, bukan snapshot.

Historical Performance = COUNT unit kerja yang berhasil mencapai status terminal (COMPLETED/APPROVED), dikreditkan ke siapa yang berperan sebagai PIC pada unit kerja tersebut saat unit kerja itu diselesaikan, bukan PIC saat ini.

### Bagaimana menangani perubahan PIC (poin paling kritis)

Ini bagian yang membutuhkan keputusan desain eksplisit, karena struktur data saat ini tidak otomatis menjamin aturan bisnis "task selesai tetap menjadi kredit yang menyelesaikannya, walau PIC berubah setelahnya."

Masalah konkret: Jika TaxObligation X di-assign ke User A, lalu 10 periode di bawahnya diselesaikan oleh A, lalu Admin reassign obligasi tersebut ke User B (untuk periode-periode baru ke depan) — query historical performance yang naif (JOIN TaxObligation ON pic_id) akan salah mengkreditkan 10 periode lama itu ke User B, karena pic_id sudah berubah jadi B. Ini melanggar langsung aturan bisnis yang diminta.

Tiga opsi, dengan trade-off:

**Opsi 1 — Derivasi dari TaskAssignment time-range join (tidak butuh perubahan skema).**
Untuk setiap HistoryLog dengan newStatus = COMPLETED/APPROVED, cari TaskAssignment dengan targetType+targetId yang sama, toUserId, dan createdAt <= log.createdAt, ambil yang createdAt paling besar (assignment terakhir sebelum completion). Itu adalah PIC yang sah dikreditkan.
- Kelebihan: nol perubahan skema, memanfaatkan data yang sudah ada 100%.
- Kekurangan: query lebih kompleks (correlated subquery per log entry), dan rapuh terhadap kasus tepi: obligasi yang dibuat tanpa baris TaskAssignment awal (seharusnya tidak terjadi berdasarkan kode saat ini, tapi perlu dipastikan tidak ada jalur lain yang membuat pic_id tanpa membuat TaskAssignment).

**Opsi 2 — Tambah snapshot pada HistoryLog.metadata saat completion (perubahan kecil, BUKAN tabel baru).**
Saat status diubah ke COMPLETED/APPROVED, sertakan picIdAtCompletion di metadata JSON yang sudah ada. Untuk data baru ke depan, historical performance jadi query langsung tanpa join time-range. Untuk data lama yang sudah ada sebelum perubahan ini, tetap perlu fallback ke Opsi 1 (atau dianggap tidak presisi untuk data historis pra-fitur, didokumentasikan sebagai keterbatasan yang diterima).
- Kelebihan: query depan jauh lebih sederhana dan cepat, tidak ada ambiguitas untuk data baru.
- Kekurangan: butuh sedikit perubahan kode di titik penulisan logActivity saat completion (bukan tabel baru, hanya menambah satu field di payload metadata yang sudah ada), dan data historis sebelum perubahan ini tetap harus pakai Opsi 1 sebagai fallback.

**Opsi 3 — Tabel baru WorkCredit yang mencatat setiap completion sebagai baris terpisah.**
- Kelebihan: paling eksplisit dan mudah di-query.
- Kekurangan: melanggar langsung instruksi untuk menghindari tabel baru dan duplikasi data — ini murni duplikasi dari informasi yang sudah ada di HistoryLog + TaskAssignment. Tidak direkomendasikan.

**Rekomendasi: Opsi 2 sebagai mekanisme utama untuk data ke depan, dengan Opsi 1 sebagai fallback read-path untuk data historis yang sudah ada sebelum fitur ini dibangun.** Ini paling sesuai dengan instruksi eksplisit untuk menghindari tabel baru, sekaligus menjamin akurasi jangka panjang tanpa bergantung pada query correlated subquery yang mahal untuk setiap completion baru.

### Bagaimana menangani task selesai

Task yang sudah mencapai status terminal berhenti dihitung di Current Workload secara otomatis (konsekuensi alami dari definisi di atas, tidak butuh logic "exclude" tambahan). Task tersebut mulai dihitung di Historical Performance pada saat itu juga, dikreditkan sesuai mekanisme di atas.

### Bagaimana menangani assignment ulang

Saat assignTaxObligation/assignTodoTask dipanggil:
1. TaskAssignment baru tercipta (sudah terjadi di kode saat ini, tidak berubah).
2. Current Workload User lama (fromUserId) otomatis berkurang pada query berikutnya, karena semua TaxPeriod/ToDo aktif di bawah obligasi/todo itu sekarang ikut pic_id baru.
3. Periode/todo yang SUDAH COMPLETED/APPROVED sebelum reassignment ini TIDAK ikut pindah secara kredit — historical performance User lama tetap utuh.
4. Broadcast WORKLOAD_UPDATED (event baru, lihat Websocket Changes) ke kedua user (lama dan baru) serta admin_room, supaya dashboard workload yang terbuka langsung ter-update tanpa refresh.

---

## Current Workload Rules

1. Hanya menghitung unit kerja dengan pic_id SAAT INI sama dengan user yang diukur.
2. Status non-terminal saja yang dihitung (TaxPeriod.status != COMPLETED, ToDo.status != APPROVED).
3. Tax dihitung di level TaxPeriod (bukan TaxObligation) — satu obligasi dengan 5 periode aktif menyumbang 5 ke Current Workload, bukan 1, karena beban kerja nyata ada di level periode (tiap bulan harus diurus terpisah).
4. ToDo dihitung di level ToDo itu sendiri (granularitas tunggal, tidak ada sub-unit).
5. Current Workload selalu real-time — tidak ada cache/snapshot yang bisa basi, langsung dari query pic_id kolom saat ini.

## Historical Performance Rules

1. Hanya menghitung unit kerja yang mencapai status terminal (COMPLETED untuk Tax, APPROVED untuk ToDo).
2. Kredit diberikan ke PIC yang sah saat completion terjadi (lihat mekanisme Opsi 2 + fallback Opsi 1 di atas), BUKAN PIC saat ini.
3. Reassignment setelah completion tidak pernah mengubah kredit historis — ini berlaku permanen, tidak ada mekanisme "pindah kredit" di sistem ini.
4. Historical Performance bisa difilter berdasarkan rentang tanggal (HistoryLog.createdAt), berguna untuk laporan periodik tanpa perlu tabel agregasi terpisah — dihitung on-demand dari HistoryLog.

---

## Capacity Classification

Sistem saat ini tidak punya konsep kapasitas maksimum per staff (tidak ada field seperti maxCapacity di User). Klasifikasi harus dibangun di atas data yang ada, bukan menambah field arbitrer tanpa dasar.

Rekomendasi: skema threshold berbasis jumlah unit aktif (sederhana, transparan, mudah dijelaskan ke staff), bukan skor berbobot (weighted score) yang lebih rumit untuk versi pertama:

| Klasifikasi | Kriteria (jumlah unit aktif: TaxPeriod + ToDo non-terminal) | Catatan |
|---|---|---|
| Low | 0-4 | Staff punya slot kosong, kandidat utama untuk assignment baru |
| Normal | 5-10 | Beban wajar |
| High | 11-15 | Mendekati batas, assignment baru sebaiknya dipertimbangkan ke staff lain dulu |
| Overloaded | 16+ | Perlu intervensi — redistribusi sebagian task atau eskalasi ke Admin |

Mengapa bukan weighted score untuk versi pertama: Weighted score (misal BLOCKED bernilai 2x, WAITING_CLIENT bernilai 0.5x karena menunggu pihak luar) terdengar lebih akurat, tapi membutuhkan bobot yang tidak ada dasarnya dari data historis sistem ini saat ini — tidak ada pengukuran waktu pengerjaan riil per status untuk mengkalibrasi bobot tersebut secara empiris. Memaksakan bobot tanpa data akan menghasilkan angka yang terlihat presisi tapi sebenarnya tebakan, lebih berbahaya daripada count sederhana yang jujur soal keterbatasannya.

Rekomendasi evolusi: Setelah fitur ini berjalan beberapa bulan dan HistoryLog terkumpul cukup data durasi-per-status, baru pertimbangkan weighted score berbasis rata-rata waktu penyelesaian aktual per status/taxType. Threshold angka di atas juga harus dianggap starting point yang divalidasi ulang oleh Admin CSL berdasarkan pengalaman riil tim, bukan angka final — sediakan sebagai konstanta yang mudah diubah, bukan keputusan keras di level kode.

---

## Permission Matrix

| Role | Action | Allowed |
|---|---|---|
| Admin | Melihat Current Workload semua staff | Ya |
| Staff | Melihat Current Workload semua staff (transparansi tim) | Direkomendasikan Ya, tapi keputusan bisnis terbuka — lihat Edge Cases |
| Staff | Melihat Current Workload dirinya sendiri | Ya |
| Admin | Melihat Historical Performance semua staff | Ya |
| Staff | Melihat Historical Performance dirinya sendiri | Ya |
| Staff | Melihat Historical Performance staff lain | Tidak (kecuali keputusan bisnis di atas membuka transparansi tim) |
| Admin | Melihat breakdown workload per klien/jenis pajak | Ya |
| Staff | Melihat breakdown workload per klien/jenis pajak (miliknya sendiri) | Ya |
| Admin | Mengubah klasifikasi threshold | Ya (lewat konfigurasi, bukan UI form di versi pertama) |
| Staff | Mengubah klasifikasi threshold | Tidak |
| Admin | Menggunakan data workload sebagai dasar assignment | Ya |
| Staff | Assign task ke user lain | Tidak (tidak berubah dari aturan yang sudah ada) |

Catatan: matrix ini mengikuti persis pola permission yang sudah ada di taxService.js/todoService.js (pic_id scoping untuk Staff, akses penuh untuk Admin) — tidak menciptakan aturan baru di luar pola tersebut kecuali eksplisit ditandai sebagai "keputusan bisnis terbuka."

---

## Database Changes

Tidak ada tabel baru. Perubahan yang dibutuhkan:

1. HistoryLog.metadata (kolom JSON yang sudah ada, tidak perlu ALTER TABLE) — tambahkan key picIdAtCompletion pada payload yang dikirim saat logging completion event (COMPLETED untuk Tax, APPROVED untuk ToDo). Ini perubahan di kode penulisan (taxService.js, todoService.js), bukan perubahan skema database.
2. Index tambahan yang disarankan (bukan wajib, tapi akan dibutuhkan begitu volume HistoryLog bertambah): composite index (actorId, createdAt) atau (targetType, newStatus, createdAt) pada history_logs untuk mempercepat query historical performance per rentang tanggal.
3. Tidak ada perubahan pada User, TaxObligation, TaxPeriod, ToDo, TaskAssignment — keempatnya dipakai apa adanya.

---

## Backend Changes

### Service

- backend/services/workloadService.js (BARU) — service terpisah yang menggabungkan data dari TaxObligation, TaxPeriod, ToDo, TaskAssignment, HistoryLog (semua sudah diimpor di models/index.js, tidak ada model baru). Fungsi: getCurrentWorkload({currentUser, targetUserId}), getHistoricalPerformance({currentUser, targetUserId, dateFrom, dateTo}), getWorkloadBreakdown({userId}), classifyCapacity(activeCount).
- backend/services/taxService.js — getWorkloadSummary() yang sudah ada DIPERTAHANKAN sebagai fungsi internal Tax-only (dipakai workloadService.js sebagai salah satu sumber data), TIDAK dihapus. Tambahkan logging picIdAtCompletion di titik logActivity untuk UPDATED_STATUS ketika newStatus === "COMPLETED".
- backend/services/todoService.js — tambahkan logging picIdAtCompletion yang sama di titik logActivity untuk UPDATED_STATUS ketika newStatus === "APPROVED".

### Controller

- backend/controllers/workloadController.js (BARU) — handler tipis memanggil workloadService.js, mengikuti pola try-catch konsisten dengan taxController.js/todoController.js.

### Route

- backend/routes/workloadRoutes.js (BARU) — didaftarkan di server.js dengan prefix /api/workload, memakai verifyToken di semua route (pola sama dengan historyRoutes.js).

### Validator

- backend/validators/workloadSchemas.js (BARU) — schema untuk query param dateFrom/dateTo/userId opsional, mengikuti pola Zod yang sama dengan taxSchemas.js.

---

## Frontend Changes

### Halaman/komponen baru

- frontend/src/components/Workload/WorkloadDashboard.jsx (BARU) — komponen utama, ditambahkan sebagai tab baru di Dashboard.jsx.
- frontend/src/components/Workload/WorkloadCard.jsx (BARU) — satu card per staff, Current Workload count + badge klasifikasi.
- frontend/src/components/Workload/WorkloadBreakdown.jsx (BARU) — rincian per klien/jenis pajak/jobType saat card diklik.
- frontend/src/components/Workload/PerformanceHistory.jsx (BARU) — Historical Performance dengan filter rentang tanggal.

### Komponen yang diubah

- frontend/src/pages/Dashboard.jsx — tambah satu entri di array tabs, satu baris render kondisional, mengikuti pola yang sudah ada untuk tab lain.
- Pertimbangan integrasi ke TaxMatrixView.jsx/ToDoList.jsx (opsional, iterasi kedua): saat Admin membuka modal assign PIC, tampilkan Current Workload calon PIC di samping nama.

### State management

Mengikuti pola TanStack Query yang sudah dipakai di seluruh aplikasi — query key ["workload", "current"] dan ["workload", "history", dateRange], invalidated oleh event websocket baru.

---

## Websocket Changes

Event baru: WORKLOAD_UPDATED, ditambahkan ke socketEventBus.js mengikuti pola emitTaxUpdated/emitTodoUpdated — fungsi baru emitWorkloadUpdated(userId).

Publisher: Dipanggil dari assignTaxObligation, assignTodoTask (setiap kali pic_id berubah, baik fromUserId maupun toUserId), dan dari updateTaxTaskStatus/updateTodoTaskStatus setiap kali transisi masuk atau keluar dari status terminal.

Consumer: WorkloadDashboard.jsx listen event ini, invalidate query ["workload", "current"] — tidak perlu patch manual ke cache, mengikuti pola yang sudah ada untuk data agregat.

Payload: {userId, source: "TAX" | "TODO"} — cukup memberi tahu "workload user ini mungkin berubah," biarkan frontend re-fetch angka aktual daripada mengirim angka final lewat socket (menghindari race condition antara emit dan commit transaksi database).

---

## API Design

| Method | Path | Perubahan | Keterangan |
|---|---|---|---|
| GET | /api/workload/current | BARU | Current Workload semua staff (Admin) atau diri sendiri (Staff), query opsional userId untuk Admin |
| GET | /api/workload/current/:userId/breakdown | BARU | Rincian per klien/taxType/jobType untuk satu user |
| GET | /api/workload/history | BARU | Historical Performance, query param dateFrom, dateTo, userId opsional |
| GET | /api/tax/workload | DIPERTAHANKAN, tidak dihapus | Endpoint lama tetap ada untuk backward compatibility, tapi tidak lagi dipromosikan sebagai endpoint utama |

---

## UI/UX Proposal

Mengikuti bahasa visual yang sudah ada di TaxMatrixView.jsx dan Dashboard.jsx (Tailwind, palet warna slate/blue, badge rounded-full).

Tampilan utama (tab "Beban Kerja"): Grid card, satu card per staff. Tiap card: nama staff, jumlah total aktif besar di tengah, badge klasifikasi warna (Low=hijau, Normal=biru, High=kuning, Overloaded=merah — pola warna sama dengan warna status COMPLETED/BLOCKED yang sudah dipakai di Matrix View). Klik card -> expand rincian (TaxPeriod count vs ToDo count, breakdown per klien).

Tampilan sekunder (sub-tab "Riwayat Performa"): Tabel sederhana per staff — jumlah completion dalam rentang tanggal yang dipilih. Tidak perlu chart kompleks untuk versi pertama — tidak ada library charting yang sudah terpasang di package.json frontend, menambah satu hanya untuk fitur ini adalah biaya tambahan yang belum tentu sepadan di tahap awal.

Untuk Staff (bukan Admin): Tampilkan hanya card dirinya sendiri secara default, dengan opsi melihat ringkasan tim (hanya angka, tanpa breakdown detail staff lain) jika keputusan permission membuka transparansi tim.

---

## Edge Cases

1. Staff resign/dihapus sementara masih jadi PIC aktif di beberapa obligasi/todo. Tidak ada mekanisme penghapusan user yang ditemukan (User tidak punya soft-delete). Di luar scope fitur ini, tapi dicatat sebagai risiko terkait.
2. Obligasi/todo dengan pic_id = null (state valid menurut model — pic_id nullable di TaxObligation). Pekerjaan ini tidak masuk hitungan siapapun — harus ditampilkan terpisah sebagai "Belum di-assign," bukan hilang dari pandangan Admin.
3. Reassignment terjadi di tengah transaksi status change (race condition). Row locking yang sudah ada (transaction.LOCK.UPDATE) menangani konsistensi data, tapi urutan event WORKLOAD_UPDATED bisa menyebabkan UI sempat tidak konsisten sesaat sebelum refetch settle — diterima sebagai batasan eventual consistency yang sudah ada secara implisit di seluruh sistem.
4. ToDo.status = DONE (bukan APPROVED) dihitung sebagai aktif, bukan selesai. Konsisten dengan state machine yang ada, tapi staff mungkin bingung kenapa tugas yang "sudah selesai dia kerjakan" masih terhitung aktif. Perlu tooltip/penjelasan di UI, bukan perubahan logic.
5. Data historis dari sebelum picIdAtCompletion ditambahkan tidak punya field ini — harus fallback ke Opsi 1 (time-range join), bukan dianggap error atau diabaikan.
6. Klien dengan banyak TaxObligation lintas tipe pajak, masing-masing PIC berbeda — sudah ditangani natural karena Current Workload dihitung per TaxObligation.pic_id, bukan per klien.
7. Admin yang juga menjadi PIC (kasus yang saat ini sengaja dikecualikan getWorkloadSummary() lama lewat filter role: ROLES.STAFF) — keputusan untuk fitur baru: TERMASUKKAN, karena tidak ada alasan bisnis yang ditemukan untuk mengecualikan Admin yang aktif menjadi PIC.

---

## Acceptance Criteria

AC-01
Given User A adalah PIC TaxObligation dengan 3 TaxPeriod berstatus IN_PROGRESS, WAITING_CLIENT, COMPLETED
When GET /api/workload/current dipanggil untuk User A
Then Current Workload User A menghitung 2 (yang COMPLETED tidak ikut)

AC-02
Given User A adalah PIC ToDo berstatus DONE
When GET /api/workload/current dipanggil
Then ToDo tersebut tetap terhitung sebagai aktif (karena DONE bukan status terminal), bukan dianggap selesai

AC-03
Given TaxPeriod diselesaikan (COMPLETED) oleh User A pada tanggal 1 Juni, lalu obligasinya di-reassign ke User B pada tanggal 15 Juni
When GET /api/workload/history?userId=A dipanggil dengan rentang tanggal yang mencakup 1 Juni
Then periode tersebut tetap muncul sebagai kredit milik User A, bukan User B, terlepas dari TaxObligation.pic_id saat ini sudah menjadi B

AC-04
Given Staff (bukan Admin) memanggil GET /api/workload/history?userId=idStaffLain
When request dikirim
Then ditolak (403) sesuai Permission Matrix, kecuali query tanpa userId (default ke dirinya sendiri) yang tetap diizinkan

AC-05
Given TaxObligation.pic_id = null (belum di-assign)
When GET /api/workload/current dipanggil oleh Admin
Then obligasi tersebut tidak dihitung ke siapapun, tapi muncul di kategori terpisah "Belum di-assign" pada response

AC-06
Given Admin menjadi pic_id aktif pada suatu TaxObligation
When GET /api/workload/current dipanggil
Then Admin tersebut termasuk dalam hasil (berbeda dari perilaku getWorkloadSummary() lama yang mengecualikan Admin)

---

## Migration Strategy

Tidak ada migrasi skema yang mengubah struktur tabel (tidak ada ALTER TABLE untuk kolom baru — metadata JSON sudah ada dan fleksibel menerima key baru tanpa migrasi). Langkah migrasi yang dibutuhkan hanya pada level kode, bertahap:

1. Deploy picIdAtCompletion logging di taxService.js/todoService.js terlebih dahulu, sebelum endpoint workload baru dirilis ke frontend — supaya begitu fitur UI tayang, sudah ada beberapa hari/minggu data baru yang lengkap dengan field ini.
2. Deploy workloadService.js + endpoint baru, backward compatible (tidak menyentuh /api/tax/workload lama sama sekali).
3. Deploy UI baru terakhir, setelah backend terverifikasi lewat manual testing/API call langsung.

Tidak perlu downtime, tidak perlu backfill data lama secara paksa — data lama tetap bisa dilayani lewat fallback Opsi 1 selamanya jika diperlukan.

---

## Testing Strategy

Tidak ada satupun automated test untuk domain Tax/ToDo di repository ini saat ini (hanya ada script test untuk fitur Client Profile import) — fitur ini sebaiknya jadi kesempatan mulai membangun test coverage:

- Unit: classifyCapacity() (boundary value tiap threshold), fungsi penghitungan Current Workload terisolasi dari DB (mock data array, cek count benar untuk kombinasi status terminal/non-terminal).
- Integration: Skenario AC-03 secara end-to-end (buat obligasi, selesaikan periode oleh User A, reassign ke User B, verifikasi historical performance tetap mengkredit A) — satu skenario paling kritis yang harus punya test otomatis karena butuh urutan waktu spesifik untuk terdeteksi, sulit ketahuan lewat manual testing biasa.
- Manual: Buka tab Beban Kerja sebagai Admin, verifikasi semua staff (termasuk Admin yang jadi PIC) muncul; buka sebagai Staff, verifikasi hanya melihat data sesuai Permission Matrix; trigger reassignment dari UI lain (Matrix View), verifikasi dashboard workload update otomatis lewat websocket tanpa refresh manual.

---

## Risk Analysis

| Risiko | Severity | Mitigasi |
|---|---|---|
| Threshold klasifikasi bersifat tebakan awal tanpa data empiris, bisa salah kalibrasi dan membuat staff merasa diberi label tidak adil | Medium | Jadikan threshold konfigurasi yang mudah diubah Admin, komunikasikan ke tim bahwa angka ini starting point bukan final |
| Data historis sebelum picIdAtCompletion ditambahkan harus fallback ke query time-range join yang lebih mahal, bisa lambat jika HistoryLog sudah besar | Low-Medium | Composite index tambahan, atau batasi laporan historis lama hanya untuk rentang tanggal reasonable |
| Mengubah getWorkloadSummary() lama bisa berdampak ke konsumen yang tidak ditemukan dalam analisis ini jika ada pemanggilan tersembunyi yang terlewat | Low | Sudah diverifikasi exhaustif lewat pencarian penuh frontend/src/ tanpa hasil — sebagai mitigasi tambahan, endpoint lama /api/tax/workload dipertahankan apa adanya, endpoint baru dibuat terpisah |
| Event WORKLOAD_UPDATED yang terlalu sering ter-trigger bisa membuat dashboard re-fetch berlebihan jika banyak staff aktif bersamaan | Low | Pertimbangkan debounce di sisi frontend sebelum invalidate jika beberapa event masuk berurutan |
| Klien membaca "Overloaded" sebagai penilaian performa, bukan sekadar volume kerja, berpotensi menimbulkan persepsi tidak adil antar staff | Medium | UI harus jelas membedakan "volume pekerjaan aktif" dari "kualitas/performa" (yang tidak diukur fitur ini) — hindari framing yang terasa seperti rapor kerja |

---

## Recommended Implementation Order

1. Tambah logging picIdAtCompletion di taxService.js dan todoService.js (perubahan kecil, deploy paling awal supaya data mulai terkumpul sebelum fitur lain bergantung padanya)
2. Bangun workloadService.js (Current Workload dulu — lebih sederhana, tidak butuh logic fallback historis)
3. Bangun fungsi Historical Performance di workloadService.js, termasuk fallback Opsi 1 untuk data lama
4. Controller + route + validator (workloadController.js, workloadRoutes.js, workloadSchemas.js)
5. Test integration untuk skenario AC-03 (paling kritis, kerjakan sebelum lanjut ke frontend supaya bug logic ketahuan lebih awal)
6. Event websocket WORKLOAD_UPDATED di socketEventBus.js + titik pemanggilannya di kedua service
7. Frontend: WorkloadDashboard.jsx + WorkloadCard.jsx (Current Workload dulu, paling sering dipakai)
8. Frontend: WorkloadBreakdown.jsx, PerformanceHistory.jsx (fitur sekunder, bisa menyusul)
9. Tambah tab baru di Dashboard.jsx
10. Manual testing penuh lintas role (Admin, Staff) sesuai Permission Matrix sebelum dianggap selesai
