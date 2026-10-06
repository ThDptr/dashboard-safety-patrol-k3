// ─────────────────────────────────────────────────────────────────────────────
// lib/export-apar.ts — Excel sheet builder khusus modul APAR
// Dashboard Patroli Kesling & K3 RSOMH
// ─────────────────────────────────────────────────────────────────────────────
//
// Tujuan: sheet Excel APAR harus IDENTIK dengan tabel di dashboard
// (components/SubmissionTable.tsx) — baik susunan sel/kolom maupun perhitungannya.
//
// Susunan kolom (sama persis dengan dashboard):
//   1  No
//   2  Tanggal
//   3  Nama Petugas
//   4  Ruangan
//   5  Patroli Ke-
//   6-7  Seharusnya | Jumlah APAR Powder   (merge 2 kolom: 6kg & 25kg untuk Luar Gedung)
//   8-9  Terlihat   | Jumlah APAR Powder   (merge 2 kolom)
//   10 Seharusnya | Jumlah APAR CO2
//   11 Terlihat   | Jumlah APAR CO2
//   12 Seharusnya | Total APAR
//   13.. Kolom pertanyaan (nilai = jumlah APAR yang patuh)
//   Per Baris | Patuh, Tdk Patuh, Total %
//   Tgl. Pemeliharaan Terakhir, Keterangan, Foto
//
// Baris data: APAR Dalam Gedung (A–Z lokasi, lalu tanggal) → pemisah
// "APAR Luar Gedung" → baris Luar Gedung (kolom 6-9 terpisah: 6kg/25kg)
// → baris TOTAL (footer).
// ─────────────────────────────────────────────────────────────────────────────

import ExcelJS from "exceljs";
import type { ModuleDef } from "./modules";
import type { ModuleAggregateResult } from "./analytics";
import { formatBulan, formatTimestamp, formatMaybeDate } from "./utils";

// ─── Palet warna (disamakan dengan kelas Tailwind di dashboard) ──────────────

const COLOR = {
  white: "FFFFFFFF",
  gray50: "FFF9FAFB",
  gray100: "FFF3F4F6",
  gray200: "FFE5E7EB",
  gray400: "FF9CA3AF",
  gray500: "FF6B7280",
  gray600: "FF4B5563",
  gray800: "FF1F2937",
  blue50: "FFEFF6FF",
  blue700: "FF1D4ED8",
  blue800: "FF1E40AF",
  blue200: "FFBFDBFE",
  emerald50: "FFECFDF5",
  emerald200: "FFA7F3D0",
  emerald600: "FF059669",
  emerald700: "FF047857",
  emerald800: "FF065F46",
  green50: "FFF0FDF4",
  green100: "FFDCFCE7",
  green200: "FFBBF7D0",
  green700: "FF15803D",
  green800: "FF166534",
  red50: "FFFEF2F2",
  red100: "FFFEE2E2",
  red200: "FFFECACA",
  red600: "FFDC2626",
  red700: "FFB91C1C",
  red800: "FF991B1B",
  indigo100: "FFE0E7FF",
  indigo200: "FFC7D2FE",
  indigo700: "FF4338CA",
  indigo800: "FF3730A3",
  amber50: "FFFFFBEB",
  amber100: "FFFEF3C7",
  amber200: "FFFDE68A",
  amber300: "FFFCD34D",
  amber700: "FFB45309",
  amber800: "FF92400E",
  link: "FF1D4ED8",
};

/** Warna kolom pertanyaan (urutan sama dengan Q_COLORS di SubmissionTable). */
const Q_PALETTE = [
  { bg: "FFEFF6FF", text: "FF1E3A8A" }, // blue
  { bg: "FFFFFBEB", text: "FF78350F" }, // amber
  { bg: "FFECFDF5", text: "FF064E3B" }, // emerald
  { bg: "FFFAF5FF", text: "FF581C87" }, // purple
  { bg: "FFFFF1F2", text: "FF881337" }, // rose
  { bg: "FFECFEFF", text: "FF164E63" }, // cyan
];

// ─── Helper styling ──────────────────────────────────────────────────────────

interface CellStyle {
  fill?: string;
  font?: Partial<ExcelJS.Font>;
  align?: Partial<ExcelJS.Alignment>;
  border?: string;
  borderTop?: string;
}

const solid = (argb: string): ExcelJS.Fill => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb },
});

function thin(argb: string): Partial<ExcelJS.Border> {
  return { style: "thin", color: { argb } };
}

function applyStyle(cell: ExcelJS.Cell, st: CellStyle): void {
  if (st.fill) cell.fill = solid(st.fill);
  cell.font = { name: "Calibri", size: 10, ...(st.font ?? {}) };
  cell.alignment = { vertical: "middle", ...(st.align ?? {}) };
  const edge = st.border ?? COLOR.gray200;
  cell.border = {
    left: thin(edge),
    right: thin(edge),
    bottom: thin(edge),
    top: thin(st.borderTop ?? edge),
  };
}

/** Tulis nilai ke sel (opsional merge horizontal sampai kolom `spanTo`) lalu beri style. */
function put(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  value: ExcelJS.CellValue,
  st: CellStyle,
  spanTo?: number
): ExcelJS.Cell {
  const cell = ws.getCell(row, col);
  cell.value = value;
  applyStyle(cell, st);
  if (spanTo && spanTo > col) {
    for (let c = col + 1; c <= spanTo; c++) applyStyle(ws.getCell(row, c), st);
    ws.mergeCells(row, col, row, spanTo);
  }
  return cell;
}

