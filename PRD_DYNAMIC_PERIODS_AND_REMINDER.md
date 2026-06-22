# PRD — Dynamic Period Columns & Tax Payment Reminder
## Sistem: Catat Susun Lapor (CSL)
## Versi 1.0

---

## 0. Konteks & Batasan yang Perlu Dipahami Agent Sebelum Mengerjakan

Dokumen ini menggabungkan **dua fitur independen**. Jangan dikerjakan sebagai satu blok — keduanya punya root cause, file terdampak, dan tingkat risiko yang berbeda. Kerjakan Fitur A dulu, selesai dan stabil, baru lanjut Fitur B. Fitur B secara opsional bisa memanfaatkan struktur dari Fitur A (lihat §4), tapi tidak bergantung penuh padanya.

**Yang sudah diverifikasi ada di repository saat ini (jangan diasumsikan ulang, baca langsung jika ragu):**
- Kolom periode di Matrix View (`TaxMatrixView.jsx`) **100% data-driven** — diturunkan dari `taxes.map(t => t.period)`, lalu di-dedupe dan disortir lewat `parsePeriod()`. Tidak ada konsep kalender atau daftar periode independen sama sekali.
- Tidak ada satupun konsep "deadline" atau "tanggal jatuh tempo" untuk objek pajak (`TaxObligation`/`TaxPeriod`) di seluruh codebase. `deadline` field yang ada HANYA milik model `ToDo`, tidak ada hubungan dengan pajak.
- Tidak ada scheduler/cron library terpasang (`node-cron` dkk tidak ada di `package.json`). Satu-satunya mekanisme realtime yang ada adalah Socket.IO yang sudah jalan untuk update status pajak.
- 9 tax type yang resmi terdaftar di sistem (`TAX_CATEGORIES` di `TaxTracker.jsx`): `PPN, PPH 21, PPH 25, UNIFIKASI, PHR, LKPM, BRUTO PP55, 1771 BADAN, 1770 OP`. Dua di antaranya (`1771 BADAN`, `1770 OP`) berfrequency `ANNUAL` di `TaxObligation.frequency`; sisanya `MONTHLY`.

**Yang TIDAK boleh diasumsikan:** Tanggal jatuh tempo resmi pemerintah untuk tiap jenis pajak BUKAN keputusan teknis — itu fakta regulasi (PMK/Undang-Undang) yang harus dikonfirmasi oleh orang yang paham aturan pajak terkini (akuntan/konsultan pajak di tim CSL), bukan ditebak dari pengetahuan umum AI. PRD ini menyediakan tabel due-date sebagai **starting point yang harus divalidasi manusia sebelum go-live**, bukan sebagai sumber kebenaran final. Lihat §6.2.

---

## FITUR A — Independent Month / Period Column Generation

### A.1 Masalah

Saat ini kolom Matrix View hanya muncul jika sudah ada `TaxPeriod` dengan periode tersebut di database (lewat import Excel atau create manual). Akibatnya:
- Klien baru tanpa data Juli belum punya kolom Juli sampai ada yang mengimpor/membuat data Juli secara eksplisit.
- Tab yang seluruh obligasinya masih kosong (0 periode) menampilkan tabel tanpa kolom sama sekali — celah ini sudah teridentifikasi sebelumnya sebagai GAP-04 pada analisis implementasi terdahulu, belum diperbaiki.
- Tidak ada cara melihat "bulan-bulan yang akan datang" sebagai slot kosong yang siap diisi — kolom baru hanya muncul reaktif setelah data masuk, bukan proaktif berdasarkan kalender.

### A.2 Keputusan Desain: Tampilkan Sampai Akhir Tahun (BUKAN tambah-per-bulan)

Dua opsi yang diminta untuk dipertimbangkan:
1. **Reaktif:** begitu masuk bulan Juli, baru muncul kolom Juli.
2. **Proaktif (direkomendasikan):** begitu tahun berganti (atau obligasi baru dibuat), langsung tampilkan SEMUA 12 kolom Januari–Desember untuk obligasi `MONTHLY`, atau 1 kolom `TAHUNAN <tahun>` untuk obligasi `ANNUAL`.

