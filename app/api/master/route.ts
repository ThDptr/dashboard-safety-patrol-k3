import { NextResponse } from "next/server";
import { fetchMasterData, invalidateMasterCache } from "@/lib/google-sheets";

export const dynamic = 'force-dynamic';

const WEBAPP_URL = process.env.GOOGLE_SHEETS_WEBAPP_URL!;
const SECRET = process.env.CRUD_SECRET || "rahasia_rsomh_k3";

// Fungsi pembantu untuk mengirim request ke Apps Script (Hanya untuk Write/Create/Update/Delete)
async function sendToAppsScript(payload: any) {
  if (!WEBAPP_URL) {
    throw new Error("GOOGLE_SHEETS_WEBAPP_URL tidak ditemukan di .env.local");
  }

  // Tambahkan secret key dalam berbagai format agar cocok dengan Code.gs
  payload.secret = SECRET;
  payload.token = SECRET;

  // Apps Script sering membaca dari e.parameter, jadi kita taruh SEMUA payload ke URL params juga.
  const url = new URL(WEBAPP_URL);
  for (const key in payload) {
    if (typeof payload[key] === 'string' || typeof payload[key] === 'number') {
      url.searchParams.append(key, payload[key].toString());
    } else if (typeof payload[key] === 'object' && payload[key] !== null) {
      url.searchParams.append(key, JSON.stringify(payload[key]));
    }
  }

  const response = await fetch(url.toString(), {
    method: "POST", // Kita bisa coba POST (atau fallback GET jika server gagal)
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store", // Pastikan tidak ada caching untuk operasi CRUD
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.status === "error" || data.success === false) {
    throw new Error(data.message || data.error || "Terjadi kesalahan pada server Spreadsheet");
  }

  return data;
}

// READ (Ambil Data)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sheetName = searchParams.get("sheetName");

    if (!sheetName) {
      return NextResponse.json({ error: "Parameter sheetName wajib diisi" }, { status: 400 });
    }

    const getTarget = (name: string) => {
      if (name === "Master Ruangan") return "ruangan";
      if (name === "Master Luar") return "luar";
      if (name === "Master PCRA") return "pcra";
      if (name === "Master Topik") return "topik";
      if (name === "Master Pertanyaan") return "pertanyaan";
      return name;
    };
    const target = getTarget(sheetName);

    // Gunakan fungsi cache dari lib/google-sheets.ts
    const rows = await fetchMasterData(target);

    return NextResponse.json({
      status: "success",
      data: rows,
      total: rows.length
    });
  } catch (error: any) {
    console.error("[API/Master/GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// CREATE (Tambah Data)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sheetName, rowData } = body;

    if (!sheetName || !rowData) {
      return NextResponse.json({ error: "sheetName dan rowData wajib diisi" }, { status: 400 });
    }

    const getTarget = (name: string) => {
      if (name === "Master Ruangan") return "ruangan";
      if (name === "Master Luar") return "luar";
      if (name === "Master PCRA") return "pcra";
      if (name === "Master Topik") return "topik";
      if (name === "Master Pertanyaan") return "pertanyaan";
      return name;
    };
    const target = getTarget(sheetName);

    const result = await sendToAppsScript({
      action: "create",
      target: target,
      payload: rowData, // Harus menggunakan key 'payload' untuk Apps Script
    });

    invalidateMasterCache(target);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[API/Master/POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// UPDATE (Ubah Data)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { sheetName, rowIndex, rowData } = body;

    if (!sheetName || rowIndex === undefined || !rowData) {
      return NextResponse.json({ error: "sheetName, rowIndex, dan rowData wajib diisi" }, { status: 400 });
    }

    const getTarget = (name: string) => {
      if (name === "Master Ruangan") return "ruangan";
      if (name === "Master Luar") return "luar";
      if (name === "Master PCRA") return "pcra";
      if (name === "Master Topik") return "topik";
      if (name === "Master Pertanyaan") return "pertanyaan";
      return name;
    };
    const target = getTarget(sheetName);

    // Apps Script Code.gs mengharapkan rowIndex dan field-field lainnya rata di dalam payload
    const result = await sendToAppsScript({
      action: "update",
      target: target,
      payload: { rowIndex, ...rowData },
    });

    invalidateMasterCache(target);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[API/Master/PUT]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE (Hapus Data)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let sheetName = searchParams.get("sheetName");
    let rowIndex: any = searchParams.get("rowIndex");

    if (!sheetName || !rowIndex) {
      try {
        const body = await request.json();
        sheetName = sheetName || body.sheetName;
        rowIndex = rowIndex || body.rowIndex;
      } catch (e) {}
    }

    if (!sheetName || !rowIndex) {
      return NextResponse.json({ error: "sheetName dan rowIndex wajib diisi" }, { status: 400 });
    }

    const getTarget = (name: string) => {
      if (name === "Master Ruangan") return "ruangan";
      if (name === "Master Luar") return "luar";
      if (name === "Master PCRA") return "pcra";
      if (name === "Master Topik") return "topik";
      if (name === "Master Pertanyaan") return "pertanyaan";
      return name;
    };
    const target = getTarget(sheetName);

    const result = await sendToAppsScript({
      action: "delete",
      target: target,
      payload: { rowIndex: parseInt(rowIndex, 10) },
    });

    invalidateMasterCache(target);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[API/Master/DELETE]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
