"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getCurrentBulan, formatBulan, formatTimestamp, downloadWithSavePrompt } from "@/lib/utils";
import { pctStatus } from "@/lib/analytics";
import LoadingScreen from "@/components/LoadingScreen";

interface ModuleSummary {
  slug: string;
  title: string;
  icon: string;
  group: string;
  pctThisMonth: number | null;
  pctLastMonth: number | null;
  trend: number | null;
  submissionsThisMonth: number;
  needsAttentionCount: number;
  logOnly: boolean;
}

interface RecentFinding {
  timestamp: string;
  namaPetugas: string;
  location: string;
  moduleTitle: string;
  moduleIcon: string;
  moduleSlug: string;
  description: string;
  photoUrl: string;
}

interface NeedsAttentionItem {
  location: string;
  questionLabel: string;
  timestamp: string;
}

interface NeedsAttentionGroup {
  moduleSlug: string;
  moduleTitle: string;
  moduleIcon: string;
  items: NeedsAttentionItem[];
}

interface SummaryData {
  bulan: string;
  summaries: ModuleSummary[];
  recentFindings: RecentFinding[];
  needsAttention: NeedsAttentionGroup[];
  totalSubmissions: number;
}

function PctBadge({ pct, logOnly }: { pct: number | null; logOnly?: boolean }) {
  if (logOnly) return <span className="badge-blue">Log Kegiatan</span>;
  if (pct === null) return <span className="badge-gray">Belum Ada Data</span>;
  const status = pctStatus(pct);
  if (status === "green") return <span className="badge-green">✓ {pct}%</span>;
  if (status === "yellow") return <span className="badge-yellow">⚠ {pct}%</span>;
  return <span className="badge-red">✗ {pct}%</span>;
}

function TrendIndicator({ trend }: { trend: number | null }) {
  if (trend === null) return null;
  if (trend > 0) return <span className="text-green-600 text-xs font-semibold">↑ +{trend}%</span>;
  if (trend < 0) return <span className="text-red-600 text-xs font-semibold">↓ {trend}%</span>;
  return <span className="text-gray-400 text-xs">→ Tetap</span>;
}

function ModuleCard({ mod }: { mod: ModuleSummary }) {
  const status = mod.logOnly ? "gray" : pctStatus(mod.pctThisMonth);
  const barColor = {
    green: "bg-green-500",
    yellow: "bg-amber-500",
    red: "bg-red-500",
    gray: "bg-gray-300",
  }[status];

  return (
    <Link
      href={`/patroli/${mod.slug}`}
      id={`card-${mod.slug}`}
      className="card-hover p-4 flex flex-col gap-3 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{mod.icon}</span>
          <div>
            <div className="font-semibold text-gray-800 dark:text-gray-100 text-sm leading-tight break-words">
              {mod.title}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 leading-tight mt-0.5">{mod.group}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {mod.needsAttentionCount > 0 && (
            <span className="bg-red-100 text-red-600 border border-red-200 text-[10px] px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1 font-bold animate-pulse">
              🔔 {mod.needsAttentionCount}
            </span>
          )}
          <TrendIndicator trend={mod.trend} />
        </div>
      </div>

      <div>
        <div className="flex items-end justify-between mb-1.5">
          <PctBadge pct={mod.pctThisMonth} logOnly={mod.logOnly} />
          <span className="text-xs text-gray-400">
            {mod.submissionsThisMonth} data
          </span>
        </div>
        {!mod.logOnly && (
          <div className="progress-track">
            <div
              className={`progress-fill ${barColor}`}
              style={{ width: `${mod.pctThisMonth ?? 0}%` }}
            />
          </div>
        )}
      </div>
    </Link>
  );
}