**Rekomendasi: Opsi 2 (tampilkan sampai akhir tahun).** Alasan:
- Opsi 1 mereplikasi persis masalah yang sedang diperbaiki di Fitur A — kolom Agustus tidak akan ada sampai ada yang membuat data Agustus, yang berarti tetap reaktif, hanya bedanya dipicu oleh tanggal sistem bukan oleh aksi user. Ini tidak menyelesaikan keluhan "tidak bisa lihat bulan depan sebagai slot kosong yang siap diisi."
- Opsi 2 memungkinkan admin/staff melihat keseluruhan tahun pajak sekaligus — bisa langsung klik kolom Desember dan isi status walau belum waktunya, berguna untuk kasus pembayaran di muka atau perencanaan.
- Biaya render 12 kolom kosong vs 7 kolom kosong (skenario sekarang bulan Juli) secara performa diabaikan — jumlah kolom maksimum tetap 12, bukan beban yang tumbuh tanpa batas.
- Untuk obligasi `ANNUAL`, tidak ada bedanya — selalu cuma 1 kolom per tahun, jadi keputusan ini praktis hanya berlaku untuk obligasi `MONTHLY`.

**Konsekuensi yang harus diterima:** Akan ada banyak kolom kosong (strip "-") di bulan-bulan yang belum tiba. Ini BUKAN bug — ini hasil yang diinginkan, supaya struktur tabel konsisten dan prediktif. Jangan menyembunyikan kolom bulan yang belum tiba berdasarkan tanggal hari ini; itu balik lagi ke perilaku reaktif yang ingin dihindari.

**Penentuan tahun:** Default tahun yang ditampilkan adalah tahun berjalan (`new Date().getFullYear()`). Tambahkan UI sederhana (dropdown/selector tahun) di `TaxTracker.jsx` agar admin bisa melihat tahun sebelumnya (data historis) tanpa mengubah default tampilan. Tidak perlu mendukung tahun yang belum punya data sama sekali kecuali tahun berjalan dan tahun yang sudah pernah ada datanya.

### A.3 Functional Requirements

| ID | Deskripsi | Expected Result |
|---|---|---|
| FR-A1 | Kolom matrix untuk obligasi `MONTHLY` selalu menampilkan 12 bulan (Januari–Desember) tahun yang sedang dipilih, terlepas dari ada/tidaknya `TaxPeriod` di database untuk bulan tersebut | Tabel selalu punya 12 kolom per tahun untuk tab MONTHLY, kolom tanpa data menampilkan strip "-" dan tidak bisa diklik untuk mengubah status (karena belum ada `TaxPeriod.id` untuk diupdate) — lihat FR-A3 |
| FR-A2 | Kolom matrix untuk obligasi `ANNUAL` selalu menampilkan 1 kolom `TAHUNAN <tahun>` untuk tahun yang sedang dipilih | Konsisten dengan FR-A1, hanya beda jumlah kolom (1, bukan 12) |
| FR-A3 | Cell kosong (belum ada `TaxPeriod`) di kolom "masa depan" harus bisa diklik untuk MEMBUAT periode baru langsung dari Matrix View, bukan cuma tampilan pasif | Klik cell kosong memunculkan opsi cepat (misal langsung set status awal, atau modal kecil "buat periode ini"), memanggil endpoint create period yang sudah ada di backend |
| FR-A4 | Selector tahun di `TaxTracker.jsx`, default ke tahun berjalan | Mengubah tahun memuat ulang data matrix untuk tahun tersebut tanpa reload halaman |
| FR-A5 | Logic penentuan 12 label bulan vs 1 label tahunan mengikuti `TaxObligation.frequency`, bukan ditebak dari taxType di frontend | Frontend membaca `frequency` dari data obligasi yang sudah di-include backend, tidak mendefinisikan ulang aturan ANNUAL/MONTHLY secara terpisah dari `taxFrequency.js` yang sudah ada di backend |

### A.4 File Terdampak

