# MIGRATION RUNBOOK
## Deployment Sisa Fitur Client-Based Tax Track

Proses ini didokumentasikan untuk keperluan deployment ke Production.

### Langkah 1: Backup Database (WAJIB)
Sebelum mendeploy, lakukan backup tabel `tax_tracks`:
```sql
CREATE TABLE tax_tracks_backup AS SELECT * FROM tax_tracks;
-- ATAU jalankan mysqldump untuk tabel tersebut
```

### Langkah 2: Deploy Kode Baru
1. Pull kode terbaru ke server production.
2. Instal dependencies frontend & backend jika ada perubahan `package.json` (saat ini tidak ada penambahan deps baru).
3. Jalankan build frontend: `npm run build` di direktori `frontend`.
4. Restart service backend (misal: `pm2 restart csl-backend`).

### Langkah 3: Eksekusi Drop Table
Setelah kode backend berjalan dan dipastikan API tidak crash, jalankan perintah drop:
```sql
DROP TABLE tax_tracks;
```
Karena tabel ini sudah dihapus dari kode (`models/index.js`), Sequelize tidak akan lagi mendeteksi tabel tersebut, sehingga tabel ini berstatus *orphan* jika tidak didrop manual. Drop manual ini memastikan kebersihan database.

### Langkah 4: Verifikasi
1. Login sebagai Admin.
2. Buka halaman Tax Tracker.
3. Klik tombol "+ Klien Manual" dan buat obligasi manual.
4. Klik pada nama klien di Matrix View untuk memastikan Overview Modal terbuka dengan data obligasi pajak yang benar.
