# Panduan Sistem Verifikasi & Generator Sertifikat
### Syarief Internasional Boarding School (Bondowoso)

Sistem ini telah dikhususkan secara eksklusif untuk **Syarief Internasional Boarding School** dengan pemisahan hak akses:
1. **Untuk Publik / Santri / Orang Tua**:
   - Hanya dapat mengakses **Halaman Pencarian / Verifikasi** (`/` dan `/verify/:id`).
   - Bisa memindai QR Code via kamera HP atau memasukkan nomor sertifikat.
   - **TIDAK BISA** melihat atau mengakses alat pembuat sertifikat / QR Code.
2. **Khusus Pengurus / Admin (Anda)**:
   - Terlindungi oleh **Kunci PIN Keamanan** (`/admin`).
   - Digunakan untuk menerbitkan sertifikat, membuat QR Code unik, mengunduh file gambar (PNG) / cetak PDF, dan menyalin data ke Google Sheets.

---

## 🏛️ Profil Identitas Lembaga & Penanda Tangan

Data resmi yang telah tertanam di dalam seluruh sistem:
- **Nama Yayasan:** `Syarief Internasional Boarding School` (SIBS)
- **Unit Lembaga:** `Lembaga Pendidikan Al-Quran Syarief Institute Bondowoso`
- **Alamat Resmi:** `Dusun Bunduh RT 09 RW 03, Desa Bataan, Kecamatan Tenggarang, Kabupaten Bondowoso, Jawa Timur`
- **Penanda Tangan:**
  - **Nama:** `Anggit Hadi Prasaja, M.Pd`
  - **NIK:** `357110905950006`
  - **Jabatan:** `Kepala Lembaga Pendidikan Al-Quran Syarief Institute Bondowoso`

---

## 🔒 Akses Admin Pembuat Sertifikat & QR Code

- **Alamat URL Admin:**  
  `https://nama-proyek-anda.vercel.app/admin`  
  *(atau saat uji coba lokal: `http://localhost:3000/admin`)*
- **PIN Keamanan Bawaan:**  
  ```
  syarief2026
  ```
  *(Hanya Anda yang mengetahui PIN ini. Jika pengunjung biasa mencoba membuka `/admin`, mereka akan tertahan di layar kunci).*

### Fitur di Panel Admin:
1. **Input Data Santri**: Masukkan ID (`SIBS-2026-0001`), nama lengkap, nama kegiatan/lomba, dan prestasi.
2. **Live QR Code Generator**: Otomatis membuat QR Code yang terhubung ke link verifikasi yayasan Anda:  
   `https://domainanda.vercel.app/verify/SIBS-2026-0001`
3. **Unduh Gambar (PNG High-Res)**: Siap dicetak langsung atau dikirim ke percetakan.
4. **Cetak PDF**: Format presisi ukuran kertas A4 Landscape.
5. **Salin Baris Google Sheets**: Tombol 1-klik untuk menyalin format baris santri agar Anda tinggal `Ctrl + V` di Google Sheets tanpa mengetik ulang.

---

## 📊 Menghubungkan Google Sheets Yayasan

Agar status keaslian dapat dipantau dan diubah kapan saja (misal: membatalkan sertifikat menjadi `DICABUT` atau menyematkan file sertifikat Google Drive):

1. Buat Google Sheets bernama **`Database Sertifikat Yayasan`** dengan nama tab **`Sertifikat`**.
2. Kolom baris pertama (Header):
   - Kolom A: `ID` (contoh: `SIBS-2026-0001`)
   - Kolom B: `Nama` (contoh: `Muhammad Rizky Pratama`)
   - Kolom C: `Lomba` (contoh: `Musabaqah Hifdzil Qur'an (MHQ) 30 Juz`)
   - Kolom D: `Predikat` (contoh: `Juara 1 Tingkat Provinsi`)
   - Kolom E: `Tanggal` (contoh: `18 Oktober 2026`)
   - Kolom F: `Status` (ketik `AKTIF` atau `DICABUT`)
   - **Kolom G (Baru): `Link_File`** (Link file Google Drive dari sertifikat santri, contoh: `https://drive.google.com/file/d/xxx/view?usp=sharing`)
3. **Pengaturan File Google Drive**:
   - Pastikan file sertifikat (PDF atau Gambar) di Google Drive Anda diatur ke: **"Anyone with the link can view"** (*Siapa saja yang memiliki link dapat melihat*).
   - Sistem web akan secara otomatis mengubah link tersebut menjadi tombol **👁️ Pratinjau Dokumen (Preview Modal)** dan **📥 Unduh Sertifikat (Direct Download)** tanpa biaya apa pun (*100% Gratis di Vercel*).
4. Atur izin berbagi (*Share*) Google Sheets:
   Ubah akses umum menjadi **"Anyone with the link (Siapa saja yang memiliki link)"** sebagai **Viewer (Pelihat)**.
5. Di Vercel Dashboard, buka **Settings** ➔ **Environment Variables**:
   - `SPREADSHEET_ID` = `[ID_SPREADSHEET_ANDA]`
   - `SHEET_NAME` = `Sertifikat`

---

## 🔍 Fitur Pencarian Berdasarkan Nama Santri

Pengunjung dapat mencari sertifikat dengan 2 cara:
1. **Pencarian via Nomor Registrasi**: Memasukkan kode sertifikat (contoh: `SIBS-2026-0001`).
2. **Pencarian via Nama Santri**: Memasukkan nama lengkap santri.
   - **Toleran Huruf Besar/Kecil (*Case-Insensitive*)**: Pengetikan `agung budi santoso`, `AGUNG BUDI SANTOSO`, maupun `Agung Budi Santoso` akan diproses sama persis.
   - **Penanganan Banyak Sertifikat**: Jika santri memenangkan lebih dari 1 lomba, sistem akan menampilkan daftar seluruh piagam santri tersebut agar pengguna bisa memilih lomba mana yang ingin diverifikasi dan diunduh.

---

## 🚀 Cara Menjalankan & Menguji di Laptop

1. Buka terminal di folder `d:\2026\Web\Sertifikat`.
2. Jalankan perintah:
   ```bash
   node server.js
   ```
3. Buka browser:
   - **Halaman Publik Santri/Umum:** [http://localhost:3000](http://localhost:3000)
   - **Contoh Verifikasi Sah:** [http://localhost:3000/verify/SIBS-2026-0001](http://localhost:3000/verify/SIBS-2026-0001)
   - **Panel Khusus Pembuat QR Code (Admin):** [http://localhost:3000/admin](http://localhost:3000/admin) (PIN: `syarief2026`)