**Frontend (perubahan utama):**
- `frontend/src/components/Tax/TaxMatrixView.jsx` — ubah `uniquePeriods` dari hasil `taxes.map(t => t.period)` menjadi generator kalender: untuk setiap obligasi, jika `frequency === "MONTHLY"` generate 12 label bulan format yang sama dengan yang sudah dipakai sistem sekarang (cocokkan persis dengan format yang dihasilkan `taxWorkbookParser.js` agar tidak terjadi mismatch saat data asli masuk, contoh: "JANUARI 2026", bukan "Jan 2026"); jika `ANNUAL`, generate 1 label `"TAHUNAN <tahun>"` sesuai `normalizePeriodLabel()` yang sudah ada di backend. Render cell tanpa `TaxPeriod` sebagai cell kosong yang clickable (FR-A3), bukan disembunyikan.
- `frontend/src/components/Tax/TaxTracker.jsx` — tambah state `selectedYear`, default tahun berjalan, teruskan ke `TaxMatrixView` dan ke query key (`["taxes", activeTab, selectedYear]`) supaya cache per-tahun terpisah. Tambah dropdown/selector tahun di UI.

**Backend (perubahan kecil, opsional tapi disarankan):**
- `backend/services/taxService.js` — endpoint `createTaxTask` sudah mendukung create periode tunggal; tidak perlu endpoint baru untuk FR-A3, tinggal dipanggil dari UI saat cell kosong diklik. Pertimbangkan menambah parameter `year` pada `listTaxes`/`listTaxObligations` agar backend bisa memfilter periode berdasarkan tahun secara efisien di level query alih-alih frontend menerima semua data lalu memfilter sisi klien — ini jadi penting begitu data multi-tahun terkumpul (lihat NFR-A1).

**Tidak terdampak:** model (`TaxObligation`, `TaxPeriod` sudah cukup), validator (tidak ada shape request baru kecuali parameter `year` opsional), websocket (event `TAX_UPDATED` tidak berubah).

### A.5 Non-Functional Requirements

- **NFR-A1 (Performance):** Begitu data terkumpul lintas tahun (2025, 2026, 2027, dst.), query yang mengambil SEMUA periode lalu memfilter tahun di frontend akan makin mahal. Disarankan menambah filter `year` di level service/query begitu memungkinkan, bukan ditunda sampai jadi masalah nyata.
- **NFR-A2 (Konsistensi label):** Format label bulan yang di-generate frontend HARUS identik string-nya dengan yang dihasilkan `normalizePeriodLabel()` di backend dan `taxWorkbookParser.js`, atau kolom generated-kosong tidak akan match dengan `TaxPeriod.period` asli yang masuk lewat import — kalau ini meleset, kolom akan dobel (satu kolom "kosong" dari generator, satu kolom lagi dari data asli dengan format string yang sedikit berbeda).

### A.6 Edge Cases

- Klien dengan obligasi yang baru dibuat di bulan Oktober — tetap menampilkan Januari–Desember penuh (termasuk bulan yang sudah lewat tanpa data), bukan hanya Oktober–Desember. Konsisten dengan keputusan §A.2.
- Tahun yang dipilih di selector belum punya `TaxObligation` apapun yang relevan (misal user pilih 2030) — tabel tetap tampil dengan baris obligasi (karena obligasi tidak terikat tahun, hanya `TaxPeriod` yang terikat) dan 12 kolom kosong semua.
- Pergantian tahun di tengah sesi (misal aplikasi dibuka dari 31 Desember ke 1 Januari) — TIDAK perlu auto-refresh otomatis; cukup default ke tahun berjalan saat halaman di-load ulang/dibuka kembali.

---

## FITUR B — Tax Payment Reminder

### B.1 Masalah

Tidak ada mekanisme apapun di sistem yang memberi tahu staff/admin bahwa suatu pajak mendekati atau melewati tanggal jatuh tempo pembayaran resmi pemerintah. Status (`NOT_STARTED`, `IN_PROGRESS`, dst.) hanya mencatat progres kerja, tidak terhubung ke kalender kewajiban pajak sama sekali.

### B.2 Keputusan Desain: Tabel Due-Date Per Tax Type (Wajib Divalidasi Manusia)

