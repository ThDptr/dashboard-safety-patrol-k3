// ─────────────────────────────────────────────────────────────────────────────
// lib/google-sheets.ts — Fetch & Parse from Google Apps Script Web App
// Dashboard Patroli Kesling & K3 RSOMH
// ─────────────────────────────────────────────────────────────────────────────

export type Jawaban = "Ya" | "Tidak" | "N/A" | "";

/** Raw row from the Web App — keys are exact column headers */
export type RawRow = Record<string, string>;

/** Normalized response from the Web App */
export interface WebAppResponse {
  headers: string[];
  data: RawRow[];
  total: number;
}

// ─── Identity fields present in ALL rows ─────────────────────────────────────
export interface PatroliRow {
  /** Original raw row (all columns) */
  raw: RawRow;
  timestamp: string;
  tanggalPemantauan: string;
  namaPetugas: string;
  jenisPemantauan: string;
  ruangan: string;
  frekuensiPemantauan: string;
  patroliKe: number;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

const WEBAPP_URL = process.env.GOOGLE_SHEETS_WEBAPP_URL!;

const globalForCache = globalThis as unknown as {
  _patrolCache?: { data: PatroliRow[]; fetchedAt: number };
  _masterCache?: Map<string, { data: any[]; fetchedAt: number }>;
};

const CACHE_TTL_MS = 300_000; // 5 minutes

/**
 * Fetch patrol data from the Apps Script Web App.
 * Uses an in-memory cache with 5-minute TTL.
 * This function is safe to call from Next.js API routes (server-side only).
 */
export async function fetchPatrolData(): Promise<PatroliRow[]> {
  const now = Date.now();
  const cache = globalForCache._patrolCache;

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  if (!WEBAPP_URL) {
    throw new Error(
      "GOOGLE_SHEETS_WEBAPP_URL is not set. Please add it to .env.local."
    );
  }

  const res = await fetch(WEBAPP_URL, {
    // Next.js 14 fetch cache with revalidate
    next: { revalidate: 60 },
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(
      `Web App returned HTTP ${res.status}: ${await res.text().then((t) => t.slice(0, 200))}`
    );
  }

  const json: WebAppResponse = await res.json();

  const rows = normalizeRows(json);
  globalForCache._patrolCache = { data: rows, fetchedAt: now };
  return rows;
}

const MASTER_CACHE_TTL_MS = 3_600_000; // 1 hour

if (!globalForCache._masterCache) {
  globalForCache._masterCache = new Map<string, { data: any[], fetchedAt: number }>();
}

export async function fetchMasterData(target: string): Promise<any[]> {
  const now = Date.now();
  const cached = globalForCache._masterCache!.get(target);

  if (cached && now - cached.fetchedAt < MASTER_CACHE_TTL_MS) {
    return cached.data;
  }

  if (!WEBAPP_URL) {
    throw new Error("GOOGLE_SHEETS_WEBAPP_URL is not set.");
  }

  const SECRET = process.env.CRUD_SECRET || "rahasia_rsomh_k3";
  const payload = { action: "read", target: target, secret: SECRET, token: SECRET };
  
  const url = new URL(WEBAPP_URL);
  for (const key in payload) {
    url.searchParams.append(key, payload[key as keyof typeof payload].toString());
  }

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`Master fetch failed: ${res.status}`);
  }

  const json = await res.json();
  const rows = json.data || [];
  
  globalForCache._masterCache!.set(target, { data: rows, fetchedAt: now });
  return rows;
}

export function invalidateMasterCache(target: string) {
  if (globalForCache._masterCache) {
    globalForCache._masterCache.delete(target);
  }
}

// ─── Normalization ────────────────────────────────────────────────────────────

function normalizeRows(json: WebAppResponse): PatroliRow[] {
  return json.data.map((row) => ({
    raw: row,
    timestamp: row["Timestamp"] ?? "",
    tanggalPemantauan: row["Tanggal Pemantauan"] ?? "",
    namaPetugas: row["Nama Petugas"] ?? "",
    jenisPemantauan: row["Jenis Pemantauan"] ?? "",
    ruangan: row["Ruangan"] ?? "",
    frekuensiPemantauan: row["Frekuensi Pemantauan"] ?? "",
    patroliKe: parseInt(row["Patroli ke-"] ?? "0", 10) || 0,
  }));
}

// ─── Field accessors ──────────────────────────────────────────────────────────

