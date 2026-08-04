// ─────────────────────────────────────────────────────────────────────────────
// lib/analytics.ts — Aggregation & Percentage Calculation
// Dashboard Patroli Kesling & K3 RSOMH
// ─────────────────────────────────────────────────────────────────────────────
//
// LOGIKA PERSENTASE (sesuai spesifikasi):
//   % per pertanyaan = Ya / (Ya + Tidak) × 100  — N/A & kosong dikecualikan
//   % total topik = rata-rata dari semua % per pertanyaan
//   (bukan menghitung ulang total Ya/Tidak gabungan, tapi rata-rata sederhana
//    supaya tiap pertanyaan berbobot sama walau N/A-nya beda)
// ─────────────────────────────────────────────────────────────────────────────

import type { ModuleDef, QuestionDef } from "./modules";
import {
  type PatroliRow,
  type Jawaban,
  getAnswer,
  getField,
  getDisplayLocation,
} from "./google-sheets";

// ─── Per-Question Result ──────────────────────────────────────────────────────

export interface QuestionResult {
  question: QuestionDef;
  /** Short label for display */
  label: string;
  /** % compliance (Ya / (Ya + Tidak) × 100), or null if no scored answers */
  pct: number | null;
  countYa: number;
  countTidak: number;
  countNA: number;
  countEmpty: number;
  /** Target compliance percentage from Master Topik */
  targetPct?: number;
  /** Description/Narasi from Master Pertanyaan */
  description?: string;
}

// ─── Per-Submission Result ────────────────────────────────────────────────────

export interface SubmissionResult {
  row: PatroliRow;
  /** Display location (ruangan / lokasi PCRA / lokasi luar) */
  location: string;
  /** Per-question answers for this submission */
  answers: Array<{
    question: QuestionDef;
    jawaban: Jawaban;
  }>;
  /** Combined findings description */
  description: string;
  /** Photo URL (may be empty) */
  photoUrl: string;
  /** Warning tags (e.g. APD non-compliant units) */
  tags: string[];
  /** Extra fields (counts, dates) */
  extras: Array<{ label: string; value: string; raw: string }>;
}

// ─── Module Aggregate Result ──────────────────────────────────────────────────

export interface ModuleAggregateResult {
  module: ModuleDef;
  /** % per question (aggregate over all filtered rows) */
  questionResults: QuestionResult[];
  /** % total topik = average of all questionResults.pct (ignoring nulls) */
  totalPct: number | null;
  /** All individual submission rows */
  submissions: SubmissionResult[];
  /** Trend vs previous month (positive = better, negative = worse) */
  trend?: number | null;
}

// ─── Scope filter: which rows belong to this module? ─────────────────────────

export function rowMatchesModule(row: PatroliRow, module: ModuleDef): boolean {
  const jenis = row.jenisPemantauan;
  const freq = row.frekuensiPemantauan;

  switch (module.scope) {
    case "DALAM_BULANAN":
      return jenis === "Dalam Gedung" && freq === "Bulanan";
    case "DALAM_HARIAN":
      return jenis === "Dalam Gedung" && freq === "Harian";
    case "PCRA":
      return jenis === "PCRA";
    case "LUAR_GEDUNG":
      return jenis === "Luar Gedung";
    case "B3":
      // Actual Jenis Pemantauan value from the form (has double space)
      return (
        jenis === "Keamanan  Bahan Beracun dan Berbahaya (B3) dan Limbah B3" ||
        jenis === "B3" ||
        jenis.toLowerCase().includes("b3")
      );
    default:
      return false;
  }
}

// ─── Perlu Perhatian (Needs Attention) ───────────────────────────────────────

export interface NeedsAttentionItem {
  location: string;
  questionLabel: string;
  timestamp: string;
}

export interface NeedsAttentionGroup {
  moduleSlug: string;
  moduleTitle: string;
  moduleIcon: string;
  items: NeedsAttentionItem[];
}