Setiap jenis pajak punya tanggal jatuh tempo pembayaran/pelaporan yang ditetapkan pemerintah, dan ini **berbeda-beda per jenis pajak** serta sebagian bisa berubah karena revisi regulasi (PMK). Beberapa (seperti PHR) sifatnya pajak daerah dengan aturan yang bisa berbeda antar kabupaten/kota, bukan aturan nasional tunggal.

**Rancangan data: jangan hardcode tanggal di dalam logic kode.** Buat tabel/konstanta konfigurasi terpisah yang bisa diubah tanpa deploy ulang aplikasi (idealnya tabel database, minimal file konstanta yang mudah diedit). Bentuk:

```
taxType         | payment_due_day | report_due_day | due_relative_to       | notes
PPH 21          | 10              | 20             | bulan_berikutnya       | -
PPH 25          | 15              | 20             | bulan_berikutnya       | -
PPN             | -               | akhir_bulan    | bulan_berikutnya       | Bayar & lapor bersamaan
UNIFIKASI       | 10              | 20             | bulan_berikutnya       | Per jenis objek pajak, sederhanakan dulu jadi satu tanggal
1771 BADAN      | -               | akhir_bulan_4  | tahun_berikutnya       | SPT Tahunan Badan
1770 OP         | -               | akhir_bulan_3  | tahun_berikutnya       | SPT Tahunan Orang Pribadi
PHR             | bervariasi      | bervariasi     | tergantung_daerah      | TIDAK seragam nasional — perlu input manual per klien/daerah, JANGAN dipaksa satu aturan
LKPM            | -               | per_triwulan   | -                      | Periode triwulanan, bukan bulanan — perlu pengecekan ulang apakah model TaxPeriod saat ini cocok untuk LKPM
BRUTO PP55      | -               | akhir_bulan    | bulan_berikutnya       | -
```

**PENTING — instruksi untuk agent implementasi:** Tabel di atas adalah starting point berdasarkan pemahaman umum aturan perpajakan Indonesia, BUKAN sumber kebenaran final. Sebelum fitur ini go-live, tabel ini harus direview dan dikonfirmasi oleh orang di tim CSL yang memahami regulasi pajak terkini (PMK yang berlaku saat ini), terutama untuk: PHR (variasi daerah), LKPM (apakah benar triwulanan atau ada ketentuan lain), dan UNIFIKASI (kategori objek pajak di dalamnya punya tanggal berbeda-beda, tabel di atas menyederhanakan jadi satu angka). Tandai baris-baris ini sebagai `needs_review: true` di data awal sehingga UI bisa menampilkan peringatan visual sampai admin mengonfirmasi tanggalnya benar.

### B.3 Functional Requirements

| ID | Deskripsi | Aktor | Expected Result |
|---|---|---|---|
| FR-B1 | Sistem menghitung tanggal jatuh tempo aktual untuk setiap `TaxPeriod` berdasarkan `taxType` obligasi induk dan `period`-nya | System | Misal `TaxPeriod` dengan period "JUNI 2026" pada obligasi PPh 21 → due date dihitung sebagai 10 Juli 2026 |
| FR-B2 | `TaxPeriod` yang due date-nya dalam N hari ke depan (default 7 hari, dapat dikonfigurasi) dan statusnya BELUM `COMPLETED`/`FILED`/`PAID` ditandai sebagai "mendekati jatuh tempo" | System | Query/endpoint baru mengembalikan daftar periode yang masuk kategori ini, terpisah dari listing biasa |
| FR-B3 | `TaxPeriod` yang due date-nya sudah lewat dan statusnya belum selesai ditandai sebagai "terlambat" (overdue), bukan sekadar "mendekati" | System | Kategori terpisah dari FR-B2 — overdue harus lebih menonjol secara visual daripada mendekati |
| FR-B4 | Staff hanya menerima reminder untuk obligasi yang dia jadi PIC-nya; Admin menerima reminder untuk semua | Staff, Admin | Filtering mengikuti pola scoping yang sudah ada di `listTaxes`/`getWorkloadSummary` (`pic_id` check), JANGAN buat aturan scoping baru yang berbeda dari pola existing |
| FR-B5 | Reminder ditampilkan sebagai badge/notifikasi di UI saat aplikasi dibuka (in-app), BUKAN dikirim lewat email/WhatsApp/channel eksternal pada versi awal | System | Konsisten dengan keterbatasan infra saat ini (tidak ada email service, tidak ada WA gateway terpasang) — lihat §B.5 untuk opsi ekspansi nanti |
| FR-B6 | Klik pada item reminder langsung membawa user ke cell/obligasi yang relevan di Matrix View (tab + scroll ke baris yang tepat) | Staff, Admin | Reminder harus actionable, bukan cuma informatif — user tidak perlu mencari manual setelah lihat reminder |

