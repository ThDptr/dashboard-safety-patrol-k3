// ─────────────────────────────────────────────────────────────────────────────
// app/api/locked-months/route.ts
// GET  → mengambil daftar bulan yang sudah di-kunci (dari Apps Script)
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { fetchWithRetry } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

const WEBAPP_URL = process.env.GOOGLE_SHEETS_WEBAPP_URL!;
const SECRET = process.env.CRUD_SECRET || "rahasia_rsomh_k3";

/**
 * Cache sederhana di memory (server-side) agar tidak flood ke Apps Script
 * setiap kali halaman dimuat.
 */
const globalForCache = globalThis as unknown as {
  _lockedMonthsCache?: { data: string[]; fetchedAt: number };
};
const CACHE_TTL_MS = 30_000; // 30 detik

export async function GET() {
  try {
    if (!WEBAPP_URL) {
      return NextResponse.json({ lockedMonths: [] });
    }

    // Serve from cache jika masih fresh
    const now = Date.now();
    if (
      globalForCache._lockedMonthsCache &&
      now - globalForCache._lockedMonthsCache.fetchedAt < CACHE_TTL_MS
    ) {
      return NextResponse.json({
        lockedMonths: globalForCache._lockedMonthsCache.data,
      });
    }

    // Panggil Apps Script dengan action=getLockedMonths
    const url = new URL(WEBAPP_URL);
    url.searchParams.set("action", "getLockedMonths");
    url.searchParams.set("secret", SECRET);
    url.searchParams.set("token", SECRET);

    const res = await fetchWithRetry(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getLockedMonths", secret: SECRET, token: SECRET }),
      cache: "no-store",
    });

    if (!res.ok) {
      // Jika Apps Script belum diupdate, kembalikan array kosong tanpa error
      console.warn("[locked-months] Apps Script returned", res.status);
      return NextResponse.json({ lockedMonths: [] });
    }

    const json = await res.json();

    // Apps Script mengembalikan: { success: true, lockedMonths: ["2026-06", "2026-07"] }
    const lockedMonths: string[] = Array.isArray(json.lockedMonths)
      ? json.lockedMonths
      : [];

    // Update cache
    globalForCache._lockedMonthsCache = { data: lockedMonths, fetchedAt: now };

    return NextResponse.json({ lockedMonths });
  } catch (err: any) {
    console.error("[locked-months] Error:", err.message);
    // Graceful fallback — jangan crash halaman utama
    return NextResponse.json({ lockedMonths: [] });
  }
}

/**
 * POST — invalidate cache (dipanggil setelah lock berhasil)
 */
export async function POST() {
  if (globalForCache._lockedMonthsCache) {
    globalForCache._lockedMonthsCache = undefined;
  }
  return NextResponse.json({ success: true, message: "Cache cleared" });
}