/** Header dua baris dalam satu sel: caption kecil (uppercase) + label. */
function headerText(caption: string | null, label: string, color: string): ExcelJS.CellRichTextValue {
  const parts: ExcelJS.RichText[] = [];
  if (caption) {
    parts.push({
      text: caption.toUpperCase() + "\n",
      font: { size: 8, color: { argb: color }, name: "Calibri" },
    });
  }
  parts.push({ text: label, font: { size: 10, bold: true, color: { argb: color }, name: "Calibri" } });
  return { richText: parts };
}

const toInt = (v: unknown): number => parseInt(String(v ?? ""), 10) || 0;

/** Angka murni → number (agar bisa dihitung di Excel), selain itu tetap teks. */
function numOrText(v: string | number): string | number {
  if (typeof v === "number") return v;
  return /^-?\d+$/.test(v.trim()) ? Number(v.trim()) : v;
}

const fmtPct2 = (num: number, den: number): string =>
  Number(((num / den) * 100).toFixed(2)) + "%";

// ─── Builder utama ───────────────────────────────────────────────────────────

export interface AparSheetOptions {
  mod: ModuleDef;
  aggregate: ModuleAggregateResult;
  /** Master data Ruangan + Luar Gedung (sama seperti yang dipakai dashboard APAR) */
  masterData: any[];
  bulan: string;
}

