import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { data } = await req.json();

    if (!data) {
      return NextResponse.json({ error: "Data is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key is missing in server configuration" }, { status: 500 });
    }

    const prompt = `Tugas kamu:
1. Buat ringkasan eksekutif 2-4 paragraf singkat dalam Bahasa Indonesia formal namun mudah dibaca berdasarkan data patroli JSON di bawah ini.
2. Soroti ruangan/modul yang paling sering bermasalah (persentase kepatuhan rendah atau berulang di beberapa patroli).
3. Jika ada pola berulang (misal ruangan yang sama gagal di modul yang sama lebih dari sekali), sebutkan secara eksplisit karena ini mengindikasikan masalah struktural, bukan insiden sesaat.
4. Sebutkan temuan kritis yang butuh tindak lanjut segera (misal APAR kedaluwarsa, B3 tidak sesuai penyimpanan).
5. Tutup dengan 1 kalimat rekomendasi prioritas tindak lanjut.
6. JANGAN gunakan format markdown heading (##) — cukup paragraf biasa dengan **bold** untuk istilah penting jika perlu.
7. Jangan mengarang data yang tidak ada di JSON.

${data.userContext ? `CATATAN TAMBAHAN DARI PENGGUNA (PERHATIKAN INI SAAT MEMBUAT RINGKASAN):\n"${data.userContext}"\n\n` : ""}Data JSON:
${JSON.stringify(data)}
`;

    // Menggunakan model gemini-2.5-flash seperti permintaan pengguna
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", errorText);
      // Fallback ke model gemini-1.5-flash jika 2.5 tidak ditemukan/error
      if (response.status === 404 || errorText.includes("not found")) {
        console.log("Mencoba fallback ke gemini-1.5-flash");
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const fallbackResponse = await fetch(fallbackUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        });
        
        if (!fallbackResponse.ok) {
          throw new Error("Gagal generate konten dengan fallback model.");
        }
        
        const fallbackData = await fallbackResponse.json();
        const text = fallbackData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return NextResponse.json({ summary: text });
      }
      
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return NextResponse.json({ summary: text });
  } catch (error: any) {
    console.error("Generate summary error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate summary" },
      { status: 500 }
    );
  }
}
