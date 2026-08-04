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
      // Fetch both data sources concurrently to cut loading time in half
      const [patrolRes, masterRes, topikRes, pertanyaanRes] = await Promise.allSettled([
        fetchPatrolData(),
        fetchMasterData("ruangan"),
        fetchMasterData("topik"),
        fetchMasterData("pertanyaan")
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
        masterData
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

      // --- Calculate Trend Data ---
      const groupedByMonth: Record<string, typeof rows> = {};
      rows.forEach(r => {
        const d = parseWIBDate(r.tanggalPemantauan || r.timestamp);
        const y = d.getUTCFullYear();
        const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
        const monthStr = `${y}-${mo}`;
        if (!groupedByMonth[monthStr]) groupedByMonth[monthStr] = [];
        groupedByMonth[monthStr].push(r);
      });

      const trendData = Object.keys(groupedByMonth).sort().map(monthStr => {
        const agg = computeModuleAggregate(selectedModule, groupedByMonth[monthStr], masterData);
        return {
          month: monthStr,
          pct: agg.totalPct
        };
      });

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

      rows.forEach((row) => {
        // Find ALL modules this row belongs to
        const matchedModules = MODULES.filter((m) => rowMatchesModule(row, m));
        
        matchedModules.forEach((matchedModule) => {
          // Use computeModuleAggregate to get properly formatted tags, description, and photo
          const aggregate = computeModuleAggregate(matchedModule, [row]);
          if (aggregate.submissions.length === 0) return;

          const sub = aggregate.submissions[0];
          
          let fullDescription = sub.description || "";
          if (!fullDescription) {
            const fallbackDesc = getField(row, "Deskripsi Temuan - Keluhan") || getField(row, "Keluhan");
            if (fallbackDesc) fullDescription = fallbackDesc;
          }

          let photoUrl = sub.photoUrl || "";
          if (!photoUrl) {
            // If the form uses a generic photo upload field named similarly
            const fallbackPhoto = getField(row, "Foto Temuan - Keluhan") || getField(row, "Upload Foto");
            if (fallbackPhoto) photoUrl = fallbackPhoto;
          }
          
          // Include tags if present
          if (sub.tags && sub.tags.length > 0) {
            let tagPrefix = "";
            const isApd = matchedModule.slug === "apd";
            
            if (isApd) {
              // Group duplicate tags to count them
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
              id: row.timestamp + "-" + matchedModule.slug, // make ID unique per module
              timestamp: row.timestamp,
              tanggalPemantauan: row.tanggalPemantauan || row.timestamp,
              location: getDisplayLocation(row),
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
