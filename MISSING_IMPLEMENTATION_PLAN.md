# MISSING_IMPLEMENTATION_PLAN.md
## Client-Based Tax Track — Sisa Pekerjaan
**Tanggal analisis:** berdasarkan snapshot repository `seluruh_kode_proyek.txt` (89 file, 100% dianalisis)

---

## Executive Summary

Implementasi fitur Client-Based Tax Track (restrukturisasi `TaxTrack` flat menjadi `TaxObligation` + `TaxPeriod`) **sudah jauh lebih lengkap** dari yang diasumsikan sebelumnya. Model, service layer, controller, route, validator, dan tiga komponen frontend utama (`TaxTracker.jsx`, `TaxMatrixView.jsx`, `TaxListView.jsx`) semuanya sudah ditulis ulang dan secara struktural konsisten satu sama lain — bukan stub atau kerangka kosong.

Sisa pekerjaan yang terverifikasi nyata ada di tiga area: **(1)** dua kapabilitas backend yang sudah selesai tapi tidak punya jalan masuk dari UI (membuat obligasi manual, dan melihat semua jenis pajak satu klien sekaligus), **(2)** pembersihan sisa model lama (`TaxTrack`) yang seharusnya sudah dihapus sesuai keputusan bisnis tapi masih tertinggal di `models/index.js`, dan **(3)** ketiadaan total automated test untuk seluruh fitur ini.

Tidak ditemukan bug fungsional pada jalur data utama (import Excel → obligasi+periode, assign PIC, update status, permission check). Risiko deployment terkait sinkronisasi skema database tetap belum dimitigasi secara formal.

---

## Remaining Work

1. UI untuk membuat `TaxObligation` secara manual (endpoint sudah ada, form belum ada)
2. UI untuk melihat overview semua jenis pajak per klien (endpoint sudah ada, tampilan belum ada)
3. Hapus model `TaxTrack` dan seluruh referensinya dari `models/index.js`
4. Hapus `backend/services/bootstrapService.js` (dead code, tidak dipanggil dari manapun)
5. Jalankan `DROP TABLE tax_tracks;` secara manual di database setelah model dihapus dari kode
6. Tangani edge case kolom matrix kosong saat seluruh obligasi di satu tab belum punya periode
7. Bersihkan `MONTHLY_TAX_TYPES` yang dead code di `taxFrequency.js` (atau benar-benar pakai untuk validasi)
8. Buat automated test (minimal e2e script) khusus untuk fitur tax obligation/period
9. Dokumentasikan runbook migrasi schema untuk deployment production

---

## Missing Features

- **Form/modal pembuatan obligasi manual** — endpoint `POST /tax/obligations` sudah berfungsi penuh di backend, tapi tidak ada tombol, form, atau modal di `TaxTracker.jsx` maupun komponen lain yang memanggilnya. Saat ini satu-satunya cara obligasi tercipta adalah lewat import Excel.
- **View "semua pajak per klien"** — endpoint `GET /tax/clients` (`getClientTaxOverview`) mengembalikan data yang sudah dikelompokkan per klien dengan seluruh `taxTypes` bersarang di dalamnya, tapi tidak ada satu pun komponen frontend yang memanggil endpoint ini. Ini adalah salah satu masalah utama yang ingin diselesaikan fitur (lihat PRD US-01), dan secara fungsional belum bisa diakses user.

---

## Partial Features

- **Matrix View untuk obligasi tanpa periode** — sudah menampilkan baris klien meski 0 periode (sesuai keputusan yang dikonfirmasi), TAPI jika *seluruh* obligasi dalam satu tab taxType belum punya periode, kolom periode (`uniquePeriods`) ikut kosong total karena diturunkan dari data periode yang ada, bukan dari kalender/daftar periode independen. Baris akan muncul tanpa kolom apapun untuk diisi.
- **Resolusi frequency tax type** — berfungsi benar untuk seluruh jalur data nyata saat ini (parser Excel selalu uppercase), tapi implementasinya rapuh: ada `MONTHLY_TAX_TYPES` yang dideklarasikan dengan casing campuran dan tidak pernah benar-benar dipakai untuk validasi apapun.

---

## Required Backend Changes