### B.4 Dua Pilihan Arsitektur Delivery — Pilih Salah Satu Secara Sadar

**Opsi 1 — Computed on-demand (direkomendasikan untuk versi pertama):**
Tidak ada proses background/cron. Setiap kali frontend fetch data tax (saat tab dibuka, saat polling biasa), backend menghitung due date dan status reminder secara real-time berdasarkan tanggal hari ini, lalu mengirimkannya sebagai bagian dari response. Tidak butuh dependency baru, tidak butuh tabel baru untuk menyimpan "notifikasi yang sudah dikirim" — state reminder selalu dihitung ulang dari `TaxPeriod` + tabel due-date, sehingga tidak pernah basi (stale).
- Kelebihan: sederhana, tidak ada risiko cron gagal jalan, tidak ada race condition penyimpanan status notifikasi.
- Kekurangan: TIDAK bisa mengingatkan user yang sedang tidak membuka aplikasi (tidak ada push notification/email).

**Opsi 2 — Scheduled push (butuh kerja lebih banyak, untuk iterasi berikutnya):**
Tambah `node-cron` (dependency baru), jalankan job harian (misal jam 8 pagi) yang scan seluruh `TaxPeriod` aktif, kirim notifikasi lewat channel yang BELUM ADA di sistem ini (email — butuh setup SMTP/service seperti Resend/SendGrid; atau WhatsApp — butuh gateway berbayar). Butuh tabel baru untuk mencatat riwayat reminder yang sudah terkirim agar tidak dikirim berulang setiap hari untuk periode yang sama.
- Kelebihan: bisa menjangkau user walau tidak membuka aplikasi.
- Kekurangan: kerja signifikan lebih besar — perlu pilih dan setup provider email/WA, perlu rancang dedup state, perlu handle gagal kirim, perlu UI setting "matikan reminder untuk channel X."

**Rekomendasi: mulai dari Opsi 1.** Selesaikan dan stabilkan dulu, baru evaluasi kebutuhan nyata untuk Opsi 2 berdasarkan apakah in-app reminder saja sudah cukup efektif buat tim CSL atau tidak. Sisanya dokumen ini (§B.5–B.8) berasumsi Opsi 1, dengan catatan eksplisit di mana Opsi 2 akan masuk jika nanti dipilih.

### B.5 File Terdampak (asumsi Opsi 1)

**Backend (baru):**
- `backend/constants/taxDueDates.js` (baru) — tabel due-date per taxType sesuai §B.2, dengan flag `needs_review` per entry.
- `backend/services/taxReminderService.js` (baru) — fungsi `calculateDueDate(taxType, period)`, `getUpcomingReminders({currentUser, daysAhead})`, `getOverdueReminders({currentUser})`. Reuse pola scoping `pic_id` yang sudah ada di `taxService.js`, JANGAN duplikasi logic permission terpisah.
- `backend/controllers/taxController.js` — tambah handler baru `getTaxReminders` yang memanggil `taxReminderService`.
- `backend/routes/taxRoutes.js` — tambah `GET /api/tax/reminders` (auth required, scoping otomatis berdasarkan role seperti endpoint lain).
- `backend/validators/taxSchemas.js` — schema query param `daysAhead` (opsional, default dari constant, validasi angka positif wajar misal max 90).

