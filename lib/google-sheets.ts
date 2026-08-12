// ─────────────────────────────────────────────────────────────────────────────
// lib/google-sheets.ts — Fetch & Parse from Google Apps Script Web App
// Dashboard Patroli Kesling & K3 RSOMH
// ─────────────────────────────────────────────────────────────────────────────

export type Jawaban = "Ya" | "Tidak" | "N/A" | "Setengah" | "TidakAda" | "";

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
  /**
   * Normalized key index: maps trimmed-lowercase key → original value.
   * Used by getAnswer/getField to tolerate trailing/leading spaces in column headers.
   */
  _normIdx: Map<string, string>;
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
  _patrolInflight?: Promise<PatroliRow[]> | null;
  _masterInflight?: Map<string, Promise<any[]>>;
};

const CACHE_TTL_MS = 120_000; // 2 minutes — patrol data

/**
 * Helper to fetch with exponential backoff for Google Apps Script
 */
export async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  let lastError: Error | null = null;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status === 404) return res; // Don't retry 404s
      
      const text = await res.text().catch(() => "");
      lastError = new Error(`HTTP ${res.status}: ${text.slice(0, 100)}`);
    } catch (e: any) {
      lastError = e;
    }
    // Exponential backoff: 1s, 2s, 4s...
    if (i < retries - 1) {
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  throw lastError || new Error("Fetch failed after retries");
}

/**
 * Fetch patrol data from the Apps Script Web App.
 * Uses an in-memory cache with 10-second TTL.
 * This function is safe to call from Next.js API routes (server-side only).
 */
export async function fetchPatrolData(): Promise<PatroliRow[]> {
  const now = Date.now();
  const cache = globalForCache._patrolCache;

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  // In-flight deduplication: if another caller is already fetching, reuse its promise
  if (globalForCache._patrolInflight) {
    return globalForCache._patrolInflight;
  }

  if (!WEBAPP_URL) {
    throw new Error(
      "GOOGLE_SHEETS_WEBAPP_URL is not set. Please add it to .env.local."
    );
  }

  const doFetch = async (): Promise<PatroliRow[]> => {
    try {
      const res = await fetchWithRetry(WEBAPP_URL, {
        next: { revalidate: 120, tags: ['patrol-data'] },
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        throw new Error(
          `Web App returned HTTP ${res.status}: ${await res.text().then((t) => t.slice(0, 200))}`
        );
      }

      const json: WebAppResponse = await res.json();
      const rows = normalizeRows(json);
      globalForCache._patrolCache = { data: rows, fetchedAt: Date.now() };
      return rows;
    } finally {
      globalForCache._patrolInflight = null;
    }
  };

  globalForCache._patrolInflight = doFetch();
  return globalForCache._patrolInflight;
}

const MASTER_CACHE_TTL_MS = 300_000; // 5 minutes — master data changes rarely

if (!globalForCache._masterCache) {
  globalForCache._masterCache = new Map<string, { data: any[], fetchedAt: number }>();
}
if (!globalForCache._masterInflight) {
  globalForCache._masterInflight = new Map<string, Promise<any[]>>();
}

export async function fetchMasterData(target: string, bulan?: string): Promise<any[]> {
  const now = Date.now();
  const cacheKey = bulan ? `${target}-${bulan}` : target;
  const cached = globalForCache._masterCache!.get(cacheKey);

  if (cached && now - cached.fetchedAt < MASTER_CACHE_TTL_MS) {
    return cached.data;
  }

  // In-flight deduplication
  const inflight = globalForCache._masterInflight!.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  if (!WEBAPP_URL) {
    throw new Error("GOOGLE_SHEETS_WEBAPP_URL is not set.");
  }

  const doFetch = async (): Promise<any[]> => {
    try {
      const SECRET = process.env.CRUD_SECRET || "rahasia_rsomh_k3";
      const payload: any = { action: "read", target: target, secret: SECRET, token: SECRET };
      if (bulan) {
        payload.bulan = bulan;
      }
      
      const url = new URL(WEBAPP_URL);
      for (const key in payload) {
        url.searchParams.append(key, payload[key as keyof typeof payload].toString());
      }

      const res = await fetchWithRetry(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        next: { revalidate: 300, tags: ['master-data', `master-${target}`, `master-${cacheKey}`] }
      });

      if (!res.ok) {
        throw new Error(`Master fetch failed: ${res.status}`);
      }

      const json = await res.json();
      const rows = json.data || [];
      
      globalForCache._masterCache!.set(cacheKey, { data: rows, fetchedAt: Date.now() });
      return rows;
    } finally {
      globalForCache._masterInflight!.delete(cacheKey);
    }
  };

  const promise = doFetch();
  globalForCache._masterInflight!.set(cacheKey, promise);
  return promise;
}