export async function addAparSheet(
  workbook: ExcelJS.Workbook,
  { mod, aggregate, masterData, bulan }: AparSheetOptions
): Promise<void> {
  const ws = workbook.addWorksheet(mod.title.slice(0, 31), {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  // ── Master data lookup (sama dengan SubmissionTable.getMasterRow) ──────────
  const masterMap = new Map<string, any>();
  for (const m of masterData ?? []) {
    if (m.Ruangan) masterMap.set(String(m.Ruangan).trim().toLowerCase(), m);
    if (m.Lokasi) masterMap.set(String(m.Lokasi).trim().toLowerCase(), m);
    if (m["Area Luar"]) masterMap.set(String(m["Area Luar"]).trim().toLowerCase(), m);
  }
  const getMasterRow = (location: string): any =>
    location ? masterMap.get(String(location).trim().toLowerCase()) ?? null : null;

  const getExtra = (sub: any, label: string): string => {
    const ext = sub.extras?.find((e: any) => e.label === label || e.label.includes(label));
    return ext ? formatMaybeDate(ext.value) : "-";
  };
  const getExtraExact = (sub: any, label: string): string =>
    sub.extras?.find((e: any) => e.label === label)?.value || "";

  const getAnswer = (sub: any, sheetHeader: string): string => {
    const a = sub.answers?.find((x: any) => x.question.sheetHeader === sheetHeader);
    return a ? a.jawaban : "";
  };

  /** Jumlah APAR bermasalah dari deskripsi (TJ / RS / KP), default = semua APAR. */
  const nonCompliantFromDesc = (desc: string, qLabel: string, total: number): number => {
    let n = total;
    if (qLabel.includes("Terjangkau")) {
      const m = desc.match(/TJ[:=]\s*(\d+)/i);
      if (m) n = parseInt(m[1], 10);
    } else if (qLabel.includes("Rambu")) {
      const m = desc.match(/RS[:=]\s*(\d+)/i);
      if (m) n = parseInt(m[1], 10);
    } else if (qLabel.includes("Kartu")) {
      const m = desc.match(/KP[:=]\s*(\d+)/i);
      if (m) n = parseInt(m[1], 10);
    }
    return n;
  };

  /** Total APAR Seharusnya baris Dalam Gedung (master → fallback "Terlihat"). */
  const totalAparDalam = (sub: any): number => {
    const mRow = getMasterRow(sub.location);
    let total = 0;
    if (mRow) total = toInt(mRow["Jumlah APAR Powder"]) + toInt(mRow["Jumlah APAR CO2"]);
    if (total === 0) {
      total = toInt(getExtra(sub, "Jumlah APAR Powder")) + toInt(getExtra(sub, "Jumlah APAR CO2"));
    }
    return total;
  };

  /** Total APAR baris Dalam Gedung untuk footer (logika footer dashboard: fallback hanya bila master tidak ada). */
  const totalAparDalamFooter = (sub: any): number => {
    const mRow = getMasterRow(sub.location);
    if (mRow) return toInt(mRow["Jumlah APAR Powder"]) + toInt(mRow["Jumlah APAR CO2"]);
    return toInt(getExtra(sub, "Jumlah APAR Powder")) + toInt(getExtra(sub, "Jumlah APAR CO2"));
  };

  /** Total APAR Seharusnya baris Luar Gedung (6kg + 25kg + CO2). */
  const totalAparLuarOf = (sub: any): number => {
    const mRow = getMasterRow(sub.location);
    let total = 0;
    if (mRow) {
      total =
        toInt(mRow["Jumlah APAR Powder 6 kg"]) +
        toInt(mRow["Jumlah APAR Powder 25 kg"]) +
        toInt(mRow["Jumlah APAR CO2"]);
    }
    if (total === 0) {
      total =
        toInt(getExtraExact(sub, "Jumlah APAR Powder")) +
        toInt(getExtraExact(sub, "Jumlah APAR Powder 25 kg")) +
        toInt(getExtraExact(sub, "Jumlah APAR CO2"));
    }
    return total;
  };

  // ── Data: urutan sama dengan dashboard ─────────────────────────────────────
  const dalamRows = [...aggregate.submissions].sort((a: any, b: any) => {
    const locCompare = (a.location || "").localeCompare(b.location || "");
    if (locCompare !== 0) return locCompare;
    const da = new Date(a.row.tanggalPemantauan || a.row.timestamp).getTime();
    const db = new Date(b.row.tanggalPemantauan || b.row.timestamp).getTime();
    return da - db;
  });
  const luarRows = (aggregate.mergedSubmissions ?? []) as any[];
  const questions = mod.questions;
  const nQ = questions.length;

  // ── Layout kolom ───────────────────────────────────────────────────────────
  const COL_NO = 1, COL_TGL = 2, COL_PETUGAS = 3, COL_RUANG = 4, COL_KE = 5;
  const COL_SEH_POWDER = 6; // 6-7
  const COL_TER_POWDER = 8; // 8-9
  const COL_SEH_CO2 = 10;
  const COL_TER_CO2 = 11;
  const COL_TOTAL_APAR = 12;
  const COL_Q0 = 13;
  const COL_PATUH = COL_Q0 + nQ;
  const COL_TDK = COL_PATUH + 1;
  const COL_PCT = COL_PATUH + 2;
  const COL_TGL_PEMELIHARAAN = COL_PATUH + 3;
  const COL_KET = COL_PATUH + 4;
  const COL_FOTO = COL_PATUH + 5;
  const TOTAL_COLS = COL_FOTO;

  const widths: Record<number, number> = {
    [COL_NO]: 5, [COL_TGL]: 16, [COL_PETUGAS]: 22, [COL_RUANG]: 30, [COL_KE]: 11,
    6: 13, 7: 13, 8: 13, 9: 13, [COL_SEH_CO2]: 14, [COL_TER_CO2]: 14, [COL_TOTAL_APAR]: 14,
    [COL_PATUH]: 12, [COL_TDK]: 12, [COL_PCT]: 12,
    [COL_TGL_PEMELIHARAAN]: 18, [COL_KET]: 42, [COL_FOTO]: 16,
  };
  for (let q = 0; q < nQ; q++) widths[COL_Q0 + q] = 20;
  for (let c = 1; c <= TOTAL_COLS; c++) ws.getColumn(c).width = widths[c] ?? 14;

  // ── Baris 1: Judul ─────────────────────────────────────────────────────────
  put(
    ws, 1, 1,
    `Laporan Patroli — ${mod.title} — ${formatBulan(bulan)}`,
    {
      font: { bold: true, size: 14, color: { argb: COLOR.red800 } },
      align: { horizontal: "center" },
      border: COLOR.white,
    },
    TOTAL_COLS
  );
  ws.getRow(1).height = 28;

  // ── Baris 2: Header ────────────────────────────────────────────────────────
  const HR = 2;
  const hdrBase: CellStyle = {
    fill: COLOR.gray100,
    align: { horizontal: "center", vertical: "middle", wrapText: true },
    border: COLOR.gray200,
  };
  const plainHdr = (col: number, label: string) =>
    put(ws, HR, col, label, {
      ...hdrBase,
      font: { bold: true, size: 10, color: { argb: COLOR.gray500 } },
    });
  const groupHdr = (col: number, caption: string, label: string, bg: string, fg: string, span?: number, edge?: string) =>
    put(ws, HR, col, headerText(caption, label, fg), { ...hdrBase, fill: bg, border: edge ?? COLOR.gray200 }, span);

  plainHdr(COL_NO, "No");
  plainHdr(COL_TGL, "Tanggal");
  plainHdr(COL_PETUGAS, "Nama Petugas");
  plainHdr(COL_RUANG, "Ruangan");
  plainHdr(COL_KE, "Patroli Ke-");
  groupHdr(COL_SEH_POWDER, "Seharusnya", "Jumlah APAR Powder", COLOR.blue50, COLOR.blue800, COL_SEH_POWDER + 1);
  groupHdr(COL_TER_POWDER, "Terlihat", "Jumlah APAR Powder", COLOR.emerald50, COLOR.emerald800, COL_TER_POWDER + 1);
  groupHdr(COL_SEH_CO2, "Seharusnya", "Jumlah APAR CO2", COLOR.blue50, COLOR.blue800);
  groupHdr(COL_TER_CO2, "Terlihat", "Jumlah APAR CO2", COLOR.emerald50, COLOR.emerald800);
  groupHdr(COL_TOTAL_APAR, "Seharusnya", "Total APAR", COLOR.blue50, COLOR.blue800);
  questions.forEach((q, i) => {
    const pal = Q_PALETTE[i % Q_PALETTE.length];
    put(ws, HR, COL_Q0 + i, q.label, {
      ...hdrBase,
      fill: pal.bg,
      font: { bold: true, size: 10, color: { argb: pal.text } },
    });
  });
  groupHdr(COL_PATUH, "Per Baris", "Patuh", COLOR.green50, COLOR.green800, undefined, COLOR.green200);
  groupHdr(COL_TDK, "Per Baris", "Tdk Patuh", COLOR.red50, COLOR.red800, undefined, COLOR.red200);
  groupHdr(COL_PCT, "Per Baris", "Total %", COLOR.indigo100, COLOR.indigo800, undefined, COLOR.indigo200);
  plainHdr(COL_TGL_PEMELIHARAAN, "Tgl. Pemeliharaan Terakhir");
  plainHdr(COL_KET, "Keterangan");
  plainHdr(COL_FOTO, "Foto");
  ws.getRow(HR).height = 38;
  ws.views = [{ state: "frozen", xSplit: COL_KE, ySplit: HR }];

  let r = HR + 1;

  // ── Helper sel jawaban pertanyaan ──────────────────────────────────────────
  const writeAnswerCell = (
    col: number,
    qIdx: number,
    ans: string,
    total: number,
    compliant: number | null
  ): void => {
    const pal = Q_PALETTE[qIdx % Q_PALETTE.length];
    const base: CellStyle = {
      fill: pal.bg,
      align: { horizontal: "center", vertical: "middle" },
      font: { bold: true, color: { argb: COLOR.emerald600 } },
    };
    if (ans === "Ya") {
      put(ws, r, col, total, base);
    } else if (ans === "Tidak" && compliant !== null) {
      const kurang = compliant < total;
      put(ws, r, col, compliant, {
        ...base,
        fill: kurang ? COLOR.red50 : pal.bg,
        font: { bold: true, color: { argb: kurang ? COLOR.red600 : COLOR.emerald600 } },
      });
    } else if (ans === "N/A") {
      put(ws, r, col, "N/A", { ...base, fill: COLOR.gray100, font: { bold: true, size: 9, color: { argb: COLOR.gray600 } } });
    } else if (ans === "Setengah") {
      put(ws, r, col, "Kurang Baik", { ...base, fill: COLOR.amber100, font: { bold: true, size: 9, color: { argb: COLOR.amber800 } } });
    } else if (ans === "TidakAda") {
      put(ws, r, col, "Tidak Ada", { ...base, fill: COLOR.amber100, font: { bold: true, size: 9, color: { argb: COLOR.amber800 } } });
    } else if (ans === "Tidak") {
      put(ws, r, col, "Tidak", { ...base, fill: COLOR.red100, font: { bold: true, size: 9, color: { argb: COLOR.red800 } } });
    } else {
      put(ws, r, col, "-", { ...base, font: { bold: true, color: { argb: COLOR.gray400 } } });
    }
  };

  const writePhoto = (url: string, extra: CellStyle = {}): void => {
    let isValid = false;
    if (url && typeof url === "string") {
      try {
        const parsed = new URL(url.trim());
        if (parsed.protocol === "http:" || parsed.protocol === "https:") isValid = true;
      } catch (e) {}
    }
    
    if (isValid) {
      put(ws, r, COL_FOTO, { text: "📷 Lihat Foto", hyperlink: url }, {
        ...extra,
        font: { size: 10, underline: true, color: { argb: COLOR.link } },
        align: { horizontal: "left", vertical: "middle" },
      });
    } else if (url) {
      put(ws, r, COL_FOTO, url, { ...extra, align: { horizontal: "left", vertical: "middle", wrapText: true } });
    } else {
      put(ws, r, COL_FOTO, "-", { ...extra, align: { horizontal: "center", vertical: "middle" }, font: { color: { argb: COLOR.gray500 } } });
    }
  };

  // ═══ BARIS APAR DALAM GEDUNG ═══════════════════════════════════════════════
  dalamRows.forEach((sub: any, idx: number) => {
    const baseTxt: CellStyle = { font: { color: { argb: COLOR.gray600 } } };
    const centerTxt: CellStyle = { ...baseTxt, align: { horizontal: "center", vertical: "middle" } };

    put(ws, r, COL_NO, idx + 1, { ...centerTxt, font: { color: { argb: COLOR.gray500 } } });
    put(ws, r, COL_TGL, formatTimestamp(sub.row.tanggalPemantauan || sub.row.timestamp) || "-", baseTxt);
    put(ws, r, COL_PETUGAS, sub.row.namaPetugas || "-", { font: { bold: true, color: { argb: COLOR.gray800 } } });
    put(ws, r, COL_RUANG, sub.location || "-", { font: { color: { argb: COLOR.gray800 } }, align: { wrapText: true, vertical: "middle" } });
    put(ws, r, COL_KE, sub.row.patroliKe || "-", centerTxt);

    // Seharusnya vs Terlihat (Powder → merge 2 kolom, CO2 → 1 kolom)
    const mRow = getMasterRow(sub.location);
    const writeSehTer = (label: string, colSeh: number, colTer: number, span?: number) => {
      const terStr = getExtra(sub, label);
      let sehStr = mRow && mRow[label] !== undefined && mRow[label] !== "" ? String(mRow[label]) : "-";
      const numTer = parseInt(terStr, 10) || 0;
      let numSeh = parseInt(sehStr, 10) || 0;
      // Fallback ke "Terlihat" bila master 0/kosong (sama dengan dashboard)
      if (numSeh === 0 || sehStr === "-") {
        sehStr = numTer.toString();
        numSeh = numTer;
      }
      const kurang = numTer < numSeh;
      put(ws, r, colSeh, numOrText(sehStr), {
        fill: COLOR.blue50,
        align: { horizontal: "center", vertical: "middle" },
        font: { bold: true, color: { argb: COLOR.blue700 } },
      }, span ? colSeh + span - 1 : undefined);
      put(ws, r, colTer, numOrText(terStr), {
        fill: kurang ? COLOR.red50 : COLOR.emerald50,
        align: { horizontal: "center", vertical: "middle" },
        font: { bold: true, color: { argb: kurang ? COLOR.red700 : COLOR.emerald700 } },
      }, span ? colTer + span - 1 : undefined);
    };
    writeSehTer("Jumlah APAR Powder", COL_SEH_POWDER, COL_TER_POWDER, 2);
    writeSehTer("Jumlah APAR CO2", COL_SEH_CO2, COL_TER_CO2);

    // Total APAR Seharusnya
    const totalApar = totalAparDalam(sub);
    put(ws, r, COL_TOTAL_APAR, totalApar, {
      fill: COLOR.blue50,
      align: { horizontal: "center", vertical: "middle" },
      font: { bold: true, color: { argb: COLOR.blue700 } },
    });

    // Jawaban per pertanyaan + akumulasi Patuh / Tdk Patuh
    let sumCompliant = 0;
    let maxCompliant = 0;
    questions.forEach((q, qi) => {
      const ans = getAnswer(sub, q.sheetHeader);
      let compliant: number | null = null;
      if (ans === "Tidak") {
        const nonCompliant = nonCompliantFromDesc(sub.description || "", q.label, totalApar);
        compliant = Math.max(0, totalApar - nonCompliant);
      }
      writeAnswerCell(COL_Q0 + qi, qi, ans, totalApar, compliant);

      if (ans === "N/A" || ans === "") return;
      maxCompliant += totalApar;
      if (ans === "Ya") sumCompliant += totalApar;
      else if (ans === "Tidak") sumCompliant += compliant ?? 0;
    });

    put(ws, r, COL_PATUH, maxCompliant > 0 ? sumCompliant : "-", {
      fill: COLOR.green50,
      align: { horizontal: "center", vertical: "middle" },
      font: { bold: true, color: { argb: COLOR.green700 } },
      border: COLOR.green200,
    });
    put(ws, r, COL_TDK, maxCompliant > 0 ? maxCompliant - sumCompliant : "-", {
      fill: COLOR.red50,
      align: { horizontal: "center", vertical: "middle" },
      font: { bold: true, color: { argb: COLOR.red700 } },
      border: COLOR.red200,
    });
    put(ws, r, COL_PCT, maxCompliant === 0 ? "-" : fmtPct2(sumCompliant, maxCompliant), {
      fill: COLOR.indigo100,
      align: { horizontal: "center", vertical: "middle" },
      font: { bold: true, color: { argb: COLOR.indigo700 } },
      border: COLOR.indigo200,
    });

    put(ws, r, COL_TGL_PEMELIHARAAN, getExtra(sub, "Tgl. Pemeliharaan Terakhir"), centerTxt);

    // Keterangan = [tags] + deskripsi (sama dengan dashboard)
    const tagPrefix = sub.tags && sub.tags.length > 0 ? `[${sub.tags.join(", ")}] ` : "";
    const ket = `${tagPrefix}${sub.description || ""}`.trim() || "-";
    put(ws, r, COL_KET, ket, { ...baseTxt, align: { wrapText: true, vertical: "top" } });
    writePhoto(sub.photoUrl);

    r++;
  });

  // ═══ BARIS APAR LUAR GEDUNG ════════════════════════════════════════════════
  if (luarRows.length > 0) {
    // Baris pemisah (sama dengan dashboard: judul + label kolom 6kg/25kg)
    const sepStyle: CellStyle = { fill: COLOR.amber100, border: COLOR.amber300 };
    put(ws, r, 1, `🌳 APAR LUAR GEDUNG — ${luarRows.length} LOKASI`, {
      ...sepStyle,
      font: { bold: true, size: 10, color: { argb: COLOR.amber800 } },
      align: { horizontal: "right", vertical: "middle" },
    }, COL_KE);
    const sepLabel = (col: number, text: string, bg: string, fg: string) =>
      put(ws, r, col, text, {
        fill: bg,
        border: COLOR.amber300,
        font: { bold: true, size: 8, color: { argb: fg } },
        align: { horizontal: "center", vertical: "middle", wrapText: true },
      });
    sepLabel(6, "6KG (SEHARUSNYA)", COLOR.blue50, COLOR.blue800);
    sepLabel(7, "25KG (SEHARUSNYA)", COLOR.blue50, COLOR.blue800);
    sepLabel(8, "6KG (TERLIHAT)", COLOR.emerald50, COLOR.emerald800);
    sepLabel(9, "25KG (TERLIHAT)", COLOR.emerald50, COLOR.emerald800);
    ws.getRow(r).height = 26;
    r++;

    luarRows.forEach((sub: any, idx: number) => {
      const rowBg = COLOR.amber50;
      const edge = COLOR.amber200;
      const baseTxt: CellStyle = { fill: rowBg, border: edge, font: { color: { argb: COLOR.gray600 } } };
      const centerTxt: CellStyle = { ...baseTxt, align: { horizontal: "center", vertical: "middle" } };
      const mRow = getMasterRow(sub.location);

      put(ws, r, COL_NO, dalamRows.length + idx + 1, { ...centerTxt, font: { bold: true, color: { argb: COLOR.amber700 } } });
      put(ws, r, COL_TGL, formatTimestamp(sub.row.tanggalPemantauan || sub.row.timestamp) || "-", baseTxt);
      put(ws, r, COL_PETUGAS, sub.row.namaPetugas || "-", { ...baseTxt, font: { bold: true, color: { argb: COLOR.gray800 } } });
      put(ws, r, COL_RUANG, `[LUAR] ${sub.location || "-"}`, {
        ...baseTxt,
        font: { bold: true, color: { argb: COLOR.amber700 } },
        align: { wrapText: true, vertical: "middle" },
      });
      put(ws, r, COL_KE, sub.row.patroliKe || "-", centerTxt);

      // Powder: 6kg & 25kg → Seharusnya (kol 6-7) | Terlihat (kol 8-9)
      const terStr6 = getExtra(sub, "Jumlah APAR Powder");
      const sehStr6 = mRow && mRow["Jumlah APAR Powder 6 kg"] !== undefined ? String(mRow["Jumlah APAR Powder 6 kg"]) : terStr6;
      const kurang6 = (parseInt(terStr6, 10) || 0) < (parseInt(sehStr6, 10) || 0);

      const terStr25 = getExtra(sub, "Jumlah APAR Powder 25 kg");
      const sehStr25 = mRow && mRow["Jumlah APAR Powder 25 kg"] !== undefined ? String(mRow["Jumlah APAR Powder 25 kg"]) : terStr25;
      const kurang25 = (parseInt(terStr25, 10) || 0) < (parseInt(sehStr25, 10) || 0);

      const sehStyle: CellStyle = {
        fill: COLOR.blue50, border: edge,
        align: { horizontal: "center", vertical: "middle" },
        font: { bold: true, color: { argb: COLOR.blue700 } },
      };
      const terStyle = (kurang: boolean): CellStyle => ({
        fill: kurang ? COLOR.red50 : COLOR.emerald50, border: edge,
        align: { horizontal: "center", vertical: "middle" },
        font: { bold: true, color: { argb: kurang ? COLOR.red700 : COLOR.emerald700 } },
      });
      put(ws, r, 6, numOrText(sehStr6), sehStyle);
      put(ws, r, 7, numOrText(sehStr25), sehStyle);
      put(ws, r, 8, numOrText(terStr6), terStyle(kurang6));
      put(ws, r, 9, numOrText(terStr25), terStyle(kurang25));

      // CO2
      {
        const terStr = getExtra(sub, "Jumlah APAR CO2");
        let sehStr = mRow && mRow["Jumlah APAR CO2"] !== undefined && mRow["Jumlah APAR CO2"] !== "" ? String(mRow["Jumlah APAR CO2"]) : "-";
        const numTer = parseInt(terStr, 10) || 0;
        let numSeh = parseInt(sehStr, 10) || 0;
        if (numSeh === 0 || sehStr === "-") {
          sehStr = numTer.toString();
          numSeh = numTer;
        }
        put(ws, r, COL_SEH_CO2, numOrText(sehStr), sehStyle);
        put(ws, r, COL_TER_CO2, numOrText(terStr), terStyle(numTer < numSeh));
      }

      // Total APAR (6kg + 25kg + CO2)
      const totalLuar = totalAparLuarOf(sub);
      put(ws, r, COL_TOTAL_APAR, totalLuar, { ...sehStyle });

      // Jawaban + Patuh/Tidak (Tidak Patuh Luar = jumlah APAR bermasalah)
      let aparPatuh = 0;
      let aparTidak = 0;
      questions.forEach((q, qi) => {
        const ans: string = sub.answers?.find((a: any) => a.question.label === q.label)?.jawaban ?? "";
        let compliant: number | null = null;
        if (ans === "Ya") {
          aparPatuh += totalLuar;
        } else if (ans === "Tidak") {
          const nonCompliant = nonCompliantFromDesc(sub.description || "", q.label, totalLuar);
          compliant = Math.max(0, totalLuar - nonCompliant);
          aparPatuh += compliant;
          aparTidak += nonCompliant;
        }
        writeAnswerCell(COL_Q0 + qi, qi, ans, totalLuar, compliant);
      });
      const rowPct = aparPatuh + aparTidak === 0 ? "-" : Number(((aparPatuh / (aparPatuh + aparTidak)) * 100).toFixed(1)) + "%";

      put(ws, r, COL_PATUH, aparPatuh, {
        fill: COLOR.green50, border: COLOR.green200,
        align: { horizontal: "center", vertical: "middle" },
        font: { bold: true, color: { argb: COLOR.green700 } },
      });
      put(ws, r, COL_TDK, aparTidak, {
        fill: COLOR.red50, border: COLOR.red200,
        align: { horizontal: "center", vertical: "middle" },
        font: { bold: true, color: { argb: COLOR.red700 } },
      });
      put(ws, r, COL_PCT, rowPct, {
        fill: COLOR.indigo100, border: COLOR.indigo200,
        align: { horizontal: "center", vertical: "middle" },
        font: { bold: true, color: { argb: COLOR.indigo700 } },
      });

      const tgl = sub.extras?.find((e: any) => e.label === "Tgl. Pemeliharaan Terakhir")?.value;
      put(ws, r, COL_TGL_PEMELIHARAAN, tgl ? formatMaybeDate(tgl) : "-", centerTxt);
      put(ws, r, COL_KET, sub.description || "-", { ...baseTxt, align: { wrapText: true, vertical: "top" } });
      writePhoto(sub.photoUrl, { fill: rowBg, border: edge });

      r++;
    });
  }

  // ═══ TIDAK ADA DATA ════════════════════════════════════════════════════════
  if (dalamRows.length === 0 && luarRows.length === 0) {
    put(ws, r, 1, "Tidak ada data untuk periode ini", {
      font: { italic: true, color: { argb: COLOR.gray500 } },
      align: { horizontal: "center", vertical: "middle" },
      border: COLOR.white,
    }, TOTAL_COLS);
    return;
  }

  // ═══ FOOTER: TOTAL KEPATUHAN (sama dengan <tfoot> dashboard) ═══════════════
  const FT = r;
  const ftBase: CellStyle = {
    fill: COLOR.red50,
    border: COLOR.red200,
    borderTop: COLOR.red600,
    align: { horizontal: "center", vertical: "middle", wrapText: true },
    font: { bold: true, color: { argb: COLOR.red800 } },
  };

  put(ws, FT, 1, `TOTAL KEPATUHAN: ${aggregate.totalPct ?? 0}%`, {
    ...ftBase,
    align: { horizontal: "right", vertical: "middle" },
    font: { bold: true, size: 11, color: { argb: COLOR.red800 } },
  }, COL_KE);

  // Jumlah APAR Powder / CO2 (hanya baris Dalam Gedung — seperti dashboard)
  const sumMaster = (label: string) =>
    dalamRows.reduce((acc: number, s: any) => acc + toInt(getMasterRow(s.location)?.[label]), 0);
  const sumTerlihat = (label: string) =>
    dalamRows.reduce((acc: number, s: any) => acc + toInt(getExtra(s, label)), 0);

  put(ws, FT, COL_SEH_POWDER, sumMaster("Jumlah APAR Powder"), ftBase, COL_SEH_POWDER + 1);
  put(ws, FT, COL_TER_POWDER, sumTerlihat("Jumlah APAR Powder"), ftBase, COL_TER_POWDER + 1);
  put(ws, FT, COL_SEH_CO2, sumMaster("Jumlah APAR CO2"), ftBase);
  put(ws, FT, COL_TER_CO2, sumTerlihat("Jumlah APAR CO2"), ftBase);

  // Total APAR = Dalam Gedung + Luar Gedung
  const sumDalamApar = dalamRows.reduce((acc: number, s: any) => acc + totalAparDalamFooter(s), 0);
  const sumLuarApar = luarRows.reduce((acc: number, s: any) => {
    const mRow = getMasterRow(s.location);
    if (mRow) {
      return acc + toInt(mRow["Jumlah APAR Powder 6 kg"]) + toInt(mRow["Jumlah APAR Powder 25 kg"]) + toInt(mRow["Jumlah APAR CO2"]);
    }
    return acc + toInt(getExtraExact(s, "Jumlah APAR Powder")) + toInt(getExtraExact(s, "Jumlah APAR Powder 25 kg")) + toInt(getExtraExact(s, "Jumlah APAR CO2"));
  }, 0);
  put(ws, FT, COL_TOTAL_APAR, sumDalamApar + sumLuarApar, {
    ...ftBase,
    fill: COLOR.blue50,
    font: { bold: true, color: { argb: COLOR.blue700 } },
  });

  // Rekap per pertanyaan: Ya / Tidak (jumlah + persen) dari hasil agregasi (Dalam + Luar)
  questions.forEach((q, qi) => {
    const qr = aggregate.questionResults.find((res) => res.question.sheetHeader === q.sheetHeader);
    if (!qr) {
      put(ws, FT, COL_Q0 + qi, "-", ftBase);
      return;
    }
    const total = qr.countYa + qr.countTidak;
    if (total <= 0) {
      put(ws, FT, COL_Q0 + qi, "-", { ...ftBase, font: { bold: true, color: { argb: COLOR.gray400 } } });
      return;
    }
    const yaPct = Number(((qr.countYa / total) * 100).toFixed(2));
    const tidakPct = Number(((qr.countTidak / total) * 100).toFixed(2));
    put(ws, FT, COL_Q0 + qi, {
      richText: [
        { text: `Ya: ${qr.countYa} (${yaPct}%)\n`, font: { bold: true, size: 10, color: { argb: COLOR.green700 }, name: "Calibri" } },
        { text: `Tidak: ${qr.countTidak} (${tidakPct}%)`, font: { bold: true, size: 10, color: { argb: COLOR.red700 }, name: "Calibri" } },
      ],
    }, ftBase);
  });

  // Rekap Patuh / Tdk Patuh / Total % (Dalam Gedung + Luar Gedung — konsisten dengan rekap per pertanyaan)
  let allCompliant = 0;
  let allExpected = 0;
  dalamRows.forEach((sub: any) => {
    const totalApar = totalAparDalamFooter(sub);
    questions.forEach((q) => {
      const ans = getAnswer(sub, q.sheetHeader);
      if (ans === "N/A" || ans === "") return;
      allExpected += totalApar;
      if (ans === "Ya") allCompliant += totalApar;
      else if (ans === "Tidak") {
        allCompliant += Math.max(0, totalApar - nonCompliantFromDesc(sub.description || "", q.label, totalApar));
      }
    });
  });
  luarRows.forEach((sub: any) => {
    const totalLuar = totalAparLuarOf(sub);
    questions.forEach((q) => {
      const ans: string = sub.answers?.find((a: any) => a.question.label === q.label)?.jawaban ?? "";
      if (ans === "N/A" || ans === "") return;
      allExpected += totalLuar;
      if (ans === "Ya") allCompliant += totalLuar;
      else if (ans === "Tidak") {
        allCompliant += Math.max(0, totalLuar - nonCompliantFromDesc(sub.description || "", q.label, totalLuar));
      }
    });
  });
  const allPct = allExpected > 0 ? Number(((allCompliant / allExpected) * 100).toFixed(2)) : null;

  put(ws, FT, COL_PATUH, allPct !== null ? `${allCompliant}\n${allPct}%` : `${allCompliant}`, {
    ...ftBase, fill: COLOR.green100, border: COLOR.green200, borderTop: COLOR.red600,
    font: { bold: true, color: { argb: COLOR.green800 } },
  });
  put(ws, FT, COL_TDK, allPct !== null ? `${allExpected - allCompliant}\n${Number((100 - allPct).toFixed(2))}%` : `${allExpected - allCompliant}`, {
    ...ftBase, fill: COLOR.red100,
  });
  put(ws, FT, COL_PCT, allPct !== null ? `${allPct}%` : "-", {
    ...ftBase, fill: COLOR.indigo100, border: COLOR.indigo200, borderTop: COLOR.red600,
    font: { bold: true, color: { argb: COLOR.indigo800 } },
  });
  put(ws, FT, COL_TGL_PEMELIHARAAN, "-", ftBase);
  put(ws, FT, COL_KET, "", ftBase);
  put(ws, FT, COL_FOTO, "", ftBase);
  ws.getRow(FT).height = 48;
  r = FT + 1;

  // ═══ CATATAN PERHITUNGAN ═══════════════════════════════════════════════════
  r += 1;
  const notes = [
    "Catatan perhitungan:",
    "• Nilai pada kolom pertanyaan = jumlah APAR yang PATUH. Jawaban \"Ya\" = seluruh APAR (Total APAR Seharusnya); jawaban \"Tidak\" = Total APAR − APAR bermasalah (TJ = Terjangkau, RS = Rambu & SOP, KP = Kartu Pemeliharaan, dari kolom Keterangan).",
    "• Per Baris: Patuh = Σ nilai pertanyaan; Tdk Patuh = (Total APAR × jumlah pertanyaan terjawab) − Patuh; Total % = Patuh ÷ (Patuh + Tdk Patuh).",
    "• Total APAR Seharusnya diambil dari Master Data (Powder + CO2; Luar Gedung = Powder 6 kg + 25 kg + CO2). Bila master kosong, dipakai jumlah \"Terlihat\" dari form.",
    "• Total Kepatuhan = rata-rata % kepatuhan seluruh pertanyaan (Dalam Gedung + Luar Gedung). N/A dan jawaban kosong tidak dihitung.",
  ];
  notes.forEach((text, i) => {
    put(ws, r, 1, text, {
      font: { size: 9, italic: i > 0, bold: i === 0, color: { argb: COLOR.gray600 } },
      align: { horizontal: "left", vertical: "middle", wrapText: true },
      border: COLOR.white,
    }, COL_Q0 + nQ + 2);
    if (i > 0) ws.getRow(r).height = 26;
    r++;
  });

  // ═══ CHART KEPATUHAN PER PERTANYAAN ════════════════════════════════════════
  const valid = aggregate.questionResults.filter((q) => q.pct !== null);
  if (valid.length > 0) {
    const chartConfig = {
      type: "horizontalBar",
      data: {
        labels: valid.map((q) => (q.question.label.length > 40 ? q.question.label.substring(0, 40) + "..." : q.question.label)),
        datasets: [{
          label: "Kepatuhan (%)",
          data: valid.map((q) => q.pct ?? 0),
          backgroundColor: valid.map((q) => ((q.pct ?? 0) >= 90 ? "#199e70" : "#d03b3b")),
        }],
      },
      options: {
        layout: { padding: { right: 40 } },
        legend: { display: false },
        title: { display: true, text: "Kepatuhan Per Pertanyaan", fontSize: 16 },
        scales: { xAxes: [{ ticks: { min: 0, max: 100, stepSize: 20 } }] },
        plugins: {
          datalabels: {
            anchor: "end", align: "right", color: "black", font: { weight: "bold" },
            formatter: (value: number) => value + "%",
          },
        },
      },
    };
    try {
      const height = Math.max(500, valid.length * 40 + 100);
      const url = `https://quickchart.io/chart?w=800&h=${height}&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const imageId = workbook.addImage({ buffer: (await res.arrayBuffer()) as any, extension: "png" });
        ws.addImage(imageId, { tl: { col: 1, row: r + 1 }, br: { col: 8, row: r + 18 } } as any);
      }
    } catch (e) {
      console.warn("Gagal mengambil chart APAR dari QuickChart", e);
    }
  }
}
