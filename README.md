# Dashboard Patroli Kesling & K3 RSOMH

Dashboard web untuk memantau hasil patroli Kesehatan Lingkungan (Kesling) dan Keselamatan & Kesehatan Kerja (K3) RSOMH. Data bersumber dari Google Sheet yang diekspos lewat **Google Apps Script Web App**, lalu ditampilkan oleh aplikasi Next.js.

**Demo:** https://dashboard-safety-patrol-k3.vercel.app

## Daftar Isi

1. [Tech Stack](#tech-stack)
2. [Arsitektur Singkat](#arsitektur-singkat)
3. [Instalasi Lokal](#instalasi-lokal)
4. [Konfigurasi Environment (`.env`)](#konfigurasi-environment-env)
5. [Mengambil URL API (Google Apps Script)](#mengambil-url-api-google-apps-script)
6. [Panduan Hosting untuk Tim IT](#panduan-hosting-untuk-tim-it)
7. [Update & Pemeliharaan](#update--pemeliharaan)
8. [Troubleshooting](#troubleshooting)
9. [Checklist Keamanan](#checklist-keamanan)

---

## Tech Stack

| Komponen | Teknologi |
| --- | --- |
| Framework | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS, next-themes |
| Grafik | Recharts |
| Ekspor | ExcelJS, jsPDF, html2canvas |
| PWA | @ducanh2912/next-pwa |
| Sumber data | Google Sheets via Google Apps Script Web App |

## Arsitektur Singkat

```
Browser  ──►  Next.js (server Anda)  ──►  Google Apps Script Web App  ──►  Google Sheet
              membaca .env.local            (URL + CRUD_SECRET)
```

Browser tidak berbicara langsung ke Google Sheet. Server Next.js yang memanggil Web App Apps Script menggunakan variabel environment di bawah.

---

## Instalasi Lokal

### Prasyarat

- **Node.js 18.17 atau lebih baru** (disarankan versi LTS 20 atau 22) — [nodejs.org](https://nodejs.org/)
- **npm** (sudah termasuk di Node.js), atau yarn / pnpm / bun
- **Git**
- Akses **Editor** ke Google Sheet sumber data (untuk mengambil URL Apps Script)

Cek versi:

```bash
node -v   # harus >= v18.17
npm -v
```

### Langkah-langkah

**1. Kloning repositori**

```bash
git clone https://github.com/ThDptr/dashboard-safety-patrol-k3.git
cd dashboard-safety-patrol-k3
```

**2. Install dependencies**

```bash
npm install
```

**3. Siapkan file environment**

```bash
cp .env.example .env.local
```

Lalu isi nilainya. Panduan lengkap ada di bagian [Konfigurasi Environment](#konfigurasi-environment-env).

**4. Jalankan server development**

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

### Script yang tersedia

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Server development (hot reload) |
| `npm run build` | Build production |
| `npm start` | Menjalankan hasil build (port 3000) |
| `npm run lint` | Pengecekan ESLint |

---

## Konfigurasi Environment (`.env`)

Buat file `.env.local` di root proyek (untuk lokal) atau `.env.production` / environment server (untuk produksi). **File ini tidak boleh di-commit ke Git.**

```dotenv
# Dashboard Patroli Kesling & K3 RSOMH

# URL Web App Google Apps Script (sumber data)
GOOGLE_SHEETS_WEBAPP_URL=https://script.google.com/macros/s/ISI_DEPLOYMENT_ID_ANDA/exec

# Kunci rahasia untuk operasi tulis (tambah/ubah/hapus data)
CRUD_SECRET=ganti_dengan_string_acak_yang_panjang
```

### Penjelasan variabel

| Variabel | Wajib | Fungsi |
| --- | --- | --- |
| `GOOGLE_SHEETS_WEBAPP_URL` | Ya | Alamat endpoint Web App Apps Script yang menjadi sumber data dashboard. Formatnya `https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec`. Cara mendapatkannya ada di [bagian berikutnya](#mengambil-url-api-google-apps-script). |
| `CRUD_SECRET` | Ya | Kata sandi bersama (shared secret) antara aplikasi dan Apps Script. Dipakai untuk mengotorisasi operasi tulis (create / update / delete). Nilainya **harus sama persis** dengan yang tersimpan di Apps Script. |

### Aturan penting

- **Jangan** memberi awalan `NEXT_PUBLIC_` pada kedua variabel ini. Awalan tersebut membuat nilainya ikut terkirim ke browser dan bisa dilihat siapa saja.
- Setelah mengubah `.env`, **restart** server (`npm run dev` ulang, atau restart proses di produksi).
- Jangan menaruh nilai asli di README, issue, chat, atau screenshot. Gunakan placeholder.
- Pakai nilai berbeda untuk lokal/staging dan produksi.

### Membuat `CRUD_SECRET` yang kuat

Hindari kata yang mudah ditebak. Buat string acak:

```bash
# Linux / macOS / Git Bash
openssl rand -hex 32

# atau dengan Node.js (semua OS)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Menyamakan `CRUD_SECRET` di Apps Script

Simpan secret di **Script Properties** agar tidak tertulis di kode:

1. Buka Apps Script → ikon **⚙️ Project Settings** (Setelan Project).
2. Gulir ke **Script Properties** → **Add script property**.
3. Property: `CRUD_SECRET`, Value: isi dengan nilai yang sama dengan di `.env`.
4. Simpan, lalu di kode Apps Script bacalah dengan:

```javascript
const SECRET = PropertiesService.getScriptProperties().getProperty('CRUD_SECRET');
```

> Catatan: cara pengecekan secret di sisi Apps Script mengikuti implementasi `doGet` / `doPost` yang sudah ada. Pastikan nama parameter yang dikirim aplikasi cocok dengan yang dicek di script.

### Template `.env.example`

Commit file ini ke repo sebagai acuan (tanpa nilai asli):

```dotenv
GOOGLE_SHEETS_WEBAPP_URL=
CRUD_SECRET=
```

Pastikan `.gitignore` memuat:

```gitignore
.env
.env.local
.env.production
```

---

## Mengambil URL API (Google Apps Script)

Endpoint data diambil dari **Web App** yang sudah di-deploy di Google Sheet sumber data.

### A. Mengambil URL dari deployment yang sudah ada

1. Buka **Google Sheet** sumber data.
2. Klik menu **Ekstensi** → **Apps Script**.
3. Klik **Deploy** (kanan atas) → **Manage deployments**.
4. Pilih deployment bertipe **Web app**.
5. Salin **Web app URL**. Formatnya:
   ```
   https://script.google.com/macros/s/XXXXXXXXXXXXXXXX/exec
   ```
6. Tempel ke `GOOGLE_SHEETS_WEBAPP_URL` di `.env.local`.

### B. Membuat deployment baru (jika belum ada)

1. Di editor Apps Script, klik **Deploy** → **New deployment**.
2. Klik ikon ⚙️ di samping "Select type" → pilih **Web app**.
3. Isi:
   - **Description:** misalnya `Dashboard K3 v1`
   - **Execute as:** `Me` (akun pemilik script)
   - **Who has access:** `Anyone`
4. Klik **Deploy**, lalu **Authorize access** dan setujui izin Google.
5. Salin **Web app URL** yang muncul.

> **Mengapa "Anyone"?** Server Next.js memanggil Web App tanpa login Google. Karena URL-nya bisa diakses siapa pun yang tahu, **rahasiakan URL ini** dan andalkan `CRUD_SECRET` untuk melindungi operasi tulis.

### C. Mengubah kode Apps Script → wajib deploy ulang

Perubahan kode **tidak otomatis** berlaku pada URL `/exec`. Setelah mengedit:

1. **Deploy** → **Manage deployments** → ikon ✏️ (edit) pada deployment.
2. Pada **Version**, pilih **New version**.
3. Klik **Deploy**. URL `/exec` tetap sama.

Kalau memilih **New deployment**, URL berubah dan `.env` harus diperbarui.

### D. Menguji endpoint

Cek bahwa endpoint merespons data (bukan halaman login Google):

```bash
curl -L "https://script.google.com/macros/s/ISI_DEPLOYMENT_ID_ANDA/exec"
```

Hasil yang benar adalah JSON data. Jika yang muncul HTML halaman login Google, berarti akses deployment belum diatur ke **Anyone**.

> Pakai opsi `-L` karena Apps Script melakukan redirect ke domain `googleusercontent.com`.

---

## Panduan Hosting untuk Tim IT

Aplikasi ini adalah **Next.js 14** yang membutuhkan **server Node.js** (bukan static hosting biasa), karena membaca environment variable di sisi server.

Pilih salah satu opsi:

| Opsi | Cocok untuk |
| --- | --- |
| **A. VPS / server Linux (PM2 + Nginx)** | Server sendiri atau server RS, kontrol penuh |
| **B. Docker** | Tim yang sudah memakai container |
| **C. Vercel** | Paling cepat, tanpa kelola server (data lewat internet publik) |

### Kebutuhan server minimum

- OS: Ubuntu 22.04 / 24.04 LTS (atau setara)
- RAM: 1 GB (disarankan 2 GB agar proses `build` lancar)
- Node.js 18.17+ (disarankan 20 LTS)
- Koneksi **keluar (outbound HTTPS)** ke `script.google.com` dan `*.googleusercontent.com`
- Domain atau subdomain (mis. `patroli.rsomh.id`) dan sertifikat HTTPS
- Port 80 dan 443 terbuka; port 3000 **cukup lokal saja**

> **HTTPS wajib.** Aplikasi ini PWA, dan service worker hanya aktif di HTTPS (kecuali `localhost`).

---

### Opsi A — VPS Linux dengan PM2 + Nginx

**1. Install Node.js 20 LTS, Git, Nginx**

```bash
sudo apt update && sudo apt install -y git nginx curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

**2. Buat user khusus (disarankan, jangan pakai root)**

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo su - deploy
```

**3. Ambil kode & install**

```bash
git clone https://github.com/ThDptr/dashboard-safety-patrol-k3.git
cd dashboard-safety-patrol-k3
npm ci
```

**4. Buat file environment produksi**

```bash
nano .env.production
```

Isi:

```dotenv
GOOGLE_SHEETS_WEBAPP_URL=https://script.google.com/macros/s/ISI_DEPLOYMENT_ID_ANDA/exec
CRUD_SECRET=ISI_SECRET_PRODUKSI
```

Kunci permission file:

```bash
chmod 600 .env.production
```

**5. Build**

```bash
npm run build
```

**6. Jalankan dengan PM2**

```bash
sudo npm install -g pm2
pm2 start npm --name "dashboard-k3" -- start
pm2 save
pm2 startup        # jalankan perintah sudo yang dicetak, agar otomatis hidup setelah reboot
```

Aplikasi sekarang berjalan di `http://127.0.0.1:3000`. Untuk memakai port lain: `pm2 start npm --name "dashboard-k3" -- start -- -p 3001`.

**7. Konfigurasi Nginx (reverse proxy)**

```bash
sudo nano /etc/nginx/sites-available/dashboard-k3
```

```nginx
server {
    listen 80;
    server_name patroli.rsomh.id;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Aktifkan:

```bash
sudo ln -s /etc/nginx/sites-available/dashboard-k3 /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**8. Pasang HTTPS (Let's Encrypt)**

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d patroli.rsomh.id
```

**9. Firewall**

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

**10. Verifikasi**

```bash
pm2 status
pm2 logs dashboard-k3 --lines 50
curl -I https://patroli.rsomh.id
```

---

### Opsi B — Docker

Buat `Dockerfile` di root proyek:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "start"]
```

Buat `.dockerignore`:

```
node_modules
.next
.env
.env.*
.git
```

Build dan jalankan, dengan env dimasukkan saat runtime (bukan ditanam di image):

```bash
docker build -t dashboard-k3 .

docker run -d --name dashboard-k3 \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -e GOOGLE_SHEETS_WEBAPP_URL="https://script.google.com/macros/s/ISI_DEPLOYMENT_ID_ANDA/exec" \
  -e CRUD_SECRET="ISI_SECRET_PRODUKSI" \
  dashboard-k3
```

Atau dengan `docker-compose.yml`:

```yaml
services:
  dashboard-k3:
    build: .
    container_name: dashboard-k3
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    env_file:
      - .env.production
```

```bash
docker compose up -d --build
```

Lalu arahkan Nginx (atau reverse proxy lain) ke `127.0.0.1:3000` seperti pada Opsi A langkah 7–8.

---

### Opsi C — Vercel

1. Login ke [vercel.com](https://vercel.com) dan klik **Add New → Project**.
2. Import repositori GitHub.
3. Pada **Environment Variables**, tambahkan `GOOGLE_SHEETS_WEBAPP_URL` dan `CRUD_SECRET`.
4. Klik **Deploy**.
5. Setiap `git push` ke branch `main` otomatis memicu deploy ulang.

Mengubah env di Vercel: **Project → Settings → Environment Variables**, lalu **Redeploy** agar berlaku.

---

## Update & Pemeliharaan

**Update aplikasi (Opsi A):**

```bash
cd ~/dashboard-safety-patrol-k3
git pull origin main
npm ci
npm run build
pm2 restart dashboard-k3 --update-env
```

**Update aplikasi (Opsi B):**

```bash
git pull origin main
docker compose up -d --build
```

**Perintah PM2 yang sering dipakai:**

| Perintah | Fungsi |
| --- | --- |
| `pm2 status` | Lihat status proses |
| `pm2 logs dashboard-k3` | Lihat log |
| `pm2 restart dashboard-k3` | Restart |
| `pm2 stop dashboard-k3` | Hentikan |

**Mengganti URL Apps Script atau secret:** edit `.env.production`, lalu `pm2 restart dashboard-k3 --update-env` (atau `docker compose up -d`).

**Backup:** data utama ada di Google Sheet. Aktifkan riwayat versi Google Sheet dan salin berkala (File → Buat salinan) sebagai cadangan.

---

## Troubleshooting

| Gejala | Kemungkinan penyebab | Solusi |
| --- | --- | --- |
| Data kosong / error 500 | `GOOGLE_SHEETS_WEBAPP_URL` kosong atau salah | Cek `.env`, restart server |
| Respons berupa halaman login Google | Deployment belum diset **Anyone** | Edit deployment → Who has access: Anyone → deploy versi baru |
| Perubahan Apps Script tidak muncul | Belum deploy versi baru | Manage deployments → New version → Deploy |
| Operasi tambah/ubah/hapus ditolak | `CRUD_SECRET` di aplikasi ≠ di Apps Script | Samakan keduanya, restart |
| `Error: Cannot find module` / build gagal | Dependency belum terpasang atau Node terlalu lama | `npm ci`, pastikan Node ≥ 18.17 |
| Build mati / `Killed` | RAM server kurang | Tambah RAM atau swap 2 GB |
| `502 Bad Gateway` di Nginx | Proses Next.js tidak berjalan | `pm2 status`, `pm2 logs dashboard-k3` |
| Port 3000 sudah dipakai | Proses lain memakai port tersebut | Jalankan dengan `-p 3001` dan sesuaikan Nginx |
| Server tidak bisa mengambil data | Outbound ke Google diblokir firewall/proxy | Izinkan HTTPS keluar ke `script.google.com` dan `*.googleusercontent.com` |
| PWA tidak bisa di-install | Belum memakai HTTPS | Pasang sertifikat (Let's Encrypt) |

---

## Checklist Keamanan

- [ ] `.env`, `.env.local`, dan `.env.production` masuk `.gitignore` dan tidak pernah ter-commit
- [ ] `CRUD_SECRET` berupa string acak panjang (minimal 32 karakter) dan berbeda di tiap environment
- [ ] Jika URL Apps Script atau `CRUD_SECRET` pernah terekspos (chat, repo publik, screenshot), **buat deployment baru dan ganti secret**
- [ ] Variabel env tidak memakai awalan `NEXT_PUBLIC_`
- [ ] Aplikasi diakses lewat HTTPS
- [ ] Port 3000 tidak dibuka ke publik (hanya Nginx yang mengaksesnya)
- [ ] Server berjalan dengan user non-root
- [ ] Sistem operasi dan Node.js diperbarui berkala
- [ ] File sampah/debug di repo (`debug.log`, `old_code.txt`, `tmp-*.js`, `.idea/`) dibersihkan dan tidak berisi data sensitif

---

## Lisensi & Kontak

Dikembangkan untuk keperluan internal RSOMH. Hubungi tim pengembang/IT untuk dukungan dan akses.