**Frontend (baru):**
- Komponen baru `frontend/src/components/Tax/TaxReminderBanner.jsx` atau ditempel sebagai badge counter di tab/header `TaxTracker.jsx` — tampilkan jumlah overdue + mendekati, klik untuk expand daftar.
- `frontend/src/components/Tax/TaxTracker.jsx` — fetch `["tax-reminders"]` query secara berkala (polling interval wajar, misal 5 menit, JANGAN polling tiap beberapa detik — ini bukan data yang berubah cepat), render banner/badge.
- Logic FR-B6 (klik reminder → navigasi ke cell) butuh state lifting: `TaxTracker.jsx` perlu fungsi untuk set `activeTab` ke taxType yang relevan dan meneruskan target obligationId/period ke `TaxMatrixView` agar bisa di-highlight/scroll otomatis — ini perubahan baru pada props yang diteruskan, periksa signature `TaxMatrixView` saat ini sebelum menambah prop supaya tidak konflik dengan props yang sudah ada (`taxes`, `obligations`, `onStatusChange`, dst).

**Tidak terdampak:** model `TaxObligation`/`TaxPeriod` (tidak perlu kolom baru untuk Opsi 1 — due date dihitung on-the-fly, tidak disimpan), websocket (reminder tidak realtime-push, cukup polling/fetch biasa sesuai Opsi 1).

### B.6 Non-Functional Requirements

- **NFR-B1 (Akurasi data > kecepatan fitur):** Karena tabel due-date adalah fakta regulasi, JANGAN ship ke production sebelum baris `needs_review: true` (PHR, LKPM, UNIFIKASI minimal) dikonfirmasi oleh orang yang kompeten secara pajak. Kesalahan tanggal jatuh tempo yang ditampilkan ke staff lebih berbahaya daripada tidak ada reminder sama sekali — staff bisa terlena percaya sistem padahal tanggalnya salah.
- **NFR-B2 (Tidak menggantikan kewajiban hukum):** Reminder ini alat bantu internal, bukan sumber kepatuhan resmi. Pertimbangkan menambah disclaimer singkat di UI ("Tanggal estimasi internal, selalu verifikasi dengan ketentuan DJP/pemda terbaru") supaya tidak disalahartikan sebagai kepastian regulasi oleh staff baru.
- **NFR-B3 (Tidak membebani query utama):** Endpoint reminder harus terpisah dari `listTaxes`/`listTaxObligations`, dipanggil dengan frekuensi polling yang lebih jarang, supaya tidak menambah beban di setiap render Matrix View yang sudah sering di-fetch.

### B.7 Edge Cases

- Obligasi `ANNUAL` (1771 BADAN, 1770 OP) — due date dihitung dari TAHUN periode (`"TAHUNAN 2026"` → due date jatuh di tahun 2027 untuk Badan, karena SPT Tahunan dilaporkan tahun setelah tahun pajak berjalan, BUKAN di tahun yang sama). Pastikan `calculateDueDate` menangani offset tahun ini, bukan asumsi due date selalu di tahun yang sama dengan label periode.
- `TaxPeriod` yang sudah berstatus `COMPLETED`/`FILED`/`PAID` tapi due date-nya sudah lewat — JANGAN muncul di reminder overdue, karena sudah selesai. Filter status harus eksplisit dicek, bukan hanya filter tanggal.
- Obligasi tanpa periode sama sekali (hasil dari Fitur A — kolom kosong/belum dibuat) — TIDAK relevan untuk reminder, karena belum ada `TaxPeriod.id` yang bisa diukur due date-nya. Reminder hanya berlaku untuk periode yang sudah benar-benar tercatat di database, atau pertimbangkan varian terpisah "periode bulan ini belum dibuat sama sekali" sebagai kategori reminder ketiga jika dianggap perlu — TIDAK termasuk dalam FR-B1 hingga FR-B6 di atas, perlu keputusan eksplisit tambahan jika mau dimasukkan.
- Klien dengan PIC yang baru di-reassign di tengah bulan — reminder harus konsisten dengan `TaxObligation.pic_id` saat ini, bukan PIC lama saat periode dibuat. Karena `calculateDueDate` dipanggil on-demand (Opsi 1), ini otomatis benar tanpa kerja tambahan.

