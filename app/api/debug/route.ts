import { NextResponse } from "next/server";
import { fetchPatrolData } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await fetchPatrolData();
  const aparRows = data.filter(r => r.jenisPemantauan === "Dalam Gedung" && r.frekuensiPemantauan === "Bulanan");
  if (aparRows.length === 0) return NextResponse.json({ message: "No Bulanan rows" });
  
  const firstRow = aparRows[0].raw;
  const keys = Object.keys(firstRow).filter(k => k.toLowerCase().includes("apar"));
  return NextResponse.json({ keys });
}
