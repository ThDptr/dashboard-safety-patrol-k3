# 🏥 Dashboard Patroli Kesling & K3 RSOMH

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat-square&logo=tailwind-css)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?style=flat-square&logo=typescript)

Dashboard web responsif untuk memonitor kepatuhan **17 topik patroli** Kesehatan Lingkungan dan K3 di Rumah Sakit Otak Muhammad Hatta (RSOMH) Bukittinggi.

Dokumen ini berfungsi sebagai **Manual Book** terpadu untuk Pengguna (User), Administrator (Admin), dan Tim IT (Developer).

---

## 🌟 Fitur Utama

- 📊 **Visualisasi Data Interaktif**: Grafik gauge, diagram batang, dan tabel analisis kepatuhan per ruangan dan topik.
- 📥 **Export Laporan (Excel & PDF)**: Mengunduh data hasil patroli secara rapi dan terstruktur dalam format `.xlsx` dan `.pdf`.
- 🏢 **Manajemen Master Data & PCRA**: Admin dapat mengelola daftar ruangan, unit profesi, dan memonitor proyek konstruksi (PCRA).
- 🔒 **Kunci Bulan (Lock Month)**: Fitur bagi Admin untuk mengunci data patroli pada bulan tertentu agar tidak bisa diubah lagi.
- ⚡ **Kinerja Tinggi & Caching Cerdas**: Dilengkapi dengan *AbortController* untuk mencegah *race condition* saat perpindahan tab secara cepat, dan mekanisme *request deduplication* untuk mencegah *rate-limit* Google Apps Script.

---

## 🔗 Akses & Link Penting

> ⚠️ Tautan formulir, editor form, dan spreadsheet data **tidak dicantumkan di README publik** karena bersifat internal/sensitif. Seluruh tautan tersebut dikelola dan dapat dilihat/diubah oleh Admin melalui halaman **Pengaturan** di dashboard setelah login.

---

## 🚀 Teknologi yang Digunakan (Tech Stack)