### B.8 Acceptance Criteria

**AC-B1**
Given `TaxPeriod` dengan period "JUNI 2026" pada obligasi PPh 21 berstatus `NOT_STARTED`, hari ini tanggal 5 Juli 2026
When endpoint `GET /api/tax/reminders` dipanggil oleh PIC obligasi tersebut
Then periode tersebut muncul di kategori "overdue" karena due date (10 Juli 2026) belum lewat — TUNGGU, perlu klarifikasi tanggal pasti per taxType sebelum AC ini final (lihat NFR-B1)

**AC-B2**
Given `TaxPeriod` yang sama berstatus `COMPLETED`
When endpoint dipanggil
Then periode tersebut TIDAK muncul di kategori overdue maupun mendekati, terlepas dari due date

**AC-B3**
Given Staff bukan PIC dari suatu obligasi
When Staff memanggil endpoint reminder
Then periode milik obligasi tersebut TIDAK muncul di hasil untuk Staff itu, sesuai FR-B4

---

## 4. Hubungan Fitur A dan Fitur B (Opsional, Bukan Dependency Keras)

Fitur B bisa dibangun tanpa menunggu Fitur A selesai — keduanya membaca dari `TaxObligation`/`TaxPeriod` yang sama tapi dengan cara berbeda (Fitur A mengubah cara kolom dirender, Fitur B menambah endpoint baru terpisah). Satu titik singgung yang berguna: FR-A3 (klik cell kosong untuk membuat periode baru) akan membuat lebih banyak `TaxPeriod` ter-create lebih awal, yang berarti Fitur B punya lebih banyak data nyata untuk dihitung reminder-nya alih-alih harus menangani kasus "periode belum dibuat" (edge case terakhir di §B.7). Tapi ini optimasi urutan kerja, bukan keharusan teknis.

---

## 5. Urutan Implementasi yang Disarankan

1. Fitur A — generator kolom kalender di `TaxMatrixView.jsx` + selector tahun di `TaxTracker.jsx`
2. Validasi format label periode generated cocok 100% dengan format dari `taxWorkbookParser.js`/`normalizePeriodLabel()` (test manual: import data asli, pastikan tidak ada kolom dobel)
3. FR-A3 — cell kosong bisa diklik untuk create periode baru
4. Fitur B — `taxDueDates.js` dengan flag `needs_review`, kirim ke tim pajak CSL untuk validasi tanggal SEBELUM lanjut ke langkah berikutnya
5. `taxReminderService.js` + endpoint, dengan asumsi tabel due-date sudah final/dikonfirmasi
6. UI banner/badge reminder + FR-B6 (klik → navigasi ke cell)
7. Evaluasi setelah berjalan beberapa minggu: apakah Opsi 2 (scheduled push/email) benar-benar dibutuhkan, atau in-app reminder saja sudah cukup

---

## 6. Risk Summary

| Risiko | Severity | Mitigasi |
|---|---|---|
| Tanggal due-date salah karena bukan dikonfirmasi ahli pajak | High | Flag `needs_review`, jangan go-live sebelum dikonfirmasi, tampilkan disclaimer di UI |
| Format label periode generated (Fitur A) tidak cocok string-nya dengan data asli dari import → kolom dobel | Medium | Test eksplisit dengan data import asli sebelum dianggap selesai, lihat langkah 2 di §5 |
| PHR/LKPM dipaksa masuk satu aturan due-date nasional padahal sifatnya regional/triwulanan | Medium | Jangan generalisasi — beri kategori "perlu input manual per klien" untuk PHR jika variasi daerah memang signifikan, jangan dipaksa satu angka demi kesederhanaan kode |
| Reminder dianggap user sebagai kepastian hukum, bukan alat bantu | Low-Medium | Disclaimer eksplisit di UI (NFR-B2) |
| Scope creep — agent langsung loncat ke Opsi 2 (email/WA) tanpa Opsi 1 stabil dulu | Medium | Urutan implementasi di §5 eksplisit menunda Opsi 2 ke evaluasi setelah Opsi 1 berjalan |
