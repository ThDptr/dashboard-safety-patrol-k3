// ─────────────────────────────────────────────────────────────────────────────
// lib/utils.ts — Date formatting, number helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Format a date string as "22 Juli 2026" */
export function formatTanggal(input: string | Date): string {
  if (!input) return "-";
  const MONTHS = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember",
  ];
  let d: Date;
  if (input instanceof Date) {
    d = input;
  } else {
    // Handle formats like DD/MM/YYYY or MM/DD/YYYY from Google Sheets
    const gsMatch = String(input).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (gsMatch) {
      let part1 = parseInt(gsMatch[1]);
      let part2 = parseInt(gsMatch[2]);
      let year = parseInt(gsMatch[3]);
      
      // If part1 > 12, it MUST be DD/MM/YYYY. 
      // If part2 > 12, it MUST be MM/DD/YYYY.
      // Default to assuming DD/MM/YYYY for Indonesian users if both <= 12, unless part1 looks like a US month.
      let month = part2;
      let day = part1;
      
      // If part1 is a valid month and part2 is > 12, it's definitely MM/DD/YYYY
      if (part1 <= 12 && part2 > 12) {
         month = part1;
         day = part2;
      }
      
      d = new Date(year, month - 1, day);
    } else {
      d = new Date(input);
    }
  }
  if (isNaN(d.getTime())) return String(input);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
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