Tidak ada perubahan backend yang **wajib** untuk fungsionalitas inti — seluruh endpoint, service, dan validator untuk obligasi dan periode sudah lengkap dan benar. Perubahan yang dibutuhkan hanya untuk pembersihan dan robustness:

1. `backend/models/index.js` — hapus import `TaxTrack`, hapus dua baris asosiasi (`User.hasMany(TaxTrack,...)`, `Client.hasMany(TaxTrack,...)`), hapus `TaxTrack` dari export list.
2. Hapus file `backend/models/TaxTrack.js`.
3. Hapus file `backend/services/bootstrapService.js` (tidak ada caller di `server.js` atau manapun).
4. `backend/constants/taxFrequency.js` — hapus `MONTHLY_TAX_TYPES` yang tidak terpakai, atau jika ingin dipertahankan sebagai whitelist taxType yang valid, tambahkan pengecekan aktual terhadapnya saat `createTaxObligation`/`createTaxTask` menerima taxType baru.

---

## Required Frontend Changes

1. **Form pembuatan obligasi manual** (baru) — tambahkan di `TaxTracker.jsx` atau sebagai komponen baru terpisah, dipicu dari tombol di header tab. Field: nama klien (text/autocomplete), taxType (otomatis terisi dari `activeTab`), PIC (dropdown staff, opsional). Panggil `POST /tax/obligations`, lalu `invalidateQueries(["tax-obligations"])`.
2. **View overview klien lintas jenis pajak** (baru) — bisa berupa modal yang terbuka saat klik nama klien di `TaxMatrixView.jsx`, atau halaman/tab terpisah. Panggil `GET /tax/clients`, render setiap klien dengan daftar `taxTypes`-nya (taxType, frequency, PIC, ringkasan status periode).
3. **`TaxMatrixView.jsx`** — tangani kasus `uniquePeriods.length === 0` dengan fallback kolom periode default (misal 12 bulan tahun ini untuk MONTHLY, satu kolom TAHUNAN untuk ANNUAL) agar baris obligasi baru tetap punya kolom yang bisa diisi.

---

## Required Database Changes

1. Setelah `TaxTrack.js` dihapus dari kode, jalankan `DROP TABLE tax_tracks;` secara manual di database — `sequelize.sync({alter:true})` tidak akan menghapus tabel yang modelnya sudah tidak diimpor, ia hanya berhenti memperbarui tabel tersebut.
2. Tidak ada kolom atau tabel baru yang dibutuhkan — `tax_obligations` dan `tax_periods` sudah lengkap sesuai kebutuhan fungsional yang terverifikasi.
3. Pastikan proses sync skema baru (`tax_obligations`, `tax_periods`) sudah benar-benar tereksekusi di environment production, bukan hanya development — ini bergantung pada `NODE_ENV` saat deployment (lihat Risk Assessment).

---

## Required Websocket Changes

Tidak ada perubahan wajib. `emitTaxUpdated()` di `socketEventBus.js` sudah menangani payload `TaxPeriod` maupun `TaxObligation` secara polimorfik, sudah membawa `obligationId` dan `taxType`, dan sudah dikonsumsi dengan benar oleh `TaxTracker.jsx` (invalidasi query `tax-obligations` saat PIC berubah, patch cache `taxes` saat status berubah).

---

## Required Validation Changes

Tidak ada perubahan validasi yang wajib untuk endpoint yang sudah ada — seluruh schema di `taxSchemas.js` (`createObligationSchema`, `listObligationsSchema`, `assignObligationSchema`, dll) sudah selaras dengan route dan controller-nya. Jika form pembuatan obligasi manual (lihat Missing Features) ditambahkan di frontend, **tidak perlu schema baru** karena `createObligationSchema` sudah mencakup `clientName`, `taxType`, `pic_id` opsional — cukup pakai yang sudah ada.

---

## Acceptance Criteria Not Yet Satisfied