export function invalidateMasterCache(target: string) {
  if (globalForCache._masterCache) {
    globalForCache._masterCache.delete(target);
  }
}

// ─── Key normalization helper ───────────────────────────────────────────

/**
 * Normalize a sheet column header for fuzzy matching:
 * - trim leading/trailing whitespace
 * - collapse multiple consecutive spaces into one
 * - lowercase
 * This handles Google Sheet headers that have double spaces (e.g. "APAR  [APAR - ...]").
 */
function normalizeKey(key: string): string {
  return key.trim().replace(/\s+/g, " ").toLowerCase();
}

// ─── Normalization ─────────────────────────────────────────────────────────────

function normalizeRows(json: WebAppResponse): PatroliRow[] {
  return json.data.map((row) => {
    // Build normalized index: collapsed-lowercase key → value
    // This tolerates trailing/leading spaces AND multiple consecutive spaces
    // in Google Sheet column headers (e.g. "APAR  [APAR - Terjangkau]" with 2 spaces)
    const _normIdx = new Map<string, string>();
    for (const [k, v] of Object.entries(row)) {
      _normIdx.set(normalizeKey(k), v == null ? "" : String(v));
    }

    const get = (key: string) => row[key] ?? row[key.trim()] ?? "";

    return {
      raw: row,
      _normIdx,
      timestamp: get("Timestamp"),
      tanggalPemantauan: get("Tanggal Pemantauan"),
      namaPetugas: get("Nama Petugas"),
      jenisPemantauan: String(get("Jenis Pemantauan")).trim(),
      ruangan: String(get("Ruangan")).trim(),
      frekuensiPemantauan: String(get("Frekuensi Pemantauan")).trim(),
      patroliKe: parseInt(String(get("Patroli ke-") ?? "0"), 10) || 0,
    };
  });
}

// ─── Field accessors ──────────────────────────────────────────────────────────

/**
 * Get the standardized answer from a row based on sheet header.
 * Uses exact match first, then falls back to normalized key lookup
 * (trim + collapse spaces + lowercase) to tolerate Google Sheet header quirks.
 */
export function getAnswer(row: PatroliRow, sheetHeader: string): Jawaban {
  // Try exact key first
  let rawVal: any = row.raw[sheetHeader];

  // Fallback: normalized lookup (trim + collapse spaces + lowercase)
  if (rawVal == null) {
    rawVal = row._normIdx.get(normalizeKey(sheetHeader)) ?? null;
  }

  const val = rawVal == null ? "" : String(rawVal).trim();
  
  if (val === "Ya") return "Ya";
  if (val === "Tidak") return "Tidak";
  if (val === "N/A") return "N/A";
  
  // Hydrant: "Tidak ada hydrant" → kategori ketiga, masuk denominator tapi bukan Ya
  if (val === "Tidak ada hydrant") return "TidakAda";

  // Specific to Sarana Proteksi Kebakaran
  if (val === "Ya, kondisi baik/utuh") return "Ya";
  if (val === "Ya, tapi kondisi tidak baik/tidak utuh") return "Setengah";
  if (val === "Tidak ada") return "Tidak";
  
  return "";
}

/**
 * Get a string field value from a row.
 * Uses exact match first, then falls back to normalized key lookup.
 */
export function getField(row: PatroliRow, sheetHeader: string): string {
  // Try exact key first
  let rawVal: any = row.raw[sheetHeader];

  // Fallback: normalized lookup
  if (rawVal == null) {
    rawVal = row._normIdx.get(normalizeKey(sheetHeader)) ?? null;
  }

  return rawVal == null ? "" : String(rawVal).trim();
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
