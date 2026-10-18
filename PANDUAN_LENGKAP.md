# Panduan Lengkap Implementasi Sistem Verifikasi Sertifikat Yayasan
### (Blogger + Google Sheets + Google Apps Script + QR Code)

Panduan ini berisi panduan teknis langkah demi langkah untuk membangun sistem verifikasi dan penerbitan sertifikat lomba yayasan tanpa memerlukan sewa server (VPS), tanpa biaya bulanan, dan sangat mudah dikelola.

---

## 🏛️ 1. Gambaran Alur Kerja Sistem

```
┌─────────────────────────────────┐
│       Sertifikat Lomba          │
│   (PDF / Cetak Piagam Fisik)    │
│  Tercantum QR Code & Nomor ID   │
└────────────────┬────────────────┘
                 │
                 ▼ Pindai QR Code via Kamera HP
┌─────────────────────────────────┐
│     Halaman Website Blogger     │
│   domainyayasan.blogspot.com    │
│       /p/cek-sertifikat.html     │
└────────────────┬────────────────┘
                 │
                 ▼ Permintaan Data (Fetch API)
┌─────────────────────────────────┐
│       Google Apps Script        │
│       (Backend / Web App)       │
└────────────────┬────────────────┘
                 │
                 ▼ Query Cocokkan ID
┌─────────────────────────────────┐
│          Google Sheets          │
│     (Database Resmi Yayasan)    │
│  ID | Nama | Lomba | Status     │
└─────────────────────────────────┘
```

---

## 📊 2. Langkah 1: Membuat Database di Google Sheets

