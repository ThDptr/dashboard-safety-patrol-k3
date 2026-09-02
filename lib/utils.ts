// ─────────────────────────────────────────────────────────────────────────────
// lib/utils.ts — Date formatting, number helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a date/timestamp string into a Date that represents WIB (UTC+7) local time
 * via its UTC fields. Use getUTC* methods on the result to read the correct WIB date.
 */
function parseToWIBDate(input: string): Date {
  // DD/MM/YYYY or MM/DD/YYYY from Google Sheets → treat as local WIB, build as UTC
  const gsMatch = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (gsMatch) {
    const part1 = parseInt(gsMatch[1]);
    const part2 = parseInt(gsMatch[2]);
    const year  = parseInt(gsMatch[3]);
    // part1 > 12 → must be DD/MM/YYYY
    // part1 <= 12 && part2 > 12 → must be MM/DD/YYYY
    // default: DD/MM/YYYY (Indonesian locale)
    let month = part2;
    let day   = part1;
    if (part1 <= 12 && part2 > 12) {
      month = part1;
      day   = part2;
    }
    // Construct as UTC so getUTC* reads the correct WIB date parts
    return new Date(Date.UTC(year, month - 1, day));
  }

  // ISO string or unknown → parse as UTC then shift +7h to get WIB
  const raw = new Date(input);
  if (isNaN(raw.getTime())) return raw; // let caller handle NaN
  return new Date(raw.getTime() + 7 * 60 * 60 * 1000);
}

/** Format a date string as "22 Juli 2026" */
export function formatTanggal(input: string | Date): string {
  if (!input) return "-";
  const MONTHS = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember",
  ];
  if (input instanceof Date) {
    // Assume the Date object was constructed in local time; read via local methods
    if (isNaN(input.getTime())) return "-";
    return `${input.getDate()} ${MONTHS[input.getMonth()]} ${input.getFullYear()}`;
  }
  const d = parseToWIBDate(String(input));
  if (isNaN(d.getTime())) return String(input);
  // Use getUTC* — because parseToWIBDate encodes WIB time into the UTC fields
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Format a date string short as "22 Agt 2026" */
export function formatTanggalPendek(input: string | Date | undefined): string {
  if (!input) return "-";
  const MONTHS = [
    "Jan","Feb","Mar","Apr","Mei","Jun",
    "Jul","Agt","Sep","Okt","Nov","Des",
  ];
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return "-";
    return `${input.getDate()} ${MONTHS[input.getMonth()]} ${input.getFullYear()}`;
  }
  const d = parseToWIBDate(String(input));
  if (isNaN(d.getTime())) return String(input);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Format "YYYY-MM" as "Juli 2026" */
export function formatBulan(bulan: string): string {
  const MONTHS = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember",
  ];
  const [y, m] = bulan.split("-");
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
}

/** Get current month as "YYYY-MM" (Jakarta timezone) */
export function getCurrentBulan(): string {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
  );
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Get previous month as "YYYY-MM" */
export function getPrevBulan(bulan: string): string {
  const [y, m] = bulan.split("-").map(Number);
  const d = new Date(y, m - 2, 1); // m-2 because month is 0-indexed and we want one month earlier
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Parse numeric string, return 0 for NaN */
export function safeInt(val: string): number {
  const n = parseInt(val?.replace(/[^\d]/g, "") ?? "", 10);
  return isNaN(n) ? 0 : n;
}

/** Clamp a percentage 0–100 */
export function clampPct(pct: number): number {
  return Math.max(0, Math.min(100, pct));
}

/** Format a timestamp string from Google Sheets for display */
export function formatTimestamp(ts: string): string {
  if (!ts || ts === "-") return "-";
  return formatTanggal(ts);
}

/** Format a string if it looks like an ISO date, otherwise return as is */
export function formatMaybeDate(val: string): string {
  if (!val || val === "-") return "-";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
    return formatTanggal(val);
  }
  return val;
}

/**
 * Format a ratio (numerator / denominator × 100) as a percentage string
 * with exactly 2 decimal places. Returns "-" if denominator is 0 or null.
 *
 * Examples:
 *   fmtPct(85, 100)   → "85.00%"
 *   fmtPct(1, 3)      → "33.33%"
 *   fmtPct(0, 0)      → "-"
 */
export function fmtPct(numerator: number, denominator: number, fallback = "-"): string {
  if (!denominator || denominator === 0) return fallback;
  return ((numerator / denominator) * 100).toFixed(2) + "%";
}

/**
 * Format a pre-computed percentage number as a string with 2 decimal places.
 * Accepts null (returns "-").
 *
 * Examples:
 *   fmtPctVal(85)    → "85.00%"
 *   fmtPctVal(null)  → "-"
 */
export function fmtPctVal(pct: number | null, fallback = "-"): string {
  if (pct === null || pct === undefined) return fallback;
  return Number(pct).toFixed(2) + "%";
}

/**
 * Compute a percentage value rounded to 2 decimal places (as a number).
 * Useful for storing/comparing values that still need to display as 2dp.
 *
 * Examples:
 *   calcPct(1, 3)  → 33.33
 *   calcPct(0, 0)  → null
 */
export function calcPct(numerator: number, denominator: number): number | null {
  if (!denominator || denominator === 0) return null;
  return parseFloat(((numerator / denominator) * 100).toFixed(2));
}

/**
 * Downloads a Blob and prompts the user with a "Save As" dialog if supported by the browser.
 * Falls back to standard anchor download if the File System Access API is not available.
 */
export async function downloadWithSavePrompt(
  blob: Blob,
  defaultFilename: string,
  acceptMimeType: string = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  acceptExtensions: string[] = [".xlsx"]
) {
  if (typeof window !== "undefined" && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: defaultFilename,
        types: [{
          description: 'Excel File',
          accept: { [acceptMimeType]: acceptExtensions },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Save picker error:', err);
      } else {
        return; // User cancelled
      }
    }
  }
  
  // Fallback for browsers that do not support showSaveFilePicker (e.g. Firefox, Safari)
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