export function getNeedsAttention(
  allModules: ModuleDef[],
  rows: PatroliRow[]
): NeedsAttentionGroup[] {
  const groups: NeedsAttentionGroup[] = [];

  for (const mod of allModules) {
    if (mod.logOnly) continue;
    const relevant = rows.filter((r) => rowMatchesModule(r, mod));
    if (relevant.length === 0) continue;

    const items: NeedsAttentionItem[] = [];

    for (const row of relevant) {
      for (const q of mod.questions) {
        const ans = getAnswer(row, q.sheetHeader);
        if (ans === "Tidak" || ans === "Setengah") {
          let qLabel = q.label;
          if (!qLabel) {
            const match = q.sheetHeader.match(/\[(.*?)\]/);
            qLabel = match ? match[1] : q.sheetHeader;
          }
          items.push({
            location: getDisplayLocation(row),
            questionLabel: qLabel,
            timestamp: row.timestamp || row.tanggalPemantauan,
          });
        }
      }
    }

    if (items.length > 0) {
      items.sort((a, b) => {
        const da = new Date(a.timestamp.replace(/^(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2"));
        const db = new Date(b.timestamp.replace(/^(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2"));
        return db.getTime() - da.getTime();
      });

      groups.push({
        moduleSlug: mod.slug,
        moduleTitle: mod.title,
        moduleIcon: mod.icon,
        items,
      });
    }
  }

  // Sort groups by number of items descending (top 3 most issues)
  groups.sort((a, b) => b.items.length - a.items.length);

  return groups;
}

// ─── Main Aggregation ─────────────────────────────────────────────────────────

/**
 * Compute per-question % and overall % for a module given filtered rows.
 */
export function computeModuleAggregate(
  module: ModuleDef,
  rows: PatroliRow[],
  masterData: any[] = [],
  masterTopik: any[] = [],
  masterPertanyaan: any[] = []
): ModuleAggregateResult {
  // Precompute constants used inside loops
  const masterProfesi = masterData.filter(m => m.Ruangan?.startsWith('**')).map(m => m.Ruangan?.substring(2).trim().toLowerCase());

  // Filter rows relevant to this module
  const relevantRows = rows.filter((r) => rowMatchesModule(r, module));

  // Sort ascending by date to accurately recalculate Patroli Ke-
  relevantRows.sort((a, b) => {
    const da = new Date(a.tanggalPemantauan || a.timestamp).getTime();
    const db = new Date(b.tanggalPemantauan || b.timestamp).getTime();
    return da - db;
  });

  // Recalculate Patroli Ke- based on user specs (per-month per-location, but PCRA is per-month global)
  const patrolCounts: Record<string, number> = {};
  for (const row of relevantRows) {
    const key = module.slug === "pcra" ? "PCRA_GLOBAL" : getDisplayLocation(row);
    patrolCounts[key] = (patrolCounts[key] || 0) + 1;
    row.patroliKe = patrolCounts[key];
  }

  // Per-question aggregation
  const questionResults: QuestionResult[] = module.questions.map((q) => {
    let ya = 0;
    let tidak = 0;
    let na = 0;
    let empty = 0;

    for (const row of relevantRows) {
      const ans = getAnswer(row, q.sheetHeader);
      
      if (module.slug === "apar" || module.slug === "luar-gedung") {
        // Master Data tells us "Total APAR Seharusnya" for this location
        const mRow = masterData.find(m => m.Ruangan?.trim().toLowerCase() === row.ruangan?.trim().toLowerCase());
        let totalApar = 0;
        if (mRow) {
          if (module.slug === "apar") {
            const totalAparPowder = parseInt(mRow["Jumlah APAR Powder"]) || 0;
            const totalAparCo2 = parseInt(mRow["Jumlah APAR CO2"]) || 0;
            totalApar = totalAparPowder + totalAparCo2;
          } else {
            const totalAparPowder6 = parseInt(mRow["Jumlah APAR Powder 6 kg"]) || 0;
            const totalAparPowder25 = parseInt(mRow["Jumlah APAR Powder 25 kg"]) || 0;
            const totalAparCo2 = parseInt(mRow["Jumlah APAR CO2"]) || 0;
            totalApar = totalAparPowder6 + totalAparPowder25 + totalAparCo2;
          }
        }
        
        // Fallback to Terlihat (form input) if Master Data is missing OR if the counts are 0 in Master Data
        if (totalApar === 0) {
          const getE = (l: string) => {
            const ext = module.extraFields?.find(ext => ext.label === l);
            if (!ext) return 0;
            const val = getField(row, ext.sheetHeader);
            return parseInt(val || "0", 10) || 0;
          };
          
          if (module.slug === "apar") {
            totalApar = getE("Jumlah APAR Powder") + getE("Jumlah APAR CO2");
          } else if (module.slug === "luar-gedung") {
            totalApar = getE("Jumlah APAR Powder 6 kg") + getE("Jumlah APAR Powder 25 kg") + getE("Jumlah APAR CO2");
          }
        }
        
        // Exclude N/A or empty
        if (ans === "N/A") {
          na += totalApar;
        } else if (ans === "") {
          empty += totalApar;
        } else if (ans === "Ya") {
          ya += totalApar; // all APARs are compliant
        } else if (ans === "Tidak") {
          let nonCompliantCount = totalApar;
          const desc = module.descriptionHeader ? getField(row, module.descriptionHeader) : "";
          
          if (q.label.includes("Terjangkau")) {
            const match = desc.match(/TJ\s*[:=]\s*(\d+)/i);
            if (match) nonCompliantCount = parseInt(match[1]);
          } else if (q.label.includes("Rambu")) {
            const match = desc.match(/RS\s*[:=]\s*(\d+)/i);
            if (match) nonCompliantCount = parseInt(match[1]);
          } else if (q.label.includes("Kartu")) {
            const match = desc.match(/KP\s*[:=]\s*(\d+)/i);
            if (match) nonCompliantCount = parseInt(match[1]);
          }
          
          const compliantCount = Math.max(0, totalApar - nonCompliantCount);
          ya += compliantCount;
          tidak += (totalApar - compliantCount);
        }
      } else if (module.slug === "apd") {
        const mRow = masterData.find(m => m.Ruangan?.trim().toLowerCase() === row.ruangan?.trim().toLowerCase());
        const totalKaryawan = mRow ? (parseInt(mRow["Jumlah Karyawan"]) || 0) : 0;
        
        if (ans === "N/A") {
          na += totalKaryawan;
        } else if (ans === "") {
          empty += totalKaryawan;
        } else if (ans === "Ya") {
          ya += totalKaryawan;
        } else if (ans === "Tidak") {
          let nonCompliantCount = 0;
          let profViolations = 0;
          
          for (const key of Object.keys(row.raw)) {
            if (key.includes("APD - Unit/Profesi yang tidak patuh")) {
              const val = row.raw[key];
              if (val && typeof val === "string" && val.trim() !== "") {
                const match = key.match(/\[(\d+|lebih)\]/i);
                let count = 1;
                if (match) {
                  const numStr = match[1].toLowerCase();
                  count = numStr === "lebih" ? 5 : parseInt(numStr, 10);
                  if (isNaN(count)) count = 1;
                }
                const professions = val.split(",").map((t) => t.trim()).filter(Boolean);
                
                for (const p of professions) {
                   nonCompliantCount += count;
                   if (masterProfesi.includes(p.toLowerCase())) {
                       profViolations += count;
                   }
                }
              }
            }
          }
          
          nonCompliantCount = Math.max(0, nonCompliantCount - profViolations);
          if (nonCompliantCount === 0 && profViolations === 0) nonCompliantCount = totalKaryawan; // Only assume full violation if no prof info
          
          const compliantCount = Math.max(0, totalKaryawan - nonCompliantCount);
          ya += compliantCount;
          tidak += nonCompliantCount;
        }
      } else if (module.slug === "b3" && (q.label === "Penyimpanan B3" || q.label === "Ketersediaan SDS")) {
        let expectedCount = 1;
        const mRow = masterData.find(m => m.Ruangan?.trim().toLowerCase() === row.ruangan?.trim().toLowerCase());
        expectedCount = mRow ? (parseInt(mRow["Jumlah Lemari B3"]) || 0) : 0;
        if (expectedCount === 0) {
          const extHeader = module.extraFields?.find(ext => ext.label === "Jumlah Lemari B3")?.sheetHeader || "";
          expectedCount = parseInt(getField(row, extHeader) || "0", 10) || 0;
        }

        if (ans === "N/A") {
          na += expectedCount;
        } else if (ans === "") {
          empty += expectedCount;
        } else if (ans === "Ya") {
          ya += expectedCount; 
        } else if (ans === "Tidak") {
          let nonCompliantCount = expectedCount;
          if (module.badgeHeader) {
            const tagRaw = getField(row, module.badgeHeader);
            if (tagRaw) {
              const tags = tagRaw.split(",").map((t) => t.trim()).filter(Boolean);
              nonCompliantCount = tags.length > 0 ? tags.length : expectedCount;
            }
          }
          
          const compliantCount = Math.max(0, expectedCount - nonCompliantCount);
          ya += compliantCount;
          tidak += (expectedCount - compliantCount);
        }
      } else {
        if (ans === "Ya") ya++;
        else if (ans === "Setengah") {
          ya += 0.5;
          tidak += 0.5;
        }
        else if (ans === "Tidak") tidak++;
        else if (ans === "N/A") na++;
        else empty++;
      }
    }

    const denominator = ya + tidak; // exclude N/A and empty from denominator
    const pct = denominator === 0 ? null : Math.round((ya / denominator) * 100);

    // Look up target percentage from masterTopik
    let targetPct = 90;
    const topikRow = masterTopik.find(m => m.Topik?.trim().toLowerCase() === module.title.toLowerCase());
    if (topikRow && topikRow["Standar Minimum (%)"]) {
      targetPct = parseInt(String(topikRow["Standar Minimum (%)"]), 10) || 90;
    }

    // Look up description from masterPertanyaan
    let description = "";
    
    // Reproduce the same logic AppScript used to generate the default 'Pertanyaan' string
    let expectedPertanyaan = q.sheetHeader;
    const match = q.sheetHeader.match(/\[(.*?)\]/);
    if (match) {
      expectedPertanyaan = match[1];
    } else {
      const splitted = q.sheetHeader.split('-');
      if (splitted.length > 1) {
        expectedPertanyaan = splitted[1].trim();
      }
    }

    const pertRow = masterPertanyaan.find(
      m => m.Topik?.trim().toLowerCase() === module.title.toLowerCase() && 
           (m.Pertanyaan?.trim().toLowerCase() === expectedPertanyaan.toLowerCase() ||
            m.Pertanyaan?.trim().toLowerCase() === q.label.toLowerCase())
    );
    if (pertRow && pertRow.Deskripsi && pertRow.Deskripsi !== "-") {
      description = pertRow.Deskripsi;
    }

    return {
      question: q,
      label: q.label,
      pct,
      countYa: ya,
      countTidak: tidak,
      countNA: na,
      countEmpty: empty,
      targetPct,
      description
    };
  });

  // Total % = simple average of per-question % (only non-null ones)
  const validPcts = questionResults.filter((r) => r.pct !== null);
  const totalPct =
    validPcts.length === 0
      ? null
      : Math.round(
          validPcts.reduce((s, r) => s + r.pct!, 0) / validPcts.length
        );

  // Build per-submission results
  const submissions: SubmissionResult[] = relevantRows.map((row) => {
    const answers = module.questions.map((q) => ({
      question: q,
      jawaban: getAnswer(row, q.sheetHeader),
    }));

    const photoUrl = module.photoHeader
      ? getField(row, module.photoHeader)
      : "";

    const description = module.descriptionHeader
      ? getField(row, module.descriptionHeader)
      : "";

    const tags: string[] = [];
    if (module.badgeHeader) {
      const tagRaw = getField(row, module.badgeHeader);
      if (tagRaw) {
        tags.push(...tagRaw.split(",").map((t) => t.trim()).filter(Boolean));
      }
    }

    // Khusus untuk APD, ekstrak dari kolom grid [1], [2], dst.
    if (module.slug === "apd") {
      for (const key of Object.keys(row.raw)) {
        if (key.includes("APD - Unit/Profesi yang tidak patuh")) {
          const val = row.raw[key];
          if (val && typeof val === "string" && val.trim() !== "") {
            // Extract number from bracket, e.g., "[2]" -> 2. If "[lebih]", assume 5.
            const match = key.match(/\[(\d+|lebih)\]/i);
            let count = 1;
            if (match) {
              const numStr = match[1].toLowerCase();
              count = numStr === "lebih" ? 5 : parseInt(numStr, 10);
              if (isNaN(count)) count = 1;
            }

            const professions = val.split(",").map((t) => t.trim()).filter(Boolean);
            
            // Push each profession `count` times so ApdProfesiChart can count them correctly
            for (const p of professions) {
              for (let i = 0; i < count; i++) {
                tags.push(p);
              }
            }
          }
        }
      }
    }

    const extras = (module.extraFields ?? []).map((ef) => {
      const raw = getField(row, ef.sheetHeader);
      return { label: ef.label, value: raw, raw };
    });

    return {
      row,
      location: getDisplayLocation(row),
      answers,
      description,
      photoUrl,
      tags,
      extras,
    };
  });

  // Sort submissions by Location first, then by Patroli Ke-
  submissions.sort((a, b) => {
    const locA = a.location.toLowerCase();
    const locB = b.location.toLowerCase();
    if (locA < locB) return -1;
    if (locA > locB) return 1;
    return (a.row.patroliKe || 0) - (b.row.patroliKe || 0);
  });

  return {
    module,
    questionResults,
    totalPct,
    submissions,
  };
}

// ─── Summary for Homepage Cards ───────────────────────────────────────────────

export interface ModuleSummary {
  slug: string;
  title: string;
  icon: string;
  group: string;
  /** % total for current month */
  pctThisMonth: number | null;
  /** % total for previous month */
  pctLastMonth: number | null;
  /** Trend: positive = better, negative = worse, null = no prior data */
  trend: number | null;
  /** Number of submissions this month */
  submissionsThisMonth: number;
  /** Number of 'Tidak' answers across all questions in this module */
  needsAttentionCount: number;
  /** Whether this is a log-only module (no % to show) */
  logOnly: boolean;
}

export function computeAllModuleSummaries(
  allModules: ModuleDef[],
  rowsThisMonth: PatroliRow[],
  rowsLastMonth: PatroliRow[],
  masterData: any[] = []
): ModuleSummary[] {
  return allModules.map((mod) => {
    const thisResult = computeModuleAggregate(mod, rowsThisMonth, masterData);
    const lastResult = computeModuleAggregate(mod, rowsLastMonth, masterData);

    const trend =
      thisResult.totalPct !== null && lastResult.totalPct !== null
        ? thisResult.totalPct - lastResult.totalPct
        : null;

    const needsAttentionCount = thisResult.submissions.reduce((total, sub) => {
      return total + sub.answers.filter((a) => a.jawaban === "Tidak").length;
    }, 0);

    return {
      slug: mod.slug,
      title: mod.title,
      icon: mod.icon,
      group: mod.group,
      pctThisMonth: thisResult.totalPct,
      pctLastMonth: lastResult.totalPct,
      trend,
      submissionsThisMonth: thisResult.submissions.length,
      needsAttentionCount,
      logOnly: mod.logOnly ?? false,
    };
  });
}

// ─── Recent Findings ─────────────────────────────────────────────────────────

export interface RecentFinding {
  timestamp: string;
  namaPetugas: string;
  location: string;
  moduleTitle: string;
  moduleIcon: string;
  moduleSlug: string;
  description: string;
  photoUrl: string;
}

export function getRecentFindings(
  allModules: ModuleDef[],
  rows: PatroliRow[],
  limit = 5
): RecentFinding[] {
  const findings: RecentFinding[] = [];

  for (const mod of allModules) {
    if (mod.logOnly || !mod.descriptionHeader) continue;
    const relevant = rows.filter((r) => rowMatchesModule(r, mod));
    for (const row of relevant) {
      const desc = getField(row, mod.descriptionHeader!);
      if (!desc) continue;
      findings.push({
        timestamp: row.timestamp,
        namaPetugas: row.namaPetugas,
        location: getDisplayLocation(row),
        moduleTitle: mod.title,
        moduleIcon: mod.icon,
        moduleSlug: mod.slug,
        description: desc,
        photoUrl: mod.photoHeader ? getField(row, mod.photoHeader) : "",
      });
    }
  }

  // Sort by timestamp descending
  findings.sort((a, b) => {
    const da = new Date(a.timestamp.replace(/^(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2"));
    const db = new Date(b.timestamp.replace(/^(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2"));
    return db.getTime() - da.getTime();
  });

  return findings.slice(0, limit);
}

// ─── Status color helper ──────────────────────────────────────────────────────

export function pctStatus(pct: number | null): "green" | "yellow" | "red" | "gray" {
  if (pct === null) return "gray";
  if (pct >= 90) return "green";
  if (pct >= 70) return "yellow";
  return "red";
}

export function statusLabel(pct: number | null): string {
  if (pct === null) return "Belum Ada Data";
  if (pct >= 90) return "Patuh";
  if (pct >= 70) return "Perlu Perbaikan";
  return "Tidak Patuh";
}