1. Buka [Google Sheets](https://sheets.google.com) lalu buat Spreadsheet baru.
2. Beri nama file: **`Database Sertifikat Yayasan`**.
3. Ubah nama tab (sheet) pertama di kiri bawah menjadi **`Sertifikat`** (harus persis sama, huruf besar di awal).
4. Buat baris header (Baris 1) dengan susunan kolom berikut:
   - **Kolom A:** `ID` (Nomor unik sertifikat, cth: `YYS-2026-0001`)
   - **Kolom B:** `Nama` (Nama lengkap peserta)
   - **Kolom C:** `Lomba` (Nama cabang perlombaan / kegiatan)
   - **Kolom D:** `Predikat` (Misal: `Juara 1`, `Juara 2`, `Peserta`, `Finalis`)
   - **Kolom E:** `Tanggal` (Tanggal penerbitan sertifikat, cth: `18/10/2026`)
   - **Kolom F:** `Status` (Ketik **`AKTIF`** untuk yang sah, atau **`DICABUT`** untuk yang dibatalkan)

#### Contoh Isi Data Awal:
| ID | Nama | Lomba | Predikat | Tanggal | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `YYS-2026-0001` | Ahmad Fauzi | Lomba Cerdas Cermat Sains 2026 | Juara 1 Tingkat Provinsi | 18/10/2026 | **AKTIF** |
| `YYS-2026-0002` | Siti Aminah | Lomba Pidato Bahasa Inggris 2026 | Juara 2 | 18/10/2026 | **AKTIF** |
| `YYS-2026-0003` | Budi Santoso | Lomba Desain Poster Kreatif 2026 | Finalis | 18/10/2026 | **DICABUT** |

> ⚠️ **PENTING TENTANG PRIVASI:**
> Jangan memasukkan NIK, nomor HP, atau alamat rumah peserta ke dalam sheet ini demi kepatuhan privasi data (UU PDP).

#### Cara Mengambil ID Spreadsheet:
Lihat URL pada address bar browser Anda saat membuka Google Sheets tersebut:
```
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit
                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^
                                         Ini adalah SPREADSHEET_ID
```
Salin bagian di antara `/d/` dan `/edit`. Simpan untuk langkah berikutnya.

---

## ⚙️ 3. Langkah 2: Memasang Google Apps Script

1. Pada Google Sheets Anda, klik menu **Extensions (Ekstensi)** ➔ **Apps Script**.
2. Hapus semua kode bawaan yang ada di editor.
3. Buka berkas [Code.gs](file:///d:/2026/Web/Sertifikat/Code.gs) yang telah kami siapkan di folder ini, lalu salin seluruh kodenya dan tempel (paste) ke editor Apps Script.
4. Ubah baris ke-18:
   ```javascript
   const SPREADSHEET_ID = 'GANTI_DENGAN_ID_SPREADSHEET_ANDA';
   ```
   Ganti nilai di atas dengan ID Spreadsheet yang Anda salin pada Langkah 1.
5. Klik ikon **Simpan (Save Disk)** atau tekan `Ctrl + S`.

---

## 🚀 4. Langkah 3: Deploy Web App Apps Script

Agar Blogger bisa mengakses data, Anda harus mempublikasikannya sebagai Web App:

1. Di pojok kanan atas editor Apps Script, klik tombol biru **Deploy** ➔ **New deployment** (Penerapan baru).
2. Klik ikon gerigi (Select type) di kiri atas pop-up, lalu pilih **Web app**.
3. Isi kolom konfigurasi sebagai berikut:
   - **Description:** `API Verifikasi Sertifikat Yayasan v1`
   - **Execute as:** `Me (email Anda)`
   - **Who has access:** **`Anyone`** (Siapa saja, bahkan yang tidak login akun Google)
4. Klik **Deploy**.
5. Google akan meminta izin otorisasi (*Authorization Required*):
   - Klik **Authorize access**.
   - Pilih akun Google Anda.
   - Jika muncul peringatan *"Google hasn't verified this app"*, klik **Advanced** (Lanjutan) lalu klik **Go to Verifikasi Sertifikat Yayasan (unsafe)**.
   - Klik **Allow**.
6. Salin **Web app URL** yang muncul (alamat berakhiran `/exec`), misalnya:
   ```
   https://script.google.com/macros/s/AKfycbz_XXXXXXXXXXXXXX/exec
   ```
7. Simpan URL tersebut!

---

## 🌐 5. Langkah 4: Memasang di Halaman Blogger

1. Buka [Blogger Dashboard](https://www.blogger.com).
2. Di menu samping kiri, klik **Halaman (Pages)** ➔ klik tombol **+ Halaman Baru** (New Page).
3. Beri Judul Halaman: **`Cek Keaslian Sertifikat`** (atau `Verifikasi Sertifikat Resmi`).
4. Klik ikon pensil di kiri atas editor, lalu pilih **Tampilan HTML (<>)**.
5. Buka berkas [blogger-halaman-verifikasi.html](file:///d:/2026/Web/Sertifikat/blogger-halaman-verifikasi.html) di folder proyek ini.
6. Salin seluruh isi kodenya dan tempelkan ke editor Blogger.
7. Cari bagian konfigurasi JavaScript (sekitar baris 488):
   ```javascript
   const GAS_WEBAPP_URL = 'GANTI_DENGAN_URL_DEPLOYMENT_APPS_SCRIPT_ANDA';
   ```
   Ganti dengan Web app URL Apps Script Anda dari Langkah 3.
8. Klik tombol **Publikasikan (Publish)** di kanan atas.
9. Sekarang lihat tautan halaman tersebut. Bentuk URL-nya akan seperti ini:
   ```
   https://namayayasan.blogspot.com/p/cek-sertifikat.html
   ```

---

## 🏷️ 6. Langkah 5: Penerbitan Sertifikat & QR Code

Setiap sertifikat yang dicetak harus menyertakan QR Code yang mengarah langsung ke URL verifikasi peserta tersebut.

### Format Tautan QR Code:
```
https://namayayasan.blogspot.com/p/cek-sertifikat.html?id=YYS-2026-0001
```

### Opsi A: Menggunakan Generator Bawaan Kami (Paling Mudah)
Buka berkas [generator-sertifikat.html](file:///d:/2026/Web/Sertifikat/generator-sertifikat.html) di browser Anda.
- Masukkan URL halaman Blogger Anda.
- Ketik nama peserta, cabang lomba, predikat, dan tanggal.
- QR Code akan otomatis ter-generate secara presisi.
- Anda bisa langsung klik **Unduh Gambar (PNG High-Res)** atau **Cetak PDF**.
- Klik tombol **Salin Baris untuk Google Sheets** untuk langsung mem-paste data peserta ke database tanpa repot.

### Opsi B: Rumus Otomatis Gambar QR di Google Sheets
Jika Anda mencetak sertifikat dalam jumlah ratusan via Mail Merge / Google Docs:
1. Tambahkan Kolom G bernama `QR Code` di Google Sheets Anda.
2. Masukkan rumus ini di sel `G2`:
   ```excel
   =IMAGE("https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" & ENCODEURL("https://namayayasan.blogspot.com/p/cek-sertifikat.html?id=" & A2))
   ```
3. Gambar QR Code akan muncul otomatis di dalam spreadsheet!

---

## 🧪 7. Checklist Pengujian Sistem

Lakukan 5 pengujian ini sebelum sistem dibuka untuk publik:

- [ ] **Uji Nomor Aktif**: Buka `https://namayayasan.blogspot.com/p/cek-sertifikat.html?id=YYS-2026-0001`. Pastikan muncul badge hijau *"Sertifikat Resmi Terdaftar"* beserta nama dan lomba yang sesuai.
- [ ] **Uji Nomor Dicabut**: Buka `https://namayayasan.blogspot.com/p/cek-sertifikat.html?id=YYS-2026-0003`. Pastikan muncul badge merah *"Sertifikat Tidak Berlaku / Dicabut"*.
- [ ] **Uji Nomor Sembarang (Palsu)**: Ketik nomor `YYS-9999-9999`. Pastikan sistem menampilkan *"Sertifikat Tidak Ditemukan"*.
- [ ] **Uji Pindai HP**: Cetak atau buka QR Code di layar HP lain, pindai menggunakan kamera smartphone. Pastikan langsung membuka halaman Blogger dan otomatis menampilkan data peserta.
- [ ] **Uji Keamanan**: Pastikan dokumen Google Sheets Anda diset ke status **Restricted (Pribadi)**, BUKAN "Siapa saja yang memiliki link".

---

## 🛡️ Catatan Keamanan & Batasan Hukum

1. **Jenis Validasi**: Sistem ini memvalidasi **keberadaan registrasi dokumen dalam database resmi yayasan** (*Registry-based Verification*). Ini adalah standar yang lazim dipakai untuk sertifikat lomba, pelatihan, dan seminar nasional.
2. **Bukan TTE Kriptografis PSrE**: Jika instansi pemerintah atau mitra mensyaratkan Tanda Tangan Elektronik Tersertifikasi berpayung hukum UU ITE (misal via Peruri, BSrE, PrivyID), Anda dapat menambahkan tanda tangan digital tersertifikasi pada file PDF di kemudian hari. Untuk kebutuhan verifikasi keabsahan peserta lomba yayasan, sistem QR Code + Database Blogger ini sudah sangat memadai, elegan, dan anti-pemalsuan nomor.