/**
 * Get the answer for a specific question column in a row.
 * Returns "Ya", "Tidak", "N/A", or "" (empty).
 * Safely coerces value to string first (Web App may return numbers or null).
 */
export function getAnswer(row: PatroliRow, sheetHeader: string): Jawaban {
  const raw = row.raw[sheetHeader];
  const val = raw == null ? "" : String(raw).trim();
  if (val === "Ya") return "Ya";
  if (val === "Tidak") return "Tidak";
  if (val === "N/A") return "N/A";
  return "";
}

/**
 * Get a string field value from a row.
 * Safely coerces value to string first.
 */
export function getField(row: PatroliRow, sheetHeader: string): string {
  const raw = row.raw[sheetHeader];
  return raw == null ? "" : String(raw).trim();
}

/**
 * Get a numeric field. Tries parseInt first, falls back to 0.
 * Returns the raw string as well for tooltip display.
 */
export function getNumericField(
  row: PatroliRow,
  sheetHeader: string
): { value: number; raw: string } {
  const rawVal = row.raw[sheetHeader];
  const raw = rawVal == null ? "" : String(rawVal).trim();
  const value = parseInt(raw.replace(/[^\d]/g, ""), 10);
  return { value: isNaN(value) ? 0 : value, raw };
}

/**
 * Get the "display identity" for a row — the field used as "location" in
 * different jalur patroli.
 */
export function getDisplayLocation(row: PatroliRow): string {
  const jenis = row.jenisPemantauan.toLowerCase();
  let loc = "-";
  if (jenis === "pcra") {
    loc = row.raw["PCRA - Lokasi dan deskripsi pekerjaan"] || row.ruangan || "PCRA";
  } else if (jenis === "luar gedung") {
    loc = row.raw["Lokasi"] || row.ruangan || "Luar Gedung";
  } else if (jenis.includes("b3")) {
    loc = row.raw["Ruangan patroli B3"] || row.ruangan || "B3";
  } else {
    // Dalam Gedung
    loc = row.ruangan || "-";
  }
  return typeof loc === "string" ? loc.trim() : String(loc).trim();
}

// ─── Filtering ────────────────────────────────────────────────────────────────

/**
 * Parse a timestamp string and return an object representing the date in WIB (UTC+7).
 * We use getUTC* methods on the resulting Date to read the WIB local time.
 */
export function parseWIBDate(ts: string): Date {
  if (!ts) return new Date(0);
  
  let d: Date;
  // Google Sheets: "7/22/2026 8:31:00" (M/D/YYYY H:MM:SS) -> local time in Vercel usually,
  // but if it's already an ISO string (which it is for our web app script usually), it parses as UTC.
  const match = ts.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, m, dStr, y] = match;
    // Assuming M/D/Y from Google Form is already WIB, we just construct it as UTC to avoid local timezone offset shifts
    d = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(dStr)));
  } else {
    d = new Date(ts);
    // Shift by UTC+7 for WIB
    d = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  }
  return d;
}

export function filterByBulan(rows: PatroliRow[], bulan: string): PatroliRow[] {
  return rows.filter((r) => {
    // Gunakan Tanggal Pemantauan sebagai prioritas (MASALAH 2)
    const targetDate = r.tanggalPemantauan || r.timestamp;
    const d = parseWIBDate(targetDate);
    // Read the shifted UTC time which now represents WIB
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${mo}` === bulan;
  });
}

export function filterByDateRange(
  rows: PatroliRow[],
  startDateStr: string,
  endDateStr: string
): PatroliRow[] {
  if (!startDateStr && !endDateStr) return rows;
  return rows.filter((r) => {
    const targetDate = r.tanggalPemantauan || r.timestamp;
    const d = parseWIBDate(targetDate);
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    const date = String(d.getUTCDate()).padStart(2, "0");
    const dateStr = `${y}-${mo}-${date}`;
    // Compare YYYY-MM-DD directly
    const matchStart = !startDateStr || dateStr >= startDateStr;
    const matchEnd = !endDateStr || dateStr <= endDateStr;
    return matchStart && matchEnd;
  });
}

export function filterByRuangan(
  rows: PatroliRow[],
  ruangan: string
): PatroliRow[] {
  if (!ruangan) return rows;
  return rows.filter(
    (r) => getDisplayLocation(r).toLowerCase() === ruangan.toLowerCase()
  );
}

/**
 * Get unique sorted list of room/location names from a set of rows.
 */
export function getUniqueRuangan(rows: PatroliRow[]): string[] {
  const set = new Set(rows.map(getDisplayLocation));
  return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
}
