import { NextResponse } from "next/server";
import { fetchPatrolData } from "@/lib/google-sheets";
import { parseWIBDate } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await fetchPatrolData();

  // Basic stats
  const totalRows = data.length;

  // All unique jenis pemantauan
  const jenisList = Array.from(new Set(data.map(r => r.jenisPemantauan))).filter(Boolean);
  
  // All unique frekuensi
  const frekuensiList = Array.from(new Set(data.map(r => r.frekuensiPemantauan))).filter(Boolean);

  // All unique bulan (YYYY-MM) from tanggalPemantauan or timestamp
  const bulanSet = new Set<string>();
  for (const r of data) {
    const ts = r.tanggalPemantauan || r.timestamp;
    const d = parseWIBDate(ts);
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    if (y > 2000) bulanSet.add(`${y}-${mo}`);
  }
  const bulanList = Array.from(bulanSet).sort();

  // APAR rows
  const aparRows = data.filter(r => r.jenisPemantauan === "Dalam Gedung" && r.frekuensiPemantauan === "Bulanan");
  
  // All header keys from first row
  const allKeys = totalRows > 0 ? Object.keys(data[0].raw) : [];

  // APAR-related keys
  const aparKeys = totalRows > 0
    ? Object.keys(data[0].raw).filter(k => k.toLowerCase().includes("apar"))
    : [];

  // Sample APAR row (first one)
  const sampleAparRow = aparRows.length > 0 ? {
    tanggal: aparRows[0].tanggalPemantauan,
    jenis: aparRows[0].jenisPemantauan,
    frekuensi: aparRows[0].frekuensiPemantauan,
    ruangan: aparRows[0].ruangan,
    apar_terjangkau: aparRows[0].raw["APAR [APAR - Terjangkau]"],
    apar_rambu: aparRows[0].raw["APAR [APAR - Rambu dan SOP terpasang]"],
    apar_kartu: aparRows[0].raw["APAR [APAR - Kartu pemeliharaan terisi]"],
  } : null;

  return NextResponse.json({
    totalRows,
    aparRowsCount: aparRows.length,
    jenisList,
    frekuensiList,
    bulanList,
    aparKeys,
    sampleAparRow,
    // First 5 raw rows for inspection (all headers)
    sampleHeaders: allKeys,
  });
}
