// ─────────────────────────────────────────────────────────────────────────────
// app/api/export/excel/route.ts — Excel Export (in-memory, no disk writes)
// Dashboard Patroli Kesling & K3 RSOMH
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import {
  fetchPatrolData,
  filterByBulan,
  filterByRuangan,
  filterByDateRange,
  getAnswer,
  getField,
  getDisplayLocation,
  fetchMasterData,
} from "@/lib/google-sheets";

export const dynamic = 'force-dynamic';

import { MODULES, MODULE_BY_SLUG } from "@/lib/modules";
import { computeModuleAggregate } from "@/lib/analytics";
import { getCurrentBulan, formatBulan, formatMaybeDate } from "@/lib/utils";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFB71C1C" },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 10,
};
const ALT_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFF5F5" },
};

function applyHeaderRow(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF999999" } },
    };
  });
  row.height = 28;
}

function applyDataRow(row: ExcelJS.Row, idx: number): void {
  if (idx % 2 === 0) {
    row.eachCell((cell) => {
      cell.fill = ALT_FILL;
    });
  }
  row.eachCell((cell) => {
    cell.alignment = { vertical: "top", wrapText: true };
    cell.font = { size: 9 };
  });
  row.height = 40; // taller to accommodate wrapped text
}

function jawabanDisplay(val: string): string {
  if (val === "Ya") return "✓ Ya";
  if (val === "Tidak") return "✗ Tidak";
  if (val === "N/A") return "N/A";
  return "-";
}

/**
 * Build a comprehensive keterangan string for one submission:
 *  - text description from the sheet
 *  - APD profession violations from tags (grouped & counted)
 *  - B3 sub-unit bermasalah from tags
 *  - Photo URL (at the end)
 */