- **AC-07** (obligasi 0 periode muncul sebagai baris kosong di Matrix View) — **sebagian terpenuhi**: baris muncul, tapi jika seluruh tab kosong periode, kolom ikut hilang. Tidak gagal total, tapi tidak sepenuhnya sesuai niat "tetap menampilkan struktur kolom periode yang bisa diisi."
- **Acceptance criteria implisit dari US-01** (lihat semua jenis pajak satu klien) — **tidak terpenuhi**: tidak ada cara bagi user mengakses kapabilitas ini sama sekali dari UI, walau backend mendukung penuh.
- **Acceptance criteria implisit dari US-05** (admin tambah klien ke tax type sebelum data bulanan ada) — **tidak terpenuhi** dari sisi UI, walau backend (`POST /tax/obligations`) sudah mendukung penuh.

Seluruh acceptance criteria lain dari PRD asli (AC-01 hingga AC-06, AC-08, AC-09) **sudah terverifikasi terpenuhi** oleh implementasi saat ini berdasarkan inspeksi kode langsung — tidak dicantumkan ulang di sini sesuai instruksi untuk hanya menampilkan yang belum selesai.

---

## Recommended Implementation Order

1. Bersihkan `TaxTrack` dan `bootstrapService.js` dari kode (low-risk, tidak ada dependency aktif — paling aman dikerjakan duluan)
2. Tangani edge case kolom kosong di `TaxMatrixView.jsx` (kecil, tidak butuh perubahan backend)
3. Bangun form pembuatan obligasi manual di frontend (backend sudah siap, tinggal UI)
4. Bangun view overview klien lintas jenis pajak (backend sudah siap, tinggal UI — bisa dikerjakan paralel dengan langkah 3)
5. Tulis automated test e2e untuk seluruh flow tax obligation (dikerjakan setelah UI selesai, supaya test mencakup flow penuh termasuk yang baru dibangun)
6. Jalankan `DROP TABLE tax_tracks;` di database setelah langkah 1 dikonfirmasi tidak menimbulkan error sync
7. Dokumentasikan runbook migrasi schema untuk deployment production

---

## Estimated Complexity

| Pekerjaan | Kompleksitas |
|---|---|
| Hapus `TaxTrack` + `bootstrapService.js` | **Low** |
| Edge case kolom kosong Matrix View | **Low** |
| Form pembuatan obligasi manual | **Medium** (UI baru, tapi backend sudah ada, tidak perlu desain ulang flow) |
| View overview klien lintas pajak | **Medium** (UI baru + keputusan desain: modal vs halaman terpisah) |
| Automated test e2e | **Medium** (mengikuti pola script test yang sudah ada di repo, tapi perlu cakupan skenario yang cukup luas) |
| Drop tabel `tax_tracks` di production | **Low** (satu statement SQL, tapi butuh kehati-hatian timing deployment) |

---

## Risk Assessment

| Risiko jika perubahan dilakukan | Severity | Mitigasi |
|---|---|---|
| Menghapus `TaxTrack` dari `models/index.js` tanpa menghapus tabelnya dulu bisa menyebabkan `sequelize.sync()` membiarkan tabel orphan di database (tidak masalah secara teknis, tapi bisa membingungkan) | Low | Hapus kode dulu, verifikasi server start tanpa error, baru drop tabel manual |
| Menambah form obligasi manual bisa membuka jalan admin membuat obligasi dengan taxType yang tidak ada di whitelist sembilan tab (`TAX_CATEGORIES` di `TaxTracker.jsx`) jika form tidak dibatasi ke taxType yang sama | Medium | Batasi pilihan taxType di form hanya ke `TAX_CATEGORIES` yang sudah didefinisikan, jangan free-text |
| View overview klien lintas pajak menampilkan data dari banyak taxType sekaligus — perlu pastikan scoping permission (staff hanya lihat obligasi miliknya) tetap konsisten dengan yang sudah diterapkan di `getClientTaxOverview` | Low | Service sudah menerapkan scoping ini dengan benar (`whereObligation.pic_id = currentUser.id` untuk non-admin) — risiko hanya muncul jika frontend baru salah menggabungkan data dari endpoint lain yang tidak ter-scope sama |
| Drop tabel `tax_tracks` di production bersifat permanen dan sudah dikonfirmasi sebagai keputusan bisnis yang diterima sebelumnya — tidak ada risiko baru, hanya pengingat bahwa ini ireversibel | Medium (karena ireversibel, bukan karena belum disetujui) | Backup `mysqldump` manual atas tabel sebelum drop sebagai cadangan dingin, sesuai rekomendasi PRD sebelumnya |
