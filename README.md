

### 🛠️ Persiapan & Instalasi Lokal

Ikuti langkah-langkah berikut secara berurutan untuk menjalankan aplikasi di komputer lokal.

**Langkah 1 — Prasyarat (Prerequisites)**
- Node.js versi 18.17 atau lebih baru ([unduh di sini](https://nodejs.org/))
- Package manager: npm (sudah termasuk dalam Node.js), yarn, pnpm, atau bun
- Akses ke Google Sheet sumber data (untuk mengambil URL Apps Script sesuai panduan Admin di atas)

**Langkah 2 — Kloning Repositori**
```bash
git clone <url-repo->
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

**Langkah 5 — Jalankan Server Development**
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000) di browser Anda untuk melihat hasilnya.

---