function buildKeteranganForExport(
  sub: any,
  isAPD: boolean,
  isB3: boolean,
  masterProfesiNames: string[] = []
): string {
  const parts: string[] = [];

  // 1. Raw description
  const desc = (sub.description || "").trim();
  if (desc && desc !== "-") parts.push(desc);

  // 2. APD profession violations from tags
  if (isAPD && sub.tags && sub.tags.length > 0) {
    const profTags = masterProfesiNames.length > 0
      ? sub.tags.filter((t: string) => masterProfesiNames.includes(t.toLowerCase()))
      : sub.tags;
    if (profTags.length > 0) {
      const counts: Record<string, number> = {};
      profTags.forEach((t: string) => { counts[t] = (counts[t] || 0) + 1; });
      const profStr = Object.entries(counts).map(([n, c]) => `${c} ${n}`).join(", ");
      parts.push(`[Tidak patuh: ${profStr}]`);
    }
  }

  // 3. B3 sub-unit bermasalah from tags
  if (isB3 && sub.tags && sub.tags.length > 0) {
    parts.push(`[Sub-unit bermasalah: ${sub.tags.join(", ")}]`);
  }

  return parts.length > 0 ? parts.join(" | ") : "-";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bulan = searchParams.get("bulan") ?? getCurrentBulan();
    const slug = searchParams.get("slug") ?? ""; // empty = all modules
    const ruangan = searchParams.get("ruangan") ?? "";
    const startDate = searchParams.get("startDate") ?? "";
    const endDate = searchParams.get("endDate") ?? "";
    const locationsParam = searchParams.get("locations") ?? "";
    const topicName = searchParams.get("topicName") ?? "";

    const [allRows, masterData] = await Promise.all([
      fetchPatrolData(),
      fetchMasterData("ruangan").catch(() => []), // Silently fallback to empty array if fails
    ]);
    let rows = filterByBulan(allRows, bulan);
    if (ruangan) rows = filterByRuangan(rows, ruangan);
    if (startDate || endDate) rows = filterByDateRange(rows, startDate, endDate);
    if (locationsParam) {
      const allowedLocs = locationsParam.split(",");
      rows = rows.filter((r) => allowedLocs.includes(getDisplayLocation(r)));
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Dashboard K3 RSOMH";
    workbook.created = new Date();

    const modulesToExport = slug && MODULE_BY_SLUG[slug]
      ? [MODULE_BY_SLUG[slug]]
      : MODULES;

    // --- SHEET RINGKASAN (Hanya jika export semua) ---
    if (!slug) {
      const summarySheet = workbook.addWorksheet("Ringkasan", {
        pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
      });

      // Kumpulkan data agregat untuk semua modul
      const summaryData = [];
      for (const mod of MODULES) {
        if (mod.logOnly && mod.slug !== "sosialisasi") continue;
        const aggregate = computeModuleAggregate(mod, rows, masterData);
        
        let detailRumus = "-";
        if (!mod.logOnly) {
           const validQuestions = aggregate.questionResults.filter(q => q.pct !== null).length;
           if (validQuestions === 0) {
             detailRumus = "Belum ada data valid untuk dihitung bulan ini.";
           } else if (mod.slug === "apar" || mod.slug === "luar-gedung") {
             detailRumus = `Rata-rata dari ${validQuestions} pertanyaan. (Tiap pertanyaan dihitung dari rasio APAR Patuh / APAR Seharusnya sesuai Master Data)`;
           } else if (mod.slug === "apd") {
             detailRumus = `Rata-rata dari ${validQuestions} pertanyaan. (Tiap pertanyaan dihitung dari rasio Karyawan Patuh / Karyawan Seharusnya sesuai Master Data)`;
           } else if (mod.slug === "b3") {
             detailRumus = `Rata-rata dari ${validQuestions} pertanyaan. (Tiap pertanyaan dihitung dari rasio Lemari B3 Patuh / Lemari Seharusnya sesuai Master Data)`;
           } else {
             detailRumus = `Rata-rata persentase dari ${validQuestions} pertanyaan. (Tiap pertanyaan = (Ya / (Ya + Tidak)) x 100%)`;
           }
        } else {
           detailRumus = "Hanya berupa Log/Catatan kegiatan, tidak ada persentase kepatuhan.";
        }

        summaryData.push({
          title: mod.title,
          group: mod.group,
          totalPct: aggregate.totalPct,
          count: aggregate.submissions.length,
          logOnly: mod.logOnly,
          detailRumus
        });
      }

      // Title
      summarySheet.mergeCells(1, 1, 1, 6);
      const sumTitle = summarySheet.getCell(1, 1);
      sumTitle.value = `Ringkasan Kepatuhan K3 — ${formatBulan(bulan)}`;
      sumTitle.font = { bold: true, size: 14, color: { argb: "FFB71C1C" } };
      sumTitle.alignment = { horizontal: "center", vertical: "middle" };
      summarySheet.getRow(1).height = 30;

      // Table Header
      const sumHeaders = ["No", "Grup", "Topik Patroli", "Kepatuhan (%)", "Jml Submission"];
      const sumHeaderRow = summarySheet.getRow(3);
      sumHeaders.forEach((h, i) => {
        sumHeaderRow.getCell(i + 1).value = h;
      });
      applyHeaderRow(sumHeaderRow);

      summarySheet.getColumn(1).width = 5;
      summarySheet.getColumn(2).width = 25;
      summarySheet.getColumn(3).width = 35;
      summarySheet.getColumn(4).width = 15;
      summarySheet.getColumn(5).width = 15;

      let rNum = 4;
      summaryData.forEach((d, i) => {
        const row = summarySheet.getRow(rNum++);
        row.getCell(1).value = i + 1;
        row.getCell(2).value = d.group;
        row.getCell(3).value = d.title;
        
        const pctCell = row.getCell(4);
        if (d.logOnly) {
          pctCell.value = "Log";
        } else {
          pctCell.value = d.totalPct !== null ? d.totalPct : "-";
          if (typeof pctCell.value === 'number') {
             if (pctCell.value >= 90) pctCell.font = { color: { argb: "FF15803D" }, bold: true };
             else if (pctCell.value >= 70) pctCell.font = { color: { argb: "FFB45309" }, bold: true };
             else pctCell.font = { color: { argb: "FFB91C1C" }, bold: true };
          }
        }
        
        row.getCell(5).value = d.count;
        applyDataRow(row, i + 1);
      });

      // Tambahkan Keterangan/Informasi Rumus di bawah tabel
      rNum += 2;
      const infoTitleRow = summarySheet.getRow(rNum);
      infoTitleRow.getCell(2).value = "Informasi Perhitungan & Panduan Rumus:";
      infoTitleRow.getCell(2).font = { bold: true, color: { argb: "FF333333" }, underline: true };
      rNum++;

      summaryData.forEach((d) => {
        if (!d.logOnly && d.detailRumus && d.detailRumus !== "-") {
          const infoRow = summarySheet.getRow(rNum);
          infoRow.getCell(2).value = d.title + ":";
          infoRow.getCell(2).font = { bold: true, size: 9 };
          infoRow.getCell(3).value = d.detailRumus;
          infoRow.getCell(3).font = { size: 9, italic: true };
          summarySheet.mergeCells(rNum, 3, rNum, 5);
          infoRow.getCell(3).alignment = { vertical: 'middle', wrapText: true };
          infoRow.height = 30; // auto fit doesn't always work with merged cells
          rNum++;
        }
      });

      // Generate Chart using QuickChart di bawah tabel
      const chartItems = summaryData.filter(d => !d.logOnly);
      if (chartItems.length > 0) {
        const chartConfig = {
          type: 'horizontalBar',
          data: {
            labels: chartItems.map(d => d.title.length > 25 ? d.title.substring(0, 25) + "..." : d.title),
            datasets: [{
              label: 'Kepatuhan (%)',
              data: chartItems.map(d => d.totalPct ?? 0),
              backgroundColor: chartItems.map(d => {
                const p = d.totalPct ?? 0;
                if (p >= 90) return '#15803d'; // green
                if (p >= 70) return '#b45309'; // yellow
                return '#b91c1c'; // red
              })
            }]
          },
          options: {
            layout: { padding: { right: 50 } },
            legend: { display: false },
            title: { display: true, text: 'Persentase Kepatuhan Per Topik', fontSize: 16 },
            scales: { xAxes: [{ ticks: { min: 0, max: 100, stepSize: 20 } }] },
            plugins: {
              datalabels: {
                anchor: 'end', align: 'right', color: 'black', font: { weight: 'bold' },
                formatter: (value: any) => value + '%'
              }
            }
          }
        };

        try {
          const qcUrl = `https://quickchart.io/chart?w=800&h=500&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
          const qcRes = await fetch(qcUrl);
          if (qcRes.ok) {
            const buffer = await qcRes.arrayBuffer();
            const imageId = workbook.addImage({
              buffer: buffer,
              extension: 'png',
            });
            summarySheet.addImage(imageId, {
              tl: { col: 1, row: rNum + 2 } as any,
              br: { col: 7, row: rNum + 18 } as any
            });
          }
        } catch (e) {
          console.warn("Gagal fetch chart gambar dari quickchart", e);
        }
      }
    }
    // --- END SHEET RINGKASAN ---

    for (const mod of modulesToExport) {
      if (mod.logOnly && mod.slug !== "sosialisasi") continue; // Export sosialisasi as well now

      const sheetName = mod.title.replace(/[*?:\/\[\]\\]/g, '-').slice(0, 31); // Excel limit and valid chars
      const sheet = workbook.addWorksheet(sheetName, {
        pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
      });

      const aggregate = computeModuleAggregate(mod, rows, masterData);
      const isPCRA = mod.slug === "pcra";
      const isLuarGedung = mod.slug === "luar-gedung";
      const isB3 = mod.slug === "b3";
      const isSosialisasi = mod.slug === "sosialisasi";
      const isAPD = mod.slug === "apd";
      const isAPAR = mod.slug === "apar";

      let locationHeader = "Ruangan";
      if (isPCRA) locationHeader = "Lokasi & Deskripsi Pekerjaan";
      if (isLuarGedung) locationHeader = "Lokasi";
      if (isB3) locationHeader = "Ruangan Patroli B3";
      
      let extrasBefore: string[] = [];
      if (mod.slug === "apar") extrasBefore = ["Jumlah APAR Powder", "Jumlah APAR CO2"];
      if (isLuarGedung) extrasBefore = ["Jumlah APAR Powder 6 kg", "Jumlah APAR Powder 25 kg", "Jumlah APAR CO2"];
      if (isB3) extrasBefore = ["Jumlah Lemari"]; // "Jumlah Lemari B3" mapped via B3 label Logic
      
      let extrasAfter: string[] = [];
      if (mod.slug === "apar" || isLuarGedung) extrasAfter = ["Tgl. Pemeliharaan Terakhir"];
      if (isB3) extrasAfter = ["Jumlah Eyewasher", "Jumlah Bodywasher"];

      let headers = [
        "No",
        "Tanggal",
        "Petugas",
        locationHeader,
        "Patroli Ke-",
      ];

      if (isSosialisasi) {
        headers.push("Topik Sosialisasi", "Sasaran", "Keterangan / Temuan", "Foto URL");
      } else {
        for (const l of extrasBefore) {
          if (isAPAR || isLuarGedung) {
            headers.push(`${l} (Seharusnya)`);
            headers.push(`${l} (Terlihat)`);
          } else {
            headers.push(l);
          }
        }
        
        if (isAPAR || isLuarGedung) headers.push("Total APAR (Seharusnya)");
        if (isAPD) headers.push("Total Karyawan (Seharusnya)");

        headers.push(...mod.questions.map((q) => q.label));
        
        if (isAPD) headers.push("Total % (Per Baris)");
        
        headers.push(...extrasAfter);
        headers.push("Keterangan / Temuan", "Foto URL");
      }

      // Menentukan baris awal untuk tabel
      let tableStartRow = 3;

      // Title row
      const titleCols = headers.length;
      sheet.mergeCells(1, 1, 1, titleCols);
      const titleCell = sheet.getCell(1, 1);
      titleCell.value = `Laporan Patroli — ${mod.title} — ${formatBulan(bulan)}`;
      titleCell.font = { bold: true, size: 12, color: { argb: "FFB71C1C" } };
      titleCell.alignment = { horizontal: "center" };
      sheet.getRow(1).height = 24;

      // Header row
      const headerRow = sheet.getRow(tableStartRow - 1);
      headers.forEach((h, i) => {
        headerRow.getCell(i + 1).value = h;
      });
      applyHeaderRow(headerRow);

      // Default column widths
      sheet.getColumn(1).width = 5;
      sheet.getColumn(2).width = 14;
      sheet.getColumn(3).width = 22;
      sheet.getColumn(4).width = 28;
      sheet.getColumn(5).width = 10;
      let colIdx = 6;
      
      if (isSosialisasi) {
        sheet.getColumn(colIdx++).width = 25; // Topik
        sheet.getColumn(colIdx++).width = 25; // Sasaran
        sheet.getColumn(colIdx++).width = 35; // Keterangan
        sheet.getColumn(colIdx++).width = 20; // Foto
      } else {
        for (const _ of extrasBefore) sheet.getColumn(colIdx++).width = 14;
        for (const _ of mod.questions) sheet.getColumn(colIdx++).width = 16;
        for (const _ of extrasAfter) sheet.getColumn(colIdx++).width = 14;
        sheet.getColumn(colIdx++).width = 35; // Keterangan
        sheet.getColumn(colIdx++).width = 20; // Foto
      }

      // Data rows
      let rowNum = tableStartRow;
      let dataIdx = 0;

      for (const sub of aggregate.submissions) {
        const masterProfesiNames = masterData.filter((m: any) => m.Ruangan?.startsWith('**')).map((m: any) => m.Ruangan?.substring(2).trim().toLowerCase());
        const finalDesc = buildKeteranganForExport(sub, isAPD, isB3, masterProfesiNames);

        dataIdx++;
        
        const getExt = (lbl: string) => {
          const e = sub.extras?.find(x => x.label === lbl || x.label.includes(lbl));
          return e ? formatMaybeDate(e.value) : "-";
        };

        const getAns = (sh: string) => {
          const a = sub.answers?.find(x => x.question.sheetHeader === sh);
          const ans = a ? a.jawaban : "-";
          
          if (ans === "N/A" || ans === "" || ans === "-") {
            return ans === "N/A" ? "N/A" : "-";
          }

          if (isAPAR || isLuarGedung) {
            const mRow = masterData.find((m: any) => m.Ruangan?.trim().toLowerCase() === (sub.location || "").trim().toLowerCase());
            let totalApar = 0;
            if (mRow) {
              if (isAPAR) {
                totalApar = (parseInt(mRow["Jumlah APAR Powder"]) || 0) + (parseInt(mRow["Jumlah APAR CO2"]) || 0);
              } else {
                totalApar = (parseInt(mRow["Jumlah APAR Powder 6 kg"]) || 0) + (parseInt(mRow["Jumlah APAR Powder 25 kg"]) || 0) + (parseInt(mRow["Jumlah APAR CO2"]) || 0);
              }
            } else {
              const getE = (l: string) => {
                const e = sub.extras?.find((x: any) => x.label === l || x.label.includes(l));
                return parseInt(e?.value || "0", 10) || 0;
              };
              if (isAPAR) {
                totalApar = getE("Jumlah APAR Powder") + getE("Jumlah APAR CO2");
              } else if (isLuarGedung) {
                totalApar = getE("Jumlah APAR Powder 6 kg") + getE("Jumlah APAR Powder 25 kg") + getE("Jumlah APAR CO2");
              }
            }
            if (ans === "Ya") {
              return totalApar;
            } else if (ans === "Tidak") {
              let nonCompliant = totalApar; // Default: if not found, assume all are non-compliant
              const desc = sub.description || "";
              const qLabel = a?.question.label || "";
              
              if (qLabel.includes("Terjangkau")) {
                const match = desc.match(/TJ\s*[:=]\s*(\d+)/i);
                if (match) nonCompliant = parseInt(match[1]);
              } else if (qLabel.includes("Rambu")) {
                const match = desc.match(/RS\s*[:=]\s*(\d+)/i);
                if (match) nonCompliant = parseInt(match[1]);
              } else if (qLabel.includes("Kartu")) {
                const match = desc.match(/KP\s*[:=]\s*(\d+)/i);
                if (match) nonCompliant = parseInt(match[1]);
              }
              
              return Math.max(0, totalApar - nonCompliant);
            }
          }

          if (isB3) {
            const qLbl = a?.question.label || "";
            if (qLbl === "Penyimpanan B3" || qLbl === "Ketersediaan SDS") {
              let expected = 1;
              const mRow = masterData.find((m: any) => m.Ruangan?.trim().toLowerCase() === (sub.location || "").trim().toLowerCase());
              expected = mRow ? (parseInt(mRow["Jumlah Lemari B3"]) || 0) : 0;
              if (expected === 0) {
                const ext = sub.extras?.find((x: any) => x.label === "Jumlah Lemari B3" || x.label.includes("Jumlah Lemari"));
                expected = parseInt(ext?.value || "0", 10) || 0;
              }

              if (ans === "Ya") {
                return expected;
              } else if (ans === "Tidak") {
                const nonCompliant = (sub.tags && sub.tags.length > 0) ? sub.tags.length : expected;
                return Math.max(0, expected - nonCompliant);
              }
            }
          }

          if (isAPD) {
            const mRow = masterData.find((m: any) => m.Ruangan?.trim().toLowerCase() === (sub.location || "").trim().toLowerCase());
            const totalKaryawan = mRow ? (parseInt(mRow["Jumlah Karyawan"]) || 0) : 0;
            if (ans === "Ya") {
              return totalKaryawan;
            } else if (ans === "Tidak") {
              const masterProfesiNames = masterData.filter((m: any) => m.Ruangan?.startsWith('**')).map((m: any) => m.Ruangan?.substring(2).trim().toLowerCase());
              const nonCompliant = sub.tags ? sub.tags.filter((t: string) => !masterProfesiNames.includes(t.toLowerCase())).length : 0;
              let compliant = Math.max(0, totalKaryawan - nonCompliant);
              if (nonCompliant === 0 && sub.tags && sub.tags.length === 0) compliant = 0;
              return compliant;
            }
          }

          return a ? jawabanDisplay(a.jawaban) : "-";
        };

        const vals: (string | number)[] = [
          dataIdx,
          sub.row.tanggalPemantauan || sub.row.timestamp,
          sub.row.namaPetugas,
          sub.location || "-",
          sub.row.patroliKe || "-",
        ];

        if (isSosialisasi) {
          vals.push(getExt("Topik"), getExt("Sasaran"), finalDesc);
          if (sub.photoUrl) vals.push(sub.photoUrl);
        } else {
          for (const l of extrasBefore) {
            if (isAPAR || isLuarGedung) {
              const mRow = masterData.find((m: any) => m.Ruangan?.trim().toLowerCase() === (sub.location || "").trim().toLowerCase());
              const valSeharusnya = mRow && mRow[l] !== undefined ? mRow[l] : "-";
              vals.push(valSeharusnya);
              vals.push(getExt(l));
            } else {
              vals.push(getExt(l));
            }
          }
          
          if (isAPAR || isLuarGedung) {
            const mRow = masterData.find((m: any) => m.Ruangan?.trim().toLowerCase() === (sub.location || "").trim().toLowerCase());
            let totalAparSeharusnya: number | string = "-";
            if (mRow) {
              if (isAPAR) {
                totalAparSeharusnya = (parseInt(mRow["Jumlah APAR Powder"]) || 0) + (parseInt(mRow["Jumlah APAR CO2"]) || 0);
              } else {
                totalAparSeharusnya = (parseInt(mRow["Jumlah APAR Powder 6 kg"]) || 0) + (parseInt(mRow["Jumlah APAR Powder 25 kg"]) || 0) + (parseInt(mRow["Jumlah APAR CO2"]) || 0);
              }
            }
            vals.push(totalAparSeharusnya);
          }
          if (isAPD) {
            const mRow = masterData.find((m: any) => m.Ruangan?.trim().toLowerCase() === (sub.location || "").trim().toLowerCase());
            vals.push(mRow ? (parseInt(mRow["Jumlah Karyawan"]) || 0) : "-");
          }

          for (const q of mod.questions) vals.push(getAns(q.sheetHeader));
          
          if (isAPD) {
            const mRow = masterData.find((m: any) => m.Ruangan?.trim().toLowerCase() === (sub.location || "").trim().toLowerCase());
            const totalKaryawan = mRow ? (parseInt(mRow["Jumlah Karyawan"], 10) || 0) : 0;
            let sumCompliant = 0;
            let maxCompliant = 0;
            mod.questions.forEach((q) => {
              const a = sub.answers?.find((x: any) => x.question.sheetHeader === q.sheetHeader);
              const ans = a ? a.jawaban : "-";
              if (ans === "N/A" || ans === "" || ans === "-") return;
              maxCompliant += totalKaryawan;
              if (ans === "Ya") {
                sumCompliant += totalKaryawan;
              } else if (ans === "Tidak") {
                const nonCompliant = sub.tags ? sub.tags.length : 0;
                let compliant = Math.max(0, totalKaryawan - nonCompliant);
                if (nonCompliant === 0) compliant = 0;
                sumCompliant += compliant;
              }
            });
            const rowPct = maxCompliant === 0 ? "-" : Math.round((sumCompliant / maxCompliant) * 100) + "%";
            vals.push(rowPct);
          }

          for (const l of extrasAfter) vals.push(getExt(l));
          vals.push(finalDesc);
          // Photo URL is added as a separate hyperlink cell, added below
        }

        const dataRow = sheet.getRow(rowNum++);
        vals.forEach((v, i) => {
          dataRow.getCell(i + 1).value = v;
        });
        // Photo URL as clickable hyperlink in last column
        if (!isSosialisasi && sub.photoUrl) {
          const photoCell = dataRow.getCell(vals.length + 1);
          photoCell.value = { text: "📷 Lihat Foto", hyperlink: sub.photoUrl };
          photoCell.font = { color: { argb: "FF1565C0" }, underline: true, size: 9 };
          photoCell.alignment = { vertical: "middle", wrapText: false };
        } else if (isSosialisasi && sub.photoUrl) {
          // already pushed to vals in sosialisasi branch — make it a hyperlink
          const photoCell = dataRow.getCell(vals.length);
          photoCell.value = { text: "📷 Lihat Foto", hyperlink: sub.photoUrl };
          photoCell.font = { color: { argb: "FF1565C0" }, underline: true, size: 9 };
          photoCell.alignment = { vertical: "middle", wrapText: false };
        }
        applyDataRow(dataRow, dataIdx);
        // Re-apply photo cell font after applyDataRow (it resets it)
        if (sub.photoUrl) {
          const photoCell = dataRow.getCell(isSosialisasi ? vals.length : vals.length + 1);
          photoCell.font = { color: { argb: "FF1565C0" }, underline: true, size: 9 };
        }
      }

      // Add summary row for non-sosialisasi if data exists
      if (dataIdx > 0 && !isSosialisasi) {
        const startMergeIdx = 5; 

        // Percentage
        rowNum++;
        const summaryRow = sheet.getRow(rowNum);
        summaryRow.getCell(1).value = `TOTAL KEPATUHAN: ${aggregate.totalPct ?? 0}%`;
        summaryRow.getCell(1).font = { bold: true, color: { argb: "FFB71C1C" } };
        summaryRow.getCell(1).alignment = { horizontal: "right", vertical: "middle" };
        sheet.mergeCells(rowNum, 1, rowNum, startMergeIdx);

        let qColIdx = startMergeIdx + 1;
        
        for (const l of extrasBefore) {
          if (isAPAR || isLuarGedung) {
            let sumSeharusnya = 0;
            let sumTerlihat = 0;
            for (const sub of aggregate.submissions) {
              const mRow = masterData.find((m: any) => m.Ruangan?.trim().toLowerCase() === (sub.location || "").trim().toLowerCase());
              const valS = mRow && mRow[l] !== undefined ? mRow[l] : 0;
              sumSeharusnya += parseInt(valS as string, 10) || 0;
              
              const ext = sub.extras?.find((x: any) => x.label === l || x.label.includes(l));
              sumTerlihat += parseInt(ext?.value || "0", 10) || 0;
            }
            summaryRow.getCell(qColIdx).value = sumSeharusnya;
            summaryRow.getCell(qColIdx).font = { bold: true };
            summaryRow.getCell(qColIdx).alignment = { horizontal: "center", vertical: "middle" };
            summaryRow.getCell(qColIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E0" } };
            qColIdx++;

            summaryRow.getCell(qColIdx).value = sumTerlihat;
            summaryRow.getCell(qColIdx).font = { bold: true };
            summaryRow.getCell(qColIdx).alignment = { horizontal: "center", vertical: "middle" };
            summaryRow.getCell(qColIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E0" } };
            qColIdx++;
          } else {
            const ef = mod.extraFields?.find(e => e.label === l);
            if (ef?.fieldType === "number") {
              let sumVal = 0;
              for (const sub of aggregate.submissions) {
                const ext = sub.extras?.find((x: any) => x.label === l || x.label.includes(l));
                sumVal += parseInt(ext?.value || "0", 10) || 0;
              }
              summaryRow.getCell(qColIdx).value = sumVal;
            } else {
              summaryRow.getCell(qColIdx).value = "-";
            }
            summaryRow.getCell(qColIdx).font = { bold: true };
            summaryRow.getCell(qColIdx).alignment = { horizontal: "center", vertical: "middle" };
            summaryRow.getCell(qColIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E0" } };
            qColIdx++;
          }
        }
        
        if (isAPAR || isLuarGedung) {
           let sumTotalSeharusnya = 0;
           for (const sub of aggregate.submissions) {
              const mRow = masterData.find((m: any) => m.Ruangan?.trim().toLowerCase() === (sub.location || "").trim().toLowerCase());
              if (mRow) {
                if (isAPAR) {
                  sumTotalSeharusnya += (parseInt(mRow["Jumlah APAR Powder"]) || 0) + (parseInt(mRow["Jumlah APAR CO2"]) || 0);
                } else {
                  sumTotalSeharusnya += (parseInt(mRow["Jumlah APAR Powder 6 kg"]) || 0) + (parseInt(mRow["Jumlah APAR Powder 25 kg"]) || 0) + (parseInt(mRow["Jumlah APAR CO2"]) || 0);
                }
              } else {
                const getE = (l: string) => {
                  const e = sub.extras?.find((x: any) => x.label === l || x.label.includes(l));
                  return parseInt(e?.value || "0", 10) || 0;
                };
                if (isAPAR) {
                  sumTotalSeharusnya += getE("Jumlah APAR Powder") + getE("Jumlah APAR CO2");
                } else if (isLuarGedung) {
                  sumTotalSeharusnya += getE("Jumlah APAR Powder 6 kg") + getE("Jumlah APAR Powder 25 kg") + getE("Jumlah APAR CO2");
                }
              }
           }
           summaryRow.getCell(qColIdx).value = sumTotalSeharusnya;
           summaryRow.getCell(qColIdx).font = { bold: true };
           summaryRow.getCell(qColIdx).alignment = { horizontal: "center", vertical: "middle" };
           summaryRow.getCell(qColIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E0" } };
           qColIdx++;
        }
        
        if (isAPD) {
           let sumKaryawan = 0;
           for (const sub of aggregate.submissions) {
              const mRow = masterData.find((m: any) => m.Ruangan?.trim().toLowerCase() === (sub.location || "").trim().toLowerCase());
              if (mRow) {
                 sumKaryawan += parseInt(mRow["Jumlah Karyawan"]) || 0;
              }
           }
           summaryRow.getCell(qColIdx).value = sumKaryawan;
           summaryRow.getCell(qColIdx).font = { bold: true };
           summaryRow.getCell(qColIdx).alignment = { horizontal: "center", vertical: "middle" };
           summaryRow.getCell(qColIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E0" } };
           qColIdx++;
        }

        for (const q of mod.questions) {
          const qr = aggregate.questionResults.find((res) => res.question.sheetHeader === q.sheetHeader);
          summaryRow.getCell(qColIdx).value = qr?.pct !== null ? `${qr?.pct}%` : "-";
          summaryRow.getCell(qColIdx).font = { bold: true };
          summaryRow.getCell(qColIdx).alignment = { horizontal: "center", vertical: "middle" };
          summaryRow.getCell(qColIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E0" } };
          qColIdx++;
        }
        
        if (isAPD) {
          summaryRow.getCell(qColIdx).value = "-";
          summaryRow.getCell(qColIdx).font = { bold: true };
          summaryRow.getCell(qColIdx).alignment = { horizontal: "center", vertical: "middle" };
          summaryRow.getCell(qColIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E0" } };
          qColIdx++;
        }

        for (const l of extrasAfter) {
          const ef = mod.extraFields?.find(e => e.label === l);
          if (ef?.fieldType === "number") {
            let sumVal = 0;
            for (const sub of aggregate.submissions) {
              const ext = sub.extras?.find((x: any) => x.label === l || x.label.includes(l));
              sumVal += parseInt(ext?.value || "0", 10) || 0;
            }
            summaryRow.getCell(qColIdx).value = sumVal;
          } else {
            summaryRow.getCell(qColIdx).value = "-";
          }
          summaryRow.getCell(qColIdx).font = { bold: true };
          summaryRow.getCell(qColIdx).alignment = { horizontal: "center", vertical: "middle" };
          summaryRow.getCell(qColIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E0" } };
          qColIdx++;
        }
      }

      if (dataIdx === 0) {
        const emptyRow = sheet.getRow(rowNum);
        emptyRow.getCell(1).value = "Tidak ada data untuk periode ini";
        sheet.mergeCells(rowNum, 1, rowNum, titleCols);
        emptyRow.getCell(1).alignment = { horizontal: "center" };
        emptyRow.getCell(1).font = { italic: true, color: { argb: "FF999999" } };
      }

      // --- CHART PERTANYAAN & PROFESI (DI BAWAH TABEL) ---
      const validQuestions = aggregate.questionResults.filter(q => q.pct !== null);
      if (!isSosialisasi && validQuestions.length > 0) {
        const chartConfig = {
          type: 'horizontalBar',
          data: {
            labels: validQuestions.map(q => {
              const lbl = q.question.label;
              return lbl.length > 40 ? lbl.substring(0, 40) + "..." : lbl;
            }),
            datasets: [{
              label: 'Kepatuhan (%)',
              data: validQuestions.map(q => q.pct ?? 0),
              backgroundColor: validQuestions.map(q => {
                const p = q.pct ?? 0;
                return p >= 90 ? '#199e70' : '#d03b3b';
              })
            }]
          },
          options: {
            layout: { padding: { right: 40 } },
            legend: { display: false },
            title: { display: true, text: 'Kepatuhan Per Pertanyaan', fontSize: 16 },
            scales: { xAxes: [{ ticks: { min: 0, max: 100, stepSize: 20 } }] },
            plugins: {
              datalabels: {
                anchor: 'end', align: 'right', color: 'black', font: { weight: 'bold' },
                formatter: (value: any) => value + '%'
              }
            }
          }
        };

        try {
          const height = Math.max(500, validQuestions.length * 40 + 100);
          const qcUrl = `https://quickchart.io/chart?w=800&h=${height}&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
          const qcRes = await fetch(qcUrl);
          if (qcRes.ok) {
            const buffer = await qcRes.arrayBuffer();
            const imageId = workbook.addImage({
              buffer: buffer,
              extension: 'png',
            });
            sheet.addImage(imageId, {
              tl: { col: 1, row: rowNum + 2 } as any,
              br: { col: 7, row: rowNum + 18 } as any
            });
          }
        } catch (e) {
          console.warn("Gagal fetch chart pertanyaan", e);
        }

        if (isAPD) {
          const profesiCount: Record<string, number> = {};
          for (const sub of aggregate.submissions) {
            if (sub.tags && sub.tags.length > 0) {
              for (const tag of sub.tags) {
                let profesi = tag.trim();
                if (!profesi) continue;
                if (profesi.toLowerCase() === "perawat") {
                  profesi = `Perawat-${sub.location || 'Tidak Diketahui'}`;
                }
                profesiCount[profesi] = (profesiCount[profesi] || 0) + 1;
              }
            }
          }
          const profesiItems = Object.entries(profesiCount)
             .map(([name, count]) => ({ name, count }))
             .sort((a, b) => b.count - a.count);

          if (profesiItems.length > 0) {
            const profesiChartConfig = {
              type: 'bar',
              data: {
                labels: profesiItems.map(p => p.name.length > 15 ? p.name.substring(0, 15) + "..." : p.name),
                datasets: [{
                  label: 'Jumlah Pelanggaran',
                  data: profesiItems.map(p => p.count),
                  backgroundColor: profesiItems.map(p => p.name.toLowerCase().includes("perawat") ? '#B71C1C' : '#F59E0B')
                }]
              },
              options: {
                layout: { padding: { top: 20 } },
                legend: { display: false },
                title: { display: true, text: 'Statistik Profesi Melanggar', fontSize: 16 },
                scales: {
                  yAxes: [{ ticks: { min: 0, stepSize: 1 } }]
                },
                plugins: {
                  datalabels: {
                    anchor: 'end', align: 'top', color: 'black', font: { weight: 'bold' }
                  }
                }
              }
            };
            try {
               const pQcUrl = `https://quickchart.io/chart?w=600&h=400&c=${encodeURIComponent(JSON.stringify(profesiChartConfig))}`;
               const pQcRes = await fetch(pQcUrl);
               if (pQcRes.ok) {
                  const buffer = await pQcRes.arrayBuffer();
                  const imageId2 = workbook.addImage({
                    buffer,
                    extension: 'png',
                  });
                  sheet.addImage(imageId2, {
                    tl: { col: 8, row: rowNum + 2 } as any,
                    br: { col: 13, row: rowNum + 18 } as any
                  });
               }
            } catch (e) {
               console.warn("Gagal fetch chart profesi", e);
            }
          }
        }
      }
      
      // Freeze header dihapus karena permintaan user
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();


    let filename = slug
      ? `K3_RSOMH_${slug.toUpperCase()}_${bulan}.xlsx`
      : `K3_RSOMH_LaporanLengkap_${bulan}.xlsx`;

    if (slug === "pcra" && topicName) {
      const safeTopic = topicName.replace(/[^a-z0-9]/gi, '_');
      filename = `K3_RSOMH_PCRA_${safeTopic}_${bulan}.xlsx`;
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("[/api/export/excel]", error);
    return NextResponse.json(
      {
        error: "Gagal membuat file Excel",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