function NeedsAttentionAccordion({ groups }: { groups: NeedsAttentionGroup[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    groups.slice(0, 3).forEach((g) => { init[g.moduleSlug] = true; });
    return init;
  });
  const [showAll, setShowAll] = useState(false);

  const displayGroups = showAll ? groups : groups.slice(0, 6);

  const toggle = (slug: string) => {
    setExpanded((prev) => ({ ...prev, [slug]: !prev[slug] }));
  };

  return (
    <div>
      {displayGroups.map((g) => (
        <div key={g.moduleSlug} className="border-b border-gray-100 dark:border-slate-800 last:border-0">
          <button
            onClick={() => toggle(g.moduleSlug)}
            className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{g.moduleIcon}</span>
              <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">{g.moduleTitle}</span>
              <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-bold px-2 py-0.5 rounded text-[10px] ml-2">
                {g.items.length} Temuan
              </span>
            </div>
            <span className="text-gray-400 dark:text-gray-500 text-xs">
              {expanded[g.moduleSlug] ? "▲" : "▼"}
            </span>
          </button>

          {expanded[g.moduleSlug] && (
            <div className="px-4 pb-3 pl-[3.25rem] space-y-2">
              {g.items.slice(0, 5).map((item, idx) => (
                <Link
                  key={idx}
                  href={`/patroli/${g.moduleSlug}?ruangan=${encodeURIComponent(item.location)}`}
                  className="block text-sm text-gray-700 dark:text-gray-300 hover:text-red-700 dark:hover:text-red-400 transition-colors leading-relaxed break-words"
                >
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{item.location}</span> —
                  <span className="text-red-600 dark:text-red-500 font-bold mx-1">Tidak</span> —
                  {item.questionLabel}
                </Link>
              ))}
              {g.items.length > 5 && (
                <Link
                  href={`/patroli/${g.moduleSlug}`}
                  className="inline-block mt-2 text-xs font-semibold text-[var(--brand)] hover:underline"
                >
                  +{g.items.length - 5} lainnya, lihat semua di halaman {g.moduleTitle}
                </Link>
              )}
            </div>
          )}
        </div>
      ))}

      {!showAll && groups.length > 6 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-3 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-center"
        >
          Tampilkan semua topik ({groups.length - 6} lainnya)
        </button>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryBulan = searchParams.get("bulan");

  const [bulan, setBulanState] = useState(queryBulan || getCurrentBulan());
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiContext, setAiContext] = useState("");

  const setBulan = (newBulan: string) => {
    setBulanState(newBulan);
    router.push(`/?bulan=${newBulan}`);
  };

  useEffect(() => {
    if (queryBulan && queryBulan !== bulan) {
      setBulanState(queryBulan);
    }
  }, [queryBulan, bulan]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/patrol-data?mode=summary&bulan=${bulan}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal memuat data");
      }
      const json = await res.json();
      setData(json);
      // Dispatch event to update sidebar badges
      window.dispatchEvent(new CustomEvent('dashboardUpdate', { detail: json }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error tidak diketahui");
    } finally {
      setLoading(false);
    }
  }, [bulan]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerateSummary = async () => {
    if (!data) return;
    setGeneratingAi(true);
    setAiSummary(null);

    // Simplify data payload to reduce token usage
    const payloadData = {
      jenisLaporan: "Dashboard Keseluruhan",
      bulan: formatBulan(bulan),
      totalSubmissions: data.totalSubmissions,
      userContext: aiContext,
      ringkasanModul: data.summaries.map(s => ({
        modul: s.title,
        kepatuhan: s.pctThisMonth,
        temuanBermasalah: s.needsAttentionCount
      })),
      daftarPerhatian: data.needsAttention.map(g => ({
        modul: g.moduleTitle,
        totalTemuan: g.items.length,
        lokasiTemuan: Array.from(new Set(g.items.map(i => i.location)))
      }))
    };

    try {
      const res = await fetch("/api/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payloadData }),
        cache: "no-store"
      });
      if (!res.ok) throw new Error("Gagal generate ringkasan AI");
      const json = await res.json();
      setAiSummary(json.summary);
    } catch (e) {
      console.error(e);
      alert("Gagal membuat ringkasan AI.");
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleExportAll = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/export/excel?bulan=${bulan}`);
      if (!res.ok) throw new Error("Export gagal");
      const blob = await res.blob();
      await downloadWithSavePrompt(blob, `K3_RSOMH_LaporanLengkap_${bulan}.xlsx`);
    } catch {
      alert("Gagal mengunduh laporan.");
    } finally {
      setDownloading(false);
    }
  };

  const groups = ["Dalam Gedung — Bulanan", "Dalam Gedung — Harian", "Lainnya"] as const;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Dashboard Patroli K3
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Monitoring kepatuhan 17 topik patroli — RSOMH
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Month picker */}
          <div className="flex items-center gap-2">
            <label htmlFor="bulan-picker" className="text-xs text-gray-500">Bulan:</label>
            <input
              id="bulan-picker"
              type="month"
              value={bulan}
              onChange={(e) => setBulan(e.target.value)}
              className="form-control h-9"
            />
          </div>

          <button
            onClick={handleGenerateSummary}
            disabled={generatingAi || loading || !data}
            className="btn-primary bg-indigo-600 hover:bg-indigo-700 text-sm disabled:opacity-50 border-indigo-600 hover:border-indigo-700 shadow-md shadow-indigo-500/20"
          >
            {generatingAi ? "⏳" : "✨"} AI Summary
          </button>

          <button
            onClick={handleExportAll}
            disabled={downloading || loading}
            id="btn-export-semua"
            className="btn-success disabled:opacity-50 text-sm"
          >
            {downloading ? "⏳ Menyiapkan..." : "📥 Export Semua (Excel)"}
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="card p-6 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800/50 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-red-600 dark:text-red-400 font-semibold mb-1">Gagal Memuat Data</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">{error}</p>
          <button onClick={fetchData} className="btn-primary">Coba Lagi</button>
        </div>
      )}

      {/* ── Loading Screen ── */}
      {loading && !data && !error && (
        <LoadingScreen />
      )}

      {/* ── Main Data ── */}
      {(!loading || data) && !error && (
        <>
          {/* ── AI Summary Result ── */}
          {(aiSummary || generatingAi) && (
            <div className="card p-6 border-l-4 border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-indigo-600 dark:text-indigo-400 text-xl">✨</span>
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Ringkasan Eksekutif AI (Keseluruhan)</h2>
              </div>
              {generatingAi ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-5/6"></div>
                  <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/2 mt-4"></div>
                </div>
              ) : (
                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-4 whitespace-pre-wrap leading-relaxed">
                  {aiSummary}

                  {/* Bagian Catatan / Interaksi Lanjutan AI */}
                  <div className="mt-6 pt-4 border-t border-indigo-100 dark:border-indigo-800/30">
                    <label className="block text-xs font-semibold text-indigo-700 dark:text-indigo-400 mb-2">
                      Tambahkan catatan atau ubah sudut pandang AI:
                    </label>
                    <div className="flex gap-2">
                      <textarea
                        rows={2}
                        value={aiContext}
                        onChange={(e) => setAiContext(e.target.value)}
                        placeholder="Contoh: Fokuskan pada bahaya api, atau beri alasan ruangan farmasi kotor..."
                        className="form-control text-sm w-full bg-white dark:bg-slate-800 resize-y"
                        disabled={generatingAi}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleGenerateSummary();
                          }
                        }}
                      />
                      <button
                        onClick={handleGenerateSummary}
                        disabled={generatingAi || loading}
                        className="btn-primary bg-indigo-600 hover:bg-indigo-700 text-sm disabled:opacity-50 whitespace-nowrap"
                      >
                        Perbarui Ringkasan
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Overview Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Submission", val: data?.totalSubmissions ?? 0, icon: "📋" },
              {
                label: "Patuh (≥90%)",
                val: (data?.summaries ?? []).filter((s) => !s.logOnly && s.pctThisMonth !== null && s.pctThisMonth >= 90).length,
                icon: "✅",
              },
              {
                label: "Perlu Perbaikan",
                val: (data?.summaries ?? []).filter((s) => !s.logOnly && s.pctThisMonth !== null && s.pctThisMonth >= 70 && s.pctThisMonth < 90).length,
                icon: "⚠️",
              },
              {
                label: "Tidak Patuh (<70%)",
                val: (data?.summaries ?? []).filter((s) => !s.logOnly && s.pctThisMonth !== null && s.pctThisMonth < 70).length,
                icon: "🔴",
              },
            ].map(({ label, val, icon }) => (
              <div key={label} className="card p-4 text-center">
                <div className="text-2xl mb-1">{icon}</div>
                <div className="text-2xl font-black text-gray-800 dark:text-gray-100">{val}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* ── Module cards by group ── */}
          {groups.map((group) => {
            const mods = (data?.summaries || []).filter((s) => s.group === group);
            if (mods.length === 0) return null;

            return (
              <section key={group} aria-label={group}>
                <h2 className="section-label mb-3">
                  {group === "Dalam Gedung — Bulanan" && "🏢 "}
                  {group === "Dalam Gedung — Harian" && "📅 "}
                  {group === "Lainnya" && "🔬 "}
                  {group}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {mods.map((mod) => (
                    <ModuleCard key={mod.slug} mod={mod} />
                  ))}
                </div>
              </section>
            );
          })}

          {/* ── Perlu Perhatian ── */}
          <section aria-label="Perlu Perhatian">
            <div className="mb-3">
              <h2 className="section-label inline-block">⚠️ Perlu Perhatian</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Daftar jawaban &quot;Tidak&quot; yang belum ditindaklanjuti, dikelompokkan per topik
              </p>
            </div>

            <div className="card overflow-hidden">
              {!data?.needsAttention?.length ? (
                <div className="p-8 text-center bg-green-50/50 dark:bg-green-900/10">
                  <div className="text-4xl mb-2">✅</div>
                  <p className="font-semibold text-green-700 dark:text-green-400">Tidak ada temuan bermasalah bulan ini</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                  <NeedsAttentionAccordion groups={data.needsAttention} />
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
