// ─────────────────────────────────────────────────────────────────────────────
// app/api/patrol-data/route.ts — Server-side proxy for Google Apps Script
// Dashboard Patroli Kesling & K3 RSOMH
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import {
  fetchPatrolData,
  filterByBulan,
  filterByDateRange,
  filterByRuangan,
  parseWIBDate,
  fetchMasterData,
} from "@/lib/google-sheets";
import { computeModuleAggregate, computeAllModuleSummaries, getRecentFindings, getNeedsAttention } from "@/lib/analytics";
import { MODULES } from "@/lib/modules";
import { getPrevBulan, getCurrentBulan } from "@/lib/utils";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") ?? "summary"; // "summary" | "module"
    const bulan = searchParams.get("bulan") ?? getCurrentBulan();
    const moduleSlug = searchParams.get("slug");
    const ruangan = searchParams.get("ruangan") ?? "";
    const startDate = searchParams.get("startDate") ?? "";
    const endDate = searchParams.get("endDate") ?? "";

    // Validate bulan
    if (!/^\d{4}-\d{2}$/.test(bulan)) {
      return NextResponse.json(
        { error: "Format bulan harus YYYY-MM" },
        { status: 400 }
      );
    }

    let allRows: any[] = [];
    let masterData: any[] = [];
    let masterTopik: any[] = [];
    let masterPertanyaan: any[] = [];
    
    try {
      let targetMaster = "ruangan";
      if (mode === "module") {
         if (moduleSlug === "pcra") targetMaster = "pcra";
         else if (moduleSlug === "luar-gedung") targetMaster = "luar";
      }

      // Fetch both data sources concurrently to cut loading time in half
      const [patrolRes, masterRes, topikRes, pertanyaanRes] = await Promise.allSettled([
        fetchPatrolData(),
        fetchMasterData(targetMaster, bulan),
        fetchMasterData("topik", bulan),
        fetchMasterData("pertanyaan", bulan)
      ]);
      
      if (patrolRes.status === "fulfilled") {
        allRows = patrolRes.value;
      } else {
        throw patrolRes.reason; // Must have patrol data
      }
      
      if (masterRes.status === "fulfilled") {
        masterData = masterRes.value;
      } else {
        console.error("Failed to fetch master data in patrol-data API", masterRes.reason);
      }

      if (topikRes.status === "fulfilled") {
        masterTopik = topikRes.value;
      }
      if (pertanyaanRes.status === "fulfilled") {
        masterPertanyaan = pertanyaanRes.value;
      }
    } catch(err) {
      console.error("Failed to fetch data in patrol-data API", err);
      throw err;
    }

    if (mode === "summary") {
      // Homepage: summary of all 17 modules
      const rowsThisMonth = filterByBulan(allRows, bulan);
      const rowsLastMonth = filterByBulan(allRows, getPrevBulan(bulan));

      const summaries = computeAllModuleSummaries(
        MODULES,
        rowsThisMonth,
        rowsLastMonth,
        masterData,
        masterTopik
      );
      const recentFindings = getRecentFindings(MODULES, rowsThisMonth, 5);
      const needsAttention = getNeedsAttention(MODULES, rowsThisMonth);

      return NextResponse.json({
        bulan,
        summaries,
        recentFindings,
        needsAttention,
        totalSubmissions: rowsThisMonth.length,
      });
    }

    if (mode === "module" && moduleSlug) {
      // Per-module detail page
      const selectedModule = MODULES.find((m) => m.slug === moduleSlug);
      if (!selectedModule) {
        return NextResponse.json({ error: "Module not found" }, { status: 404 });
      }

      // Apply filters
      let rows = allRows;
      
      if (startDate && endDate) {
        rows = filterByDateRange(rows, startDate, endDate);
      } else {
        rows = filterByBulan(rows, bulan);
      }
      
      if (ruangan) rows = filterByRuangan(rows, ruangan);

      const aggregate = computeModuleAggregate(selectedModule, rows, masterData, masterTopik, masterPertanyaan);

      // --- Calculate Trend Data (optimized: current + prev month only) ---
      let trendData: { month: string; pct: number | null }[] = [];
      
      if (!startDate && !endDate) {
        // Normal month filter: compute trend for current + previous month
        const prevBulan = getPrevBulan(bulan);
        const prevRows = filterByBulan(allRows, prevBulan);
        const prevFiltered = ruangan ? filterByRuangan(prevRows, ruangan) : prevRows;
        
        const prevAgg = prevFiltered.length > 0
          ? computeModuleAggregate(selectedModule, prevFiltered, masterData)
          : null;

        if (prevAgg && prevAgg.totalPct !== null) {
          trendData.push({ month: prevBulan, pct: prevAgg.totalPct });
        }
        trendData.push({ month: bulan, pct: aggregate.totalPct });
      } else {
        // Date range filter: group by month within the range
        const groupedByMonth: Record<string, typeof rows> = {};
        rows.forEach(r => {
          const d = parseWIBDate(r.tanggalPemantauan || r.timestamp);
          const y = d.getUTCFullYear();
          const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
          const monthStr = `${y}-${mo}`;
          if (!groupedByMonth[monthStr]) groupedByMonth[monthStr] = [];
          groupedByMonth[monthStr].push(r);
        });

        trendData = Object.keys(groupedByMonth).sort().map(monthStr => {
          const agg = computeModuleAggregate(selectedModule, groupedByMonth[monthStr], masterData);
          return { month: monthStr, pct: agg.totalPct };
        });
      }

      // Build serializable submissions (without circular refs)
      const submissions = aggregate.submissions.map((s) => ({
        timestamp: s.row.timestamp,
        tanggalPemantauan: s.row.tanggalPemantauan,
        namaPetugas: s.row.namaPetugas,
        location: s.location,
        ruangan: s.row.ruangan,
        patroliKe: s.row.patroliKe,
        answers: s.answers.map((a) => ({
          sheetHeader: a.question.sheetHeader,
          label: a.question.label,
          jawaban: a.jawaban,
        })),
        description: s.description,
        photoUrl: s.photoUrl,
        secondaryDescription: s.secondaryDescription,
        secondaryPhotoUrl: s.secondaryPhotoUrl,
        tags: s.tags,
        extras: s.extras,
      }));

      return NextResponse.json({
        bulan,
        module: {
          slug: selectedModule.slug,
          title: selectedModule.title,
          icon: selectedModule.icon,
          group: selectedModule.group,
          logOnly: selectedModule.logOnly ?? false,
        },
        totalPct: aggregate.totalPct,
        trendData,
        questionResults: aggregate.questionResults.map((r) => ({
          label: r.label,
          sheetHeader: r.question.sheetHeader,
          pct: r.pct,
          countYa: r.countYa,
          countTidak: r.countTidak,
          countNA: r.countNA,
          countEmpty: r.countEmpty,
          targetPct: r.targetPct,
          description: r.description,
          countTidakAda: r.countTidakAda,
          countSetengah: r.countSetengah,
        })),
        submissions,
        submissionCount: submissions.length,
        masterData,
      });
    }

    if (mode === "temuan") {
      // Get all findings/complaints with or without photos across all modules
      let rows = allRows;
      
      if (startDate && endDate) {
        rows = filterByDateRange(rows, startDate, endDate);
      } else {
        rows = filterByBulan(rows, bulan);
      }

      const temuanList: any[] = [];
      const { rowMatchesModule, computeModuleAggregate } = await import("@/lib/analytics");
      const { getField, getDisplayLocation } = await import("@/lib/google-sheets");

      MODULES.forEach((matchedModule) => {
        // 1. Get all rows matching this module
        const relevantRows = rows.filter((row) => rowMatchesModule(row, matchedModule));
        if (relevantRows.length === 0) return;

        // 2. Compute aggregate ONCE for this module with all its rows
        const aggregate = computeModuleAggregate(matchedModule, relevantRows);

        // 3. Process the resulting submissions
        aggregate.submissions.forEach((sub) => {
          // ─── PERBAIKAN BUG: Deskripsi bocor antar modul ─────────────────────
          // Semua modul HARIAN berbagi baris form yang sama (scope DALAM_HARIAN).
          // Artinya kolom "Deskripsi Temuan - Keluhan" milik Sosialisasi bisa
          // terbaca oleh modul Elektrik, APD, dll. yang looping ke baris yang sama.
          //
          // Solusi: untuk modul non-logOnly (bukan Sosialisasi), hanya anggap
          // sebagai "temuan" jika ada ketidakpatuhan nyata (jawaban Tidak/Setengah)
          // ATAU ada foto yang spesifik ke modul itu (bukan fallback ke keluhan umum).
          // Ini memastikan deskripsi Sosialisasi tidak bocor ke modul lain.
          // ─────────────────────────────────────────────────────────────────────

          const isLogOnly = matchedModule.logOnly === true;

          // Untuk modul logOnly (Sosialisasi), gunakan logika lama: ambil foto/deskripsi apa saja
          // Untuk modul non-logOnly: hanya lanjutkan jika ada ketidakpatuhan nyata atau foto spesifik modul
          if (!isLogOnly) {
            const hasNonCompliance = sub.answers.some(
              (a) => a.jawaban === "Tidak" || a.jawaban === "Setengah" || a.jawaban === "TidakAda"
            );
            const hasModuleSpecificPhoto = !!sub.photoUrl; // photoUrl dari descriptionHeader modul itu sendiri
            const hasModuleTags = sub.tags && sub.tags.length > 0;

            // Jika tidak ada ketidakpatuhan, tidak ada foto modul, dan tidak ada tags → skip
            // Ini mencegah deskripsi "Keluhan" Sosialisasi bocor ke modul Elektrik/APD/dll.
            if (!hasNonCompliance && !hasModuleSpecificPhoto && !hasModuleTags) {
              return;
            }
          }

          let fullDescription = sub.description || "";

          // Untuk logOnly: coba fallback ke kolom Keluhan umum jika deskripsi kosong
          if (!fullDescription && isLogOnly) {
            const fallbackDesc = getField(sub.row, "Deskripsi Temuan - Keluhan") || getField(sub.row, "Keluhan");
            if (fallbackDesc) fullDescription = fallbackDesc;
          }

          let photoUrl = sub.photoUrl || "";

          // Untuk logOnly: coba fallback ke kolom Foto Keluhan umum jika foto kosong
          if (!photoUrl && isLogOnly) {
            const fallbackPhoto = getField(sub.row, "Foto Temuan - Keluhan") || getField(sub.row, "Upload Foto");
            if (fallbackPhoto) photoUrl = fallbackPhoto;
          }
          
          if (sub.tags && sub.tags.length > 0) {
            let tagPrefix = "";
            const isApd = matchedModule.slug === "apd";
            
            if (isApd) {
              const counts: Record<string, number> = {};
              sub.tags.forEach(t => counts[t] = (counts[t] || 0) + 1);
              const formattedTags = Object.entries(counts).map(([prof, count]) => `${count} ${prof}`);
              tagPrefix = `[Tidak patuh: ${formattedTags.join(", ")}]\n`;
            } else {
              tagPrefix = `[Sub-unit bermasalah: ${sub.tags.join(", ")}]\n`;
            }
            fullDescription = tagPrefix + fullDescription;
          }

          if (fullDescription || photoUrl) {
            temuanList.push({
              id: sub.row.timestamp + "-" + matchedModule.slug,
              timestamp: sub.row.timestamp,
              tanggalPemantauan: sub.row.tanggalPemantauan || sub.row.timestamp,
              location: getDisplayLocation(sub.row),
              description: fullDescription.trim(),
              photoUrl: photoUrl,
              moduleTitle: matchedModule.title,
              moduleIcon: matchedModule.icon,
              moduleSlug: matchedModule.slug,
            });
          }
        });
      });

      // Sort by Kategori (A-Z) first, then newest date
      temuanList.sort((a, b) => {
        const titleA = a.moduleTitle || "";
        const titleB = b.moduleTitle || "";
        
        // Group by category (A-Z)
        if (titleA < titleB) return -1;
        if (titleA > titleB) return 1;
        
        // If same category, sort by date descending
        return new Date(b.tanggalPemantauan).getTime() - new Date(a.tanggalPemantauan).getTime();
      }); 

      return NextResponse.json({
        bulan,
        submissions: temuanList,
        count: temuanList.length,
      });
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  } catch (error) {
    console.error("[/api/patrol-data]", error);
    return NextResponse.json(
      {
        error: "Gagal mengambil data",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