### Frontend & UI
- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Library**: [React 18](https://react.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Ikon**: [Lucide React](https://lucide.dev/)
- **Grafik**: [Recharts](https://recharts.org/)

### Backend & Database
- **API**: Next.js API Routes (Serverless)
- **Database Utama**: Google Sheets
- **Penghubung Data**: Google Apps Script (menghasilkan JSON Endpoint)

### Utilitas (Utilities)
- **Manipulasi Tanggal**: `date-fns`
- **Export Data**: `exceljs`, `jspdf`, `jspdf-autotable`, `html2canvas`

---

## 📖 BUKU PANDUAN PENGGUNA (USER MANUAL)

Panduan ini ditujukan bagi pimpinan, staf K3, atau pengguna umum yang ingin melihat dan menganalisis hasil patroli K3.

### 1. Navigasi & Filter Dashboard
- **Halaman Utama (Ringkasan):** Menampilkan rata-rata kepatuhan semua 17 modul. Anda bisa melihat tren bulanan secara garis besar.
- **Menu Samping (Sidebar):** Klik salah satu dari 17 topik (misal: APD, APAR, PCRA, B3, dll) untuk melihat detail spesifik dari topik tersebut.
- **Filter Data:** Di bagian atas setiap halaman, terdapat dropdown filter:
  - **Bulan:** Pilih bulan laporan yang ingin dilihat.
  - **Ruangan:** (Opsional) Pilih ruangan/lokasi spesifik untuk mengerucutkan data.

### 2. Membaca Indikator Warna (Threshold)
Sistem menggunakan dua warna untuk menandakan status kepatuhan. Ambang batas (threshold) minimum dapat diatur oleh Admin untuk masing‑masing topik patroli. Secara bawaan, batas minimal adalah 90%.
🟢 Hijau (≥ Threshold): Memenuhi standar.
🔴 Merah (< Threshold): Di bawah standar, perlu tindakan perbaikan.
⚪ Belum ada data: Jika pada periode/ruangan tertentu belum tercatat data patroli, indikator akan berwarna abu‑abu atau menampilkan keterangan "Belum ada data".
Catatan: Untuk mengetahui atau mengubah batas minimum suatu topik, hubungi Admin. Admin dapat mengaturnya di halaman Admin Master Data → Kelola Standar.

### 3. Membaca Grafik dan Tabel Detail
Sistem secara otomatis menghitung tingkat kepatuhan secara presisi:
- **Grafik Setengah Lingkaran (Gauge):** Menunjukkan rata-rata persentase kepatuhan topik secara keseluruhan pada bulan yang dipilih.
- **Kepatuhan Per Pertanyaan:** Menunjukkan indikator mana yang paling lemah/sering dilanggar dalam bentuk diagram batang/bar.
- **Tabel Laporan Detail:** Menampilkan data baris-per-baris untuk setiap ruangan dan setiap jadwal patroli. Khusus untuk topik kompleks (seperti APD atau B3), terdapat *Tab* (opsi a, b, c) di atas tabel untuk melihat aspek yang berbeda (contoh: *Ketersediaan* vs *Kepatuhan Penggunaan*).
- **Logika Khusus APD (Karyawan):** Jika temuan dijawab "Tidak" (ada pelanggaran) namun tidak ada keterangan profesi/unit yang melanggar, sistem secara default hanya akan mengurangi **1** dari total karyawan sebagai asumsi minimal pelanggaran. Jika dijawab "Ya", kepatuhan otomatis 100% tanpa potongan.

### 4. Export Laporan (Excel & PDF)
- Di halaman detail topik, klik tombol **"📥 Export Excel"** atau **"📄 Export PDF"**.
- **Excel (`.xlsx`)**: Sistem akan mengunduh file spreadsheet berisi rekapitulasi data. Jika mengunduh Ringkasan Utama, rumus dan cara perhitungan akan tercetak rapi di bagian bawah tabel sebagai panduan.
- **PDF**: Halaman akan dirender menjadi format dokumen siap cetak.

---

## ⚙️ BUKU PANDUAN ADMIN (ADMIN MANUAL)

Panduan ini ditujukan bagi Admin K3 yang bertugas mengelola master data, membuat topik proyek PCRA, mengunci bulan, dan menjaga struktur Google Form.

### 1. Manajemen Master Data (Ruangan & Unit Profesi)
Master Data sangat vital karena digunakan sebagai **acuan dasar penyebut (denominator)** untuk menghitung persentase kepatuhan (seperti standar jumlah pegawai, jumlah APAR, atau jumlah lemari B3).
- **Akses:** Klik menu **"Admin Master Data"** (ikon gerigi) di pojok kiri bawah menu samping.
- **Login:** Masukkan kata sandi admin (diatur melalui environment variable `CRUD_SECRET`, lihat bagian Developer).
- **Kelola Ruangan:** Anda dapat menambah, mengedit, atau menonaktifkan ruangan. **Perhatian:** Tombol *Hapus* sengaja ditiadakan. Hal ini bertujuan agar sejarah data (history) bulan-bulan sebelumnya tidak rusak apabila ada ruangan yang sudah tidak aktif.
- **Kelola Unit Profesi Khusus:** Untuk modul APD, Anda dapat menambah profesi spesifik (seperti Dokter, Perawat, dll) menggunakan tombol khusus **"+ Tambah Profesi"**. Sistem akan otomatis menambahkan tanda `**` di depannya untuk membedakan antara Ruangan fisik dan Unit Profesi.

### 2. Manajemen Topik PCRA (Proyek Konstruksi)
Khusus untuk modul PCRA, Admin dapat membuat daftar proyek renovasi/pembangunan.
- **Akses:** Buka menu **PCRA** dari sidebar.
- **Login:** Klik tombol **"Kelola Topik PCRA"**, lalu masukkan kata sandi admin (`CRUD_SECRET`).
- **Kelola Proyek:** Anda bisa membuat proyek baru, menentukan tanggal mulai-selesai, dan memilih lokasi-lokasi yang terdampak proyek tersebut.
- Topik yang Anda buat akan langsung muncul sebagai opsi tab di dashboard PCRA.

### 3. Kunci Bulan (Lock Month)
- Admin dapat mengunci data bulan tertentu agar tidak berubah meskipun ada data yang telat masuk ke Google Form/Sheet.
- Fitur ini sangat berguna untuk keperluan pelaporan bulanan final.

### 4. Aturan Ketat Mengedit Google Form (Sangat Penting ⚠️)
Dashboard membaca data berdasarkan struktur dan nama pertanyaan di Google Form. Ikuti aturan ini agar sistem tidak *error*:
- **JANGAN Mengubah Teks Pertanyaan:** Jika form sudah berjalan, jangan ubah kalimat pertanyaan secara sembarangan (misal: *"Lokasi Temuan"* diubah menjadi *"Dimana lokasi temuan?"*). Ini akan merusak pemetaan kolom di Google Sheet!
- **JANGAN Menggunakan Tipe "Grid":** Hindari tipe pertanyaan *Pilihan Ganda Grid* atau *Kotak Centang Grid* karena susunannya rumit. Gunakan Dropdown, Pilihan Ganda biasa, atau Jawaban Singkat.
- **Menambah/Menghapus Pertanyaan:** Jika harus menambah/menghapus, hal tersebut memerlukan pembaruan kode (coding) oleh IT pada Google Apps Script dan *frontend* aplikasi agar sistem mengenali kolom yang baru.

### 5. Cara Mendapatkan URL Endpoint Google Apps Script
URL endpoint **tidak dibagikan di README ini**. Admin/IT wajib mengambilnya sendiri langsung dari Google Sheet sumber data, dengan langkah berikut:
1. Buka **Google Sheet** yang menjadi database aplikasi (akses melalui akun institusi, lihat panduan Serah Terima di bawah).
2. Klik menu **Ekstensi (Extensions)** → **Apps Script**.
3. Di editor Apps Script, klik tombol **Deploy** (kanan atas) → **Manage deployments** (jika sudah pernah deploy) atau **New deployment** (jika belum ada).
4. Pastikan pengaturan deployment:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Salin **Web app URL** yang muncul (formatnya `https://script.google.com/macros/s/XXXXXXX/exec`).
6. Tempelkan URL tersebut ke `.env.local` pada variabel `GOOGLE_SHEETS_WEBAPP_URL` (lihat bagian Developer).

> Jangan membagikan URL ini di dokumentasi publik, repository terbuka, atau chat yang tidak aman — siapa pun yang memegang URL ini berpotensi bisa membaca/menulis data ke Google Sheet sumber.

### 6. Panduan Serah Terima (Handover) ke Pihak RSOMH
1. **Email Institusi:** Gunakan akun resmi (misal: `k3.rsomh@gmail.com`).
2. **Transfer Ownership:** Jadikan email tersebut sebagai *Owner* dari file Google Form dan Google Sheet.
3. **Deploy Ulang Apps Script:** Buka Google Sheet via email institusi → ikuti langkah pada bagian **"5. Cara Mendapatkan URL Endpoint Google Apps Script"** di atas untuk membuat deployment baru dari akun institusi.
4. **Update Hosting:** Masukkan URL Web App Apps Script yang baru ke *Environment Variables* di platform hosting (misal: Vercel).

---

## 💻 DOKUMENTASI TEKNIS & DEVELOPER

Bagian ini khusus untuk tim IT/Developer yang ingin mengembangkan atau melakukan *maintenance* aplikasi tingkat lanjut.

### 🏗️ Arsitektur Sistem
```mermaid
flowchart LR
    A[Google Forms] -->|Input| B(Google Sheet)
    B -->|Tersimpan| C{Google Apps Script}
    C -->|JSON Endpoint| D[Next.js API Route]
    D -->|Agregasi & Proxy| E[Dashboard UI]
    E -->|Hosting| F((Vercel))
```

### 📂 Struktur Direktori Utama
```text
dashboard-safety-patrol-k3/
├── app/               # Next.js App Router (Halaman, API Routes)
├── components/        # Komponen React (UI, Charts, Modals)
├── lib/               # Fungsi Utilitas (Google Sheets fetcher, dll)
├── public/            # Aset statis (Gambar, Font)
├── package.json       # Dependencies dan script
└── tailwind.config.js # Konfigurasi Tailwind CSS
```

### 🛠️ Persiapan & Instalasi Lokal

Ikuti langkah-langkah berikut secara berurutan untuk menjalankan aplikasi di komputer lokal.

**Langkah 1 — Prasyarat (Prerequisites)**
- Node.js versi 18.17 atau lebih baru ([unduh di sini](https://nodejs.org/))
- Package manager: npm (sudah termasuk dalam Node.js), yarn, pnpm, atau bun
- Akses ke Google Sheet sumber data (untuk mengambil URL Apps Script sesuai panduan Admin di atas)

**Langkah 2 — Kloning Repositori**
```bash
git clone <url-repo-anda>
cd dashboard-safety-patrol-k3
```

**Langkah 3 — Install Dependencies**
```bash
npm install
```

**Langkah 4 — Ambil URL Endpoint Google Apps Script**
Sebelum mengisi environment variable, ambil dulu URL-nya langsung dari Google Sheet:
1. Buka Google Sheet sumber data → **Ekstensi** → **Apps Script**.
2. Klik **Deploy** → **Manage deployments** (atau **New deployment** bila belum pernah dibuat).
3. Salin **Web app URL** (format: `https://script.google.com/macros/s/XXXXXXX/exec`).

*(Detail lengkap ada di bagian "Cara Mendapatkan URL Endpoint Google Apps Script" pada Panduan Admin.)*

**Langkah 5 — Buat File Environment Variables**
Buat file `.env.local` di *root directory* proyek (**jangan pernah di-commit ke Git/GitHub** — pastikan `.env.local` sudah masuk `.gitignore`). Isi dengan variabel berikut:
```env
# URL Endpoint JSON dari Google Apps Script
# Ambil sendiri dari Google Sheet sumber data (lihat Langkah 4 di atas)
GOOGLE_SHEETS_WEBAPP_URL=

# Kata sandi admin untuk mengakses Master Data & PCRA
# Ganti dengan kata sandi Anda sendiri, jangan gunakan nilai contoh/default
CRUD_SECRET=
```

**Langkah 6 — Jalankan Server Development**
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000) di browser Anda untuk melihat hasilnya.

---

### 🔑 Catatan Keamanan Environment Variables
- File `.env.local` berisi kredensial rahasia (URL endpoint data & password admin). **Jangan pernah** dibagikan di README, dokumentasi publik, chat, atau di-commit ke repository Git.
- Gunakan nilai **unik milik Anda sendiri**, jangan memakai contoh/default yang pernah dipublikasikan sebelumnya.
- Di platform hosting (Vercel, dsb), isi environment variable yang sama melalui menu **Settings → Environment Variables**, bukan lewat file yang ikut ter-deploy.

### ❓ Tentang `GEMINI_API_KEY` dan Fitur AI Summary
Fitur **Ringkasan Cerdas (AI Summary)** menggunakan Google Gemini API sudah **dihapus** dari aplikasi ini. Konsekuensinya:
- Variabel `GEMINI_API_KEY` **tidak lagi diperlukan** dan aman untuk dihapus dari `.env.local`.
- Agar tidak muncul error, pastikan juga bagian kode berikut sudah dihapus/tidak dipanggil (bukan hanya env-nya):
  - Tombol/komponen UI **"✨ Buat Ringkasan AI"** beserta kolom instruksi tambahannya.
  - API Route yang memanggil Gemini (misalnya `app/api/ai-summary/...` atau serupa — sesuaikan dengan struktur project Anda).
  - Import/fungsi utilitas terkait Gemini di `lib/` jika ada.
- **Penting:** Menghapus `GEMINI_API_KEY` saja dari `.env.local` **tanpa** menghapus kode di atas berisiko membuat fitur AI Summary error saat tombolnya diklik (karena API call ke Gemini akan gagal). Fitur-fitur lain (dashboard, export Excel/PDF, master data, PCRA, lock month) **tidak terpengaruh** dan tetap berjalan normal karena tidak bergantung pada `GEMINI_API_KEY`.

### 🌐 API Routes & Manajemen Cache
- **Keamanan Proxy:** Seluruh penarikan data ke Google dilakukan via server-side API Routes (`/api/master`, `/api/patrol-data`, `/api/lock-month`). Kunci rahasia seperti `CRUD_SECRET` tervalidasi menggunakan backend sehingga tidak terekspos ke sisi klien (browser).
- **Efisiensi Pengambilan Data:** Pengambilan data paralel diproses menggunakan `Promise.allSettled` agar *error* di satu data (misal: 1 module gagal dimuat) tidak membatalkan keseluruhan *render* halaman (Fault Tolerance).
- **Cache Invalidation:** Manajemen *cache* memori (60 detik TTL) diatur di dalam `lib/google-sheets.ts` atau modul sejenisnya untuk menghindari *rate-limit* Google Apps Script.
- Operasi CRUD (Tambah/Edit) di endpoint `/api/master` akan otomatis memanggil fungsi invalidasi *cache*, sehingga data terbaru akan langsung tersaji tanpa *delay*.

### 🔧 Skrip NPM yang Tersedia
- `npm run dev`: Menjalankan aplikasi dalam mode *development*.
- `npm run build`: Membangun (build) aplikasi untuk *production*.
- `npm run start`: Menjalankan aplikasi hasil *build production*.
- `npm run lint`: Menjalankan pengecekan *linter* ESLint.

### 🐞 Troubleshooting Server & Error Handling
| Masalah / Error | Kemungkinan Penyebab | Solusi |
|-----------------|----------------------|--------|
| `GOOGLE_SHEETS_WEBAPP_URL is not set` | Environment variable belum dikonfigurasi. | Pastikan file `.env.local` sudah dibuat beserta variabelnya sesuai Langkah 4–5 di atas. Restart server `npm run dev` setelah membuat file. |
| `Web App returned HTTP 403` / `CORS Error` | Script Google tidak diizinkan untuk diakses publik. | Masuk ke Apps Script, lalu redeploy sebagai "Web App" dengan akses **"Anyone" (Siapa saja)**. |
| Data di Dashboard Kosong | Tidak ada data di bulan tersebut, atau header Form berubah. | Periksa apakah ada pengisian di bulan yang dipilih pada Google Sheets. Pastikan juga nama *header* kolom di Sheet sama persis dengan yang diharapkan kode. |

---

> **Dikembangkan untuk RSOMH Bukittinggi - Bidang Kesehatan Lingkungan & K3**