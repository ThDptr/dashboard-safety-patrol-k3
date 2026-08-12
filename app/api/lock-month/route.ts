import { NextResponse } from "next/server";

const WEBAPP_URL = process.env.GOOGLE_SHEETS_WEBAPP_URL;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bulan, password } = body;

    if (!bulan || !password) {
      return NextResponse.json({ success: false, error: "Bulan dan password wajib diisi" }, { status: 400 });
    }

    if (!WEBAPP_URL) {
      return NextResponse.json({ success: false, error: "WEBAPP_URL tidak diatur" }, { status: 500 });
    }

    const payload = {
      action: "lockMonth",
      bulan: bulan,
      secret: password,
      token: password
    };

    const url = new URL(WEBAPP_URL);
    for (const key in payload) {
      url.searchParams.append(key, payload[key as keyof typeof payload].toString());
    }

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: `Gagal menghubungi server Google Script (${res.status})` }, { status: 500 });
    }

    const json = await res.json();
    if (!json.success) {
      return NextResponse.json({ success: false, error: json.error || "Gagal mengunci bulan" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: json.message });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
