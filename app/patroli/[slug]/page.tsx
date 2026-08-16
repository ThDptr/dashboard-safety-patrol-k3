"use client";

import { useState, useEffect, useCallback, Suspense, useMemo, Fragment, useRef } from "react";
import LockMonthButton from "@/components/LockMonthButton";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { MODULE_BY_SLUG } from "@/lib/modules";
import { formatBulan, formatTimestamp, getCurrentBulan, formatTanggal, downloadWithSavePrompt } from "@/lib/utils";
import SubmissionTable from "@/components/SubmissionTable";
import LoadingScreen from "@/components/LoadingScreen";
import jsPDF from "jspdf";
import "jspdf-autotable";

// Dynamic import for gauge (recharts needs client-only)
const GaugeChart = dynamic(() => import("@/components/GaugeChart"), {
  ssr: false,
  loading: () => <div className="skeleton rounded-full" style={{ width: 160, height: 160 }} />,
});

const ApdProfesiChart = dynamic(() => import("@/components/ApdProfesiChart"), {
  ssr: false,
  loading: () => <div className="skeleton rounded-lg h-80" />,
});

const QuestionHorizontalChart = dynamic(() => import("@/components/QuestionHorizontalChart"), {
  ssr: false,
  loading: () => <div className="skeleton rounded-lg h-80" />,
});

const TrendChart = dynamic(() => import("@/components/TrendChart"), {
  ssr: false,
  loading: () => <div className="skeleton rounded-lg h-80" />,
});

// ─── Types ─────────────────────────────────────────────────────────────────

interface QuestionResult {
  label: string;
  sheetHeader: string;
  pct: number | null;
  countYa: number;
  countTidak: number;
  countNA: number;
  countEmpty: number;
  countTidakAda?: number;
  countSetengah?: number;
  targetPct?: number;
  description?: string;
}

interface AnswerItem {
  sheetHeader: string;
  label: string;
  jawaban: "Ya" | "Tidak" | "N/A" | "";
}

interface ExtraItem {
  label: string;
  value: string;
  raw: string;
}

interface Submission {
  timestamp: string;
  tanggalPemantauan: string;
  namaPetugas: string;
  location: string;
  ruangan: string;
  patroliKe: number;
  answers: AnswerItem[];
  description: string;
  photoUrl: string;
  tags: string[];
  extras: ExtraItem[];
}

export interface PcraTopic {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  locations: string[];
  _rowIndex?: number;
}

interface ModuleData {
  bulan: string;
  module: {
    slug: string;
    title: string;
    icon: string;
    group: string;
    logOnly: boolean;
  };
  totalPct: number | null;
  trendData?: { month: string; pct: number | null }[];
  questionResults: QuestionResult[];
  submissions: Submission[];
  submissionCount: number;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PatroliDetailPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <PatroliDetailContent />
    </Suspense>
  );
}

function PatroliDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug ?? "";
  const moduleDef = MODULE_BY_SLUG[slug];

  const queryBulan = searchParams.get("bulan");
  const queryRuangan = searchParams.get("ruangan");

  // Use searchParams as source of truth — no double-sync needed
  const bulan = queryBulan || getCurrentBulan();
  const ruangan = queryRuangan || "";
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState<ModuleData | null>(null);
  const [masterData, setMasterData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiContext, setAiContext] = useState("");
  const [activeApdTab, setActiveApdTab] = useState<"ketersediaan" | "kepatuhan">("ketersediaan");
  const [activeB3Tab, setActiveB3Tab] = useState<"a" | "b" | "c">("a");
  const [activeElektrikTab, setActiveElektrikTab] = useState<"a" | "b">("a");
  const [keteranganPopup, setKeteranganPopup] = useState<string | null>(null);

  // AbortController ref to cancel stale fetches
  const abortRef = useRef<AbortController | null>(null);

  const [pcraTopics, setPcraTopics] = useState<PcraTopic[]>([]);
  const [activePcraTopicId, setActivePcraTopicId] = useState<string>("all");
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<PcraTopic | null>(null);
  const [topicNameInput, setTopicNameInput] = useState("");
  const [topicStartDate, setTopicStartDate] = useState("");
  const [topicEndDate, setTopicEndDate] = useState("");
  const [selectedTopicLocations, setSelectedTopicLocations] = useState<string[]>([]);
  const [isSavingTopic, setIsSavingTopic] = useState(false);

  // PCRA Authentication State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authPasswordInput, setAuthPasswordInput] = useState("");
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isPcraAuthenticated, setIsPcraAuthenticated] = useState(false);

  const requirePcraAuth = (action: () => void) => {
    if (isPcraAuthenticated) {
      action();
    } else {
      setPendingAction(() => action);
      setIsAuthModalOpen(true);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { verifyPassword } = await import("@/app/actions");
    const isValid = await verifyPassword(authPasswordInput);

    if (isValid) {
      setIsPcraAuthenticated(true);
      setIsAuthModalOpen(false);
      setAuthPasswordInput("");
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    } else {
      alert("Password salah!");
    }
  };

  // Fetch PCRA Topics from Master Data via API
  const fetchPcraTopics = async () => {
    try {
      const res = await fetch(`/api/master?sheetName=Master PCRA&t=${Date.now()}`);
      const json = await res.json();
      if (json.status === "success") {
        const topics: PcraTopic[] = json.data.map((row: any) => ({
          id: row["ID"]?.toString() || row.rowIndex?.toString() || Date.now().toString(),
          name: row["Nama Proyek"] || "",
          startDate: row["Tanggal Mulai"] || "",
          endDate: row["Tanggal Selesai"] || "",
          locations: row["Lokasi Terpilih"] ? row["Lokasi Terpilih"].split(",").map((l: string) => l.trim()).filter(Boolean) : [],
          _rowIndex: row.rowIndex
        }));
        setPcraTopics(topics);
      }
    } catch (e) {
      console.error("Error fetching PCRA topics", e);
    }
  };

  useEffect(() => {
    if (slug === "pcra") {
      fetchPcraTopics();
    }
  }, [slug]);

  // PCRA Unique Locations for Modal
  const uniquePcraLocations = useMemo(() => {
    if (slug !== "pcra" || !data?.submissions) return [];
    const locs = data.submissions
      .map(s => s.location || s.ruangan || "")
      .filter(l => l.trim() !== "");
    return Array.from(new Set(locs)).sort();
  }, [slug, data?.submissions]);

  const toggleTopicLocation = (loc: string) => {
    if (selectedTopicLocations.includes(loc)) {
      setSelectedTopicLocations(prev => prev.filter(l => l !== loc));
    } else {
      setSelectedTopicLocations(prev => [...prev, loc]);
    }
  };

  const handleSaveTopic = async () => {
    if (!topicNameInput.trim()) return;
    setIsSavingTopic(true);

    try {
      if (editingTopic && editingTopic._rowIndex) {
        // Update existing topic
        await fetch("/api/master", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheetName: "Master PCRA",
            rowIndex: editingTopic._rowIndex,
            rowData: {
              "ID": editingTopic.id,
              "Nama Proyek": topicNameInput,
              "Tanggal Mulai": topicStartDate,
              "Tanggal Selesai": topicEndDate,
              "Lokasi Terpilih": selectedTopicLocations.join(",")
            }
          })
        });
      } else {
        // Create new topic
        const newId = `PRJ-${Date.now()}`;
        await fetch("/api/master", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheetName: "Master PCRA",
            rowData: {
              "ID": newId,
              "Nama Proyek": topicNameInput,
              "Tanggal Mulai": topicStartDate,
              "Tanggal Selesai": topicEndDate,
              "Lokasi Terpilih": selectedTopicLocations.join(",")
            }
          })
        });
        setActivePcraTopicId(newId);
      }
      await fetchPcraTopics();
      setIsTopicModalOpen(false);
    } catch (e) {
      console.error("Error saving topic", e);
      alert("Gagal menyimpan topik PCRA.");
    } finally {
      setIsSavingTopic(false);
    }
  };

  const handleDeleteTopic = async (id: string, rowIndex?: number) => {
    if (!rowIndex) return;
    if (confirm("Apakah Anda yakin ingin menghapus topik ini dari Master Data?")) {
      setIsSavingTopic(true);
      try {
        await fetch("/api/master", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheetName: "Master PCRA",
            rowIndex: rowIndex
          })
        });
        await fetchPcraTopics();
        if (activePcraTopicId === id) setActivePcraTopicId("all");
      } catch (e) {
        console.error("Error deleting topic", e);
        alert("Gagal menghapus topik PCRA.");
      } finally {
        setIsSavingTopic(false);
      }
    }
  };

  // Helper: build full keterangan string for a single patrol submission
  const buildPatrolKeterangan = (p: any, allowedTags: string[] = [], useSecondary: boolean = false): string | null => {
    const parts: string[] = [];

    // 1. Text description from sheet
    const desc = useSecondary ? p?.secondaryDescription : p?.description;
    if (typeof desc === 'string' && desc.trim() !== "" && desc !== "-") {
      parts.push(desc.trim());
    }

    // 2. APD profession violations from tags
    if (p?.tags && Array.isArray(p.tags) && p.tags.length > 0) {
      // Only include tags that are profession names (in allowedTags)
      const profTags = allowedTags.length > 0
        ? p.tags.filter((t: string) => allowedTags.includes(t.toLowerCase()))
        : p.tags;

      if (profTags.length > 0) {
        // Group and count
        const counts: Record<string, number> = {};
        profTags.forEach((t: string) => { counts[t] = (counts[t] || 0) + 1; });
        const profStr = Object.entries(counts).map(([name, n]) => `${n} ${name}`).join(", ");
        parts.push(`[Tidak patuh: ${profStr}]`);
      }
    }

    // 3. Photo URL
    const photo = useSecondary ? p?.secondaryPhotoUrl : p?.photoUrl;
    if (typeof photo === 'string' && photo.trim() !== "") {
      parts.push(`📷 ${photo.trim()}`);
    }

    return parts.length > 0 ? parts.join(" | ") : null;
  };

  // ─── OPTIMIZED DATA GROUPING ───
  const groupedSubmissionsByLoc = useMemo(() => {
    if (!data?.submissions) return {};
    const map: Record<string, any[]> = {};
    data.submissions.forEach(p => {
      const loc = (p.location || p.ruangan || "").toLowerCase();
      if (!map[loc]) map[loc] = [];
      map[loc].push(p);
    });
    for (const loc in map) {
      map[loc].sort((a, b) => {
        const dateA = new Date(a.tanggalPemantauan || a.timestamp).getTime();
        const dateB = new Date(b.tanggalPemantauan || b.timestamp).getTime();
        return dateA - dateB;
      });
    }
    return map;
  }, [data?.submissions]);

  const groupedSubmissionsByKe = useMemo(() => {
    if (!data?.submissions) return {};
    const map: Record<number, any[]> = {};
    data.submissions.forEach(p => {
      const pKe = parseInt(String(p.patroliKe));
      if (!isNaN(pKe)) {
        if (!map[pKe]) map[pKe] = [];
        map[pKe].push(p);
      }
    });
    return map;
  }, [data?.submissions]);

  // Process Data for APD Table 1 & 2

  const reportData = useMemo(() => {
    if (slug !== "apd" || !masterData.length || !data?.submissions) return [];

    const masterProfesi = masterData.filter(m => m.Ruangan?.startsWith('**'));
    const masterRuangan = masterData.filter(m => !m.Ruangan?.startsWith('**'));

    const fisikData = masterRuangan.map((master) => {
      const ruangan = master.Ruangan;
      const jumlahKaryawan = parseInt(master["Jumlah Karyawan"] as any) || 0;

      const roomPatrols = groupedSubmissionsByLoc[(ruangan || "").toLowerCase()] || [];

      let top10 = roomPatrols.slice(-10);

      // Filter tags: ONLY "perawat" violations reduce the physical room's compliance
      top10 = top10.map(p => {
        let pTags = p.tags ? [...p.tags] : [];
        pTags = pTags.filter(t => t.toLowerCase().includes("perawat"));
        return { ...p, tags: pTags };
      });

      const latestPatrol = top10.length > 0 ? top10[top10.length - 1] : null;
      const tanggal = latestPatrol ? formatTanggal(latestPatrol.tanggalPemantauan || latestPatrol.timestamp) : "-";

      const namaPetugasList = Array.from(new Set(
        top10.map(p => p.namaPetugas).filter(n => typeof n === 'string' && n.trim() !== "" && n !== "-")
      ));
      const namaPetugas = namaPetugasList.length > 0 ? namaPetugasList.join(", ") : "-";

      const masterProfesiNamesForKet = masterProfesi.map(mp => (mp.Ruangan || "").substring(2).trim().toLowerCase());
      const keterangan = top10
        .map((p, idx) => {
          const ket = buildPatrolKeterangan(p, masterProfesiNamesForKet);
          return ket ? `P${idx + 1}: ${ket}` : null;
        })
        .filter(Boolean)
        .join(" ; ") || "-";

      return {
        ruangan,
        jumlahKaryawan,
        tanggal,
        namaPetugas,
        keterangan,
        patrols: top10,
        isProfesi: false
      };
    }).filter(d => d.patrols.length > 0);

    const profesiData = masterProfesi.map((master) => {
      const namaProfesiRaw = master.Ruangan || "";
      const namaProfesi = namaProfesiRaw.substring(2).trim();
      const jumlahKaryawan = parseInt(master["Jumlah Karyawan"] as any) || 0;

      // Create 10 virtual patrols based on patroliKe (1 to 10)
      const top10 = [];
      let allKeterangan: { slot: number; desc: string }[] = [];
      let latestDate = 0;
      let allPetugas: string[] = [];

      for (let i = 1; i <= 10; i++) {
        const patrolsInSlot = groupedSubmissionsByKe[i] || [];

        let sumViolations = 0;
        patrolsInSlot.forEach(p => {
          const matchCount = (p.tags || []).filter((t: string) => t.toLowerCase() === namaProfesi.toLowerCase()).length;
          if (matchCount > 0) {
            sumViolations += matchCount;
            
            // Build description indicating which room the violation occurred in
            const locationStr = p.location ? ` di ${p.location}` : "";
            const profStr = `[Tidak patuh: ${matchCount} ${namaProfesi}]${locationStr}`;
            const parts = [profStr];
            if (p.description && typeof p.description === 'string' && p.description.trim() !== "" && p.description !== "-") parts.push(p.description.trim());
            if (p.photoUrl) parts.push(`📷 ${p.photoUrl}`);
            allKeterangan.push({ slot: i, desc: parts.join(" | ") });
            
            if (p.namaPetugas) allPetugas.push(p.namaPetugas);
            const pTime = new Date(p.tanggalPemantauan || p.timestamp).getTime();
            if (pTime > latestDate) latestDate = pTime;
          }
        });

        if (patrolsInSlot.length > 0) {
          top10.push({
            tags: new Array(sumViolations).fill("violation"),
            answers: [
              { label: "Kepatuhan menggunakan APD", jawaban: sumViolations > 0 ? "Tidak" : "Ya" }
            ]
          });
        } else {
          top10.push(null);
        }
      }

      return {
        ruangan: namaProfesiRaw,
        jumlahKaryawan,
        tanggal: latestDate > 0 ? formatTanggal(new Date(latestDate).toISOString()) : "-",
        namaPetugas: allPetugas.length > 0 ? Array.from(new Set(allPetugas)).join(", ") : "-",
        keterangan: allKeterangan.length > 0
          ? allKeterangan.map(k => `P${k.slot}: ${k.desc}`).join(" ; ")
          : "-",
        patrols: top10,
        isProfesi: true
      };
    }).filter(d => d.patrols.some(p => p !== null));

    return [...fisikData, ...profesiData];
  }, [slug, masterData, data?.submissions, groupedSubmissionsByKe, groupedSubmissionsByLoc]);

  // Process Data for Elektrik Table (Horizontal Layout)
  const elektrikReportData = useMemo(() => {
    if (slug !== "elektrik" || !masterData.length || !data?.submissions) return [];

    const masterFisik = masterData.filter(m => !m.Ruangan?.startsWith('**'));
    return masterFisik.map((master) => {
      const ruangan = master.Ruangan;

      const roomPatrols = groupedSubmissionsByLoc[(ruangan || "").toLowerCase()] || [];

      const top10 = roomPatrols.slice(-10);
      const latestPatrol = top10.length > 0 ? top10[top10.length - 1] : null;
      const tanggal = latestPatrol ? formatTanggal(latestPatrol.tanggalPemantauan || latestPatrol.timestamp) : "-";

      const namaPetugasList = Array.from(new Set(
        top10.map(p => p.namaPetugas).filter(n => typeof n === 'string' && n.trim() !== "" && n !== "-")
      ));
      const namaPetugas = namaPetugasList.length > 0 ? namaPetugasList.join(", ") : "-";

      const keterangan = top10
        .map((p, idx) => {
          const ket = buildPatrolKeterangan(p);
          return ket ? `P${idx + 1}: ${ket}` : null;
        })
        .filter(Boolean)
        .join(" ; ") || "-";

      return {
        ruangan,
        tanggal,
        namaPetugas,
        keterangan,
        patrols: top10,
      };
    }).filter(d => d.patrols.length > 0);
  }, [slug, masterData, data?.submissions, groupedSubmissionsByLoc]);

  // Process Data for B3 Table
  const b3ReportData = useMemo(() => {
    if (slug !== "b3" || !masterData.length || !data?.submissions) return [];

    const masterFisik = masterData.filter(m => !m.Ruangan?.startsWith('**'));
    return masterFisik.map((master) => {
      const ruangan = master.Ruangan;

      const roomPatrols = groupedSubmissionsByLoc[(ruangan || "").toLowerCase()] || [];

      const top2 = roomPatrols.slice(-2);
      const latestPatrol = top2.length > 0 ? top2[top2.length - 1] : null;

      const keteranganA = top2
        .map((p, idx) => {
          const ket = buildPatrolKeterangan(p, [], false);
          return ket ? `P${idx + 1}: ${ket}` : null;
        })
        .filter(Boolean)
        .join(" ; ") || "-";

      const keteranganC = top2
        .map((p, idx) => {
          const ket = buildPatrolKeterangan(p, [], true);
          return ket ? `P${idx + 1}: ${ket}` : null;
        })
        .filter(Boolean)
        .join(" ; ") || "-";

      const seharusnyaLemari = parseInt(master["Jumlah Lemari B3"] as string, 10) || 0;
      let terlihatLemari: string | number = "-";
      let eyewasher = "-";
      let bodywasher = "-";

      if (latestPatrol && latestPatrol.extras) {
        const l = latestPatrol.extras.find((e: any) => e.label.includes("Jumlah Lemari B3"));
        if (l) terlihatLemari = l.value || "-";
        const eye = latestPatrol.extras.find((e: any) => e.label.includes("Jumlah Eyewasher"));
        if (eye) eyewasher = eye.value || "-";
        const body = latestPatrol.extras.find((e: any) => e.label.includes("Jumlah Bodywasher"));
        if (body) bodywasher = body.value || "-";
      }

      return {
        ruangan,
        seharusnyaLemari,
        terlihatLemari,
        eyewasher,
        bodywasher,
        keteranganA,
        keteranganC,
        patrols: top2,
      };
    }).filter(d => d.patrols.length > 0);
  }, [slug, masterData, data?.submissions, groupedSubmissionsByLoc]);

  const apdSummary = useMemo(() => {
    if (slug !== "apd" || !reportData.length) return null;

    const summary = Array(10).fill(null).map(() => ({
      ya: 0, tidak: 0, na: 0, totalCompliant: 0, totalKaryawan: 0
    }));

    reportData.forEach(row => {
      row.patrols.forEach((p, colIdx) => {
        if (!p) return;
        if (activeApdTab === "ketersediaan") {
          const answerObj = p.answers.find((a: any) => a.label === "Ketersediaan terpenuhi" || a.label.includes("Ketersediaan"));
          if (answerObj) {
            if (answerObj.jawaban === "Ya") summary[colIdx].ya++;
            else if (answerObj.jawaban === "Tidak") summary[colIdx].tidak++;
            else if (answerObj.jawaban === "N/A") summary[colIdx].na++;
          }
        } else {
          if (row.jumlahKaryawan > 0) {
            const ansObj = p.answers.find((a: any) => a.label.includes("menggunakan APD") || a.label.includes("Kepatuhan"));
            if (ansObj && ansObj.jawaban !== "-" && ansObj.jawaban !== "N/A") {
              let nonCompliantCount = 0;
              if (ansObj.jawaban === "Tidak") {
                const tagsCount = (p.tags || []).filter((t: string) => t.trim() !== "").length;
                nonCompliantCount = tagsCount > 0 ? tagsCount : 1;
              }
              let compliant = row.jumlahKaryawan - nonCompliantCount;
              if (compliant < 0) compliant = 0;
              summary[colIdx].totalCompliant += compliant;
              summary[colIdx].totalKaryawan += row.jumlahKaryawan;
            }
          }
        }
      });
    });

    return summary;
  }, [slug, reportData, activeApdTab]);

  const apdOverallPct = data?.totalPct !== undefined && data.totalPct !== null ? Math.round(data.totalPct) : null;

  const b3Summary = useMemo(() => {
    if (slug !== "b3" || !b3ReportData.length) return null;

    const summary = Array(4).fill(null).map(() => ({ ya: 0, tidak: 0, na: 0 }));

    let h1 = "", h2 = "";
    if (activeB3Tab === "a") { h1 = "Penyimpanan B3"; h2 = "Ketersediaan SDS"; }
    else if (activeB3Tab === "b") { h1 = "Ketersediaan Spill Kit"; h2 = "Kelengkapan Spill Kit"; }
    else { h1 = "Eyewasher"; h2 = "Bodywasher"; }

    const getExpected = (row: any, lbl: string) => {
      let exp = 1;
      if (lbl === "Penyimpanan B3" || lbl === "Ketersediaan SDS") {
        exp = row.seharusnyaLemari > 0 ? row.seharusnyaLemari : (parseInt(String(row.terlihatLemari), 10) || 0);
      }
      return exp > 0 ? exp : 1;
    };

    b3ReportData.forEach(row => {
      [0, 1].forEach((colIdx) => {
        const p = row.patrols[colIdx];
        if (p) {
          const answerObj1 = p.answers.find((a: any) => a.label.includes(h1.split(" ")[0]));
          if (answerObj1) {
            const ans = answerObj1.jawaban;
            if (ans !== "-" && ans !== "N/A" && ans !== "") {
              const expected = getExpected(row, h1);
              if (ans === "Ya") {
                summary[colIdx].ya += expected;
              } else if (ans === "Tidak") {
                const nonCompliant = (p.tags && p.tags.length > 0) ? p.tags.length : expected;
                summary[colIdx].ya += Math.max(0, expected - nonCompliant);
                summary[colIdx].tidak += nonCompliant;
              }
            } else if (ans === "N/A") {
              summary[colIdx].na++;
            }
          }

          const answerObj2 = p.answers.find((a: any) => a.label.includes(h2.split(" ")[0]));
          if (answerObj2) {
            const ans = answerObj2.jawaban;
            if (ans !== "-" && ans !== "N/A" && ans !== "") {
              const expected = getExpected(row, h2);
              if (ans === "Ya") {
                summary[2 + colIdx].ya += expected;
              } else if (ans === "Tidak") {
                const nonCompliant = (p.tags && p.tags.length > 0) ? p.tags.length : expected;
                summary[2 + colIdx].ya += Math.max(0, expected - nonCompliant);
                summary[2 + colIdx].tidak += nonCompliant;
              }
            } else if (ans === "N/A") {
              summary[2 + colIdx].na++;
            }
          }
        }
      });
    });

    return summary;
  }, [slug, b3ReportData, activeB3Tab]);

  const apdKepatuhanPct = useMemo(() => {
    if (slug !== "apd" || !reportData.length) return data?.totalPct ?? null;
    let totalPatuh = 0;
    let totalSeharusnya = 0;

    reportData.forEach(row => {
      row.patrols.forEach(p => {
        if (p && row.jumlahKaryawan > 0) {
          const ansObj = p.answers.find((a: any) => a.label.includes("menggunakan APD") || a.label.includes("Kepatuhan"));
          if (ansObj && ansObj.jawaban !== "-" && ansObj.jawaban !== "N/A") {
            let nonCompliantCount = 0;
            if (ansObj.jawaban === "Tidak") {
              const tagsCount = (p.tags || []).filter((t: string) => t.trim() !== "").length;
              nonCompliantCount = tagsCount > 0 ? tagsCount : 1;
            }
            let compliant = row.jumlahKaryawan - nonCompliantCount;
            if (compliant < 0) compliant = 0;
            totalPatuh += compliant;
            totalSeharusnya += row.jumlahKaryawan;
          }
        }
      });
    });

    if (totalSeharusnya === 0) return data?.totalPct ?? null;
    return Math.round((totalPatuh / totalSeharusnya) * 100);
  }, [slug, reportData, data?.totalPct]);

  const customQuestionResults = useMemo(() => {
    if (!data?.questionResults) return [];

    const results = JSON.parse(JSON.stringify(data.questionResults));

    if (slug === "apd" && reportData.length > 0) {
      let totalKetersediaanYa = 0;
      let totalKetersediaanAns = 0;

      reportData.forEach(row => {
        row.patrols.forEach(p => {
          if (p) {
            const answerObj = p.answers.find((a: any) => a.label === "Ketersediaan terpenuhi" || a.label.includes("Ketersediaan"));
            const ans = answerObj ? answerObj.jawaban : "-";
            if (ans === "Ya") { totalKetersediaanYa++; totalKetersediaanAns++; }
            else if (ans === "Tidak") { totalKetersediaanAns++; }
          }
        });
      });

      const ketersediaanPct = totalKetersediaanAns > 0 ? Math.round((totalKetersediaanYa / totalKetersediaanAns) * 100) : null;

      results.forEach((qr: any) => {
        if (qr.label.includes("menggunakan APD") || qr.label.includes("Kepatuhan")) {
          qr.pct = apdKepatuhanPct;
        } else if (qr.label.includes("Ketersediaan")) {
          qr.pct = ketersediaanPct;
        }
      });
    } else if (slug === "b3" && b3ReportData.length > 0) {
      const calcB3Pct = (lblToMatch: string) => {
        let sumYa = 0;
        let sumTotal = 0;

        b3ReportData.forEach(row => {
          [0, 1].forEach(colIdx => {
            const p = row.patrols[colIdx];
            if (p) {
              const answerObj = p.answers.find((a: any) => a.label.includes(lblToMatch));
              const ans = answerObj ? answerObj.jawaban : "-";

              if (ans !== "-" && ans !== "N/A" && ans !== "") {
                let expected = 1;
                if (lblToMatch === "Penyimpanan B3" || lblToMatch === "Ketersediaan SDS") {
                  expected = row.seharusnyaLemari > 0 ? row.seharusnyaLemari : (parseInt(String(row.terlihatLemari), 10) || 0);
                  if (expected <= 0) expected = 1; // Fallback to 1 so the answer is counted
                }

                if (ans === "Ya") {
                  sumYa += expected;
                  sumTotal += expected;
                } else if (ans === "Tidak") {
                  const nonCompliant = (p.tags && p.tags.length > 0) ? p.tags.length : expected;
                  sumYa += Math.max(0, expected - nonCompliant);
                  sumTotal += expected;
                }
              }
            }
          });
        });

        return sumTotal > 0 ? Math.round((sumYa / sumTotal) * 100) : null;
      };

      results.forEach((qr: any) => {
        if (qr.label.includes("Penyimpanan B3")) qr.pct = calcB3Pct("Penyimpanan B3");
        else if (qr.label.includes("Ketersediaan SDS")) qr.pct = calcB3Pct("Ketersediaan SDS");
        else if (qr.label.includes("Ketersediaan Spill Kit")) qr.pct = calcB3Pct("Ketersediaan Spill Kit");
        else if (qr.label.includes("Kelengkapan Spill Kit")) qr.pct = calcB3Pct("Kelengkapan Spill Kit");
        else if (qr.label.includes("Eyewasher")) qr.pct = calcB3Pct("Eyewasher");
        else if (qr.label.includes("Bodywasher")) qr.pct = calcB3Pct("Bodywasher");
      });
    }

    return results;
  }, [slug, data?.questionResults, reportData, b3ReportData, apdKepatuhanPct]);

  const apdGaugePct = useMemo(() => {
    if (slug !== "apd" || customQuestionResults.length === 0) return data?.totalPct ?? null;
    const valid = customQuestionResults.filter((q: any) => q.pct !== null);
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((acc: number, q: any) => acc + q.pct, 0) / valid.length);
  }, [slug, customQuestionResults, data?.totalPct]);

  const b3OverallPct = useMemo(() => {
    if (slug !== "b3" || customQuestionResults.length === 0) return data?.totalPct ?? null;
    const valid = customQuestionResults.filter((q: any) => q.pct !== null);
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((acc: number, q: any) => acc + q.pct, 0) / valid.length);
  }, [slug, customQuestionResults, data?.totalPct]);

  const elektrikSummary = useMemo(() => {
    if (slug !== "elektrik" || !elektrikReportData.length) return null;

    // 10 patrols * 2 questions (Kabel, Sambungan) = 20 columns
    const summary = Array(20).fill(null).map(() => ({ ya: 0, tidak: 0, na: 0 }));

    elektrikReportData.forEach(row => {
      [...Array(10)].forEach((_, colIdx) => {
        const p = row.patrols[colIdx];
        if (p) {
          const ansA = p.answers.find((a: any) => a.label.includes("Perkabelan aman"));
          if (ansA) {
            if (ansA.jawaban === "Ya") summary[colIdx * 2].ya++;
            else if (ansA.jawaban === "Tidak") summary[colIdx * 2].tidak++;
            else if (ansA.jawaban === "N/A") summary[colIdx * 2].na++;
          }

          const ansB = p.answers.find((a: any) => a.label.toLowerCase().includes("sambungan listrik aman"));
          if (ansB) {
            if (ansB.jawaban === "Ya") summary[(colIdx * 2) + 1].ya++;
            else if (ansB.jawaban === "Tidak") summary[(colIdx * 2) + 1].tidak++;
            else if (ansB.jawaban === "N/A") summary[(colIdx * 2) + 1].na++;
          }
        }
      });
    });

    return summary;
  }, [slug, elektrikReportData]);

  const setBulan = (newBulan: string) => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("bulan", newBulan);
    router.push(`${pathname}?${newParams.toString()}`, { scroll: false });
  };

  const setRuangan = (newRuangan: string) => {
    const newParams = new URLSearchParams(searchParams.toString());
    if (newRuangan) newParams.set("ruangan", newRuangan);
    else newParams.delete("ruangan");
    router.push(`${pathname}?${newParams.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (!slug) return;

    // Abort any previous in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const doFetch = async () => {
      setLoading(true);
      setError(null);
      try {
        let url = `/api/patrol-data?mode=module&slug=${slug}&bulan=${bulan}`;
        if (ruangan) url += `&ruangan=${encodeURIComponent(ruangan)}`;
        if (startDate && endDate) url += `&startDate=${startDate}&endDate=${endDate}`;

        const res = await fetch(url, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Gagal mengambil data");
        
        const json = await res.json();

        // Only update state if this request was NOT aborted
        if (!controller.signal.aborted) {
          setData(json);
          if (json.masterData) {
            setMasterData(json.masterData);
          }
        }
      } catch (e: any) {
        // Ignore AbortError — it's expected when switching tabs/filters
        if (e.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setError(e.message || "Error");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    doFetch();

    return () => {
      controller.abort();
    };
  }, [slug, bulan, ruangan, startDate, endDate]);

  // Manual refresh: triggers the useEffect above by nudging startDate
  const fetchData = useCallback(() => {
    // Force the useEffect to re-run by toggling a micro-state change
    setStartDate(prev => prev === "" ? "" : prev);
    setEndDate(prev => prev === "" ? "" : prev);
    // Since the deps didn't actually change, we need to abort+re-fetch manually
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    let url = `/api/patrol-data?mode=module&slug=${slug}&bulan=${bulan}`;
    if (ruangan) url += `&ruangan=${encodeURIComponent(ruangan)}`;
    if (startDate && endDate) url += `&startDate=${startDate}&endDate=${endDate}`;

    fetch(url, { cache: 'no-store', signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error("Gagal mengambil data");
        return res.json();
      })
      .then(json => {
        if (!controller.signal.aborted) {
          setData(json);
          if (json.masterData) setMasterData(json.masterData);
        }
      })
      .catch(e => {
        if (e.name === 'AbortError') return;
        if (!controller.signal.aborted) setError(e.message || "Error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, [slug, bulan, ruangan, startDate, endDate]);

  const handleGenerateSummary = async () => {
    if (!data || data.submissions.length === 0) return;
    setGeneratingAi(true);
    setAiSummary(null);

    // Simplify data payload to reduce token usage
    const payloadData = {
      module: data.module.title,
      bulan: formatBulan(bulan),
      ruanganFilter: ruangan || "Semua",
      totalKepatuhan: data.totalPct,
      userContext: aiContext,
      ringkasanPertanyaan: data.questionResults.map(q => ({
        pertanyaan: q.label,
        kepatuhanPersen: q.pct,
        ya: q.countYa,
        tidak: q.countTidak
      })),
      detailTemuan: data.submissions
        .filter(s => s.answers.some(a => a.jawaban === "Tidak") || s.description)
        .map(s => ({
          tanggal: s.tanggalPemantauan,
          ruangan: s.ruangan,
          petugas: s.namaPetugas,
          catatan: s.description,
          jawabanTidak: s.answers.filter(a => a.jawaban === "Tidak").map(a => a.label)
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
      alert("Gagal membuat ringkasan AI. Pastikan API key sudah diatur dengan benar.");
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleExportExcel = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      let url = `/api/export/excel?slug=${slug}&bulan=${bulan}&ruangan=${encodeURIComponent(ruangan)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Gagal mengunduh Excel");
      const blob = await res.blob();
      let filename = `K3_RSOMH_${slug.toUpperCase()}_${bulan}.xlsx`;
      if (slug === "pcra" && data.submissions && data.submissions.length > 0) {
        const topicName = data.submissions[0].extras?.find(e => e.label === "Topik")?.value || "";
        if (topicName) {
           filename = `K3_RSOMH_PCRA_${String(topicName).replace(/[^a-z0-9]/gi, '_')}_${bulan}.xlsx`;
        }
      }
      await downloadWithSavePrompt(blob, filename);
    } catch (err) {
      console.error(err);
      alert("Gagal mengunduh Excel");
    } finally {
      setDownloading(false);
    }
  };

  const handleExportDetailExcel = async (type: 'apd' | 'b3' | 'elektrik') => {
    setDownloading(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const apdSheetName = type === 'apd'
        ? (activeApdTab === 'ketersediaan' ? 'a. Ketersediaan Terpenuhi' : 'b. Karyawan Menggunakan Sesuai')
        : 'Laporan Detail';
      const sheet = workbook.addWorksheet(type === 'apd' ? apdSheetName : 'Laporan Detail');

      if (type === 'apd') {
        // ── Title row (baris 1) ──
        const totalCols = 5 + 10 + (activeApdTab === 'ketersediaan' ? 1 : 2) + 1; // No+Tgl+Petugas+Ruangan+Pegawai + 10 patroli + rata/patuh + keterangan
        const titleLabel = activeApdTab === 'ketersediaan'
          ? 'a. Ketersediaan Terpenuhi APD'
          : 'b. Karyawan Menggunakan APD Sesuai';
        sheet.mergeCells(1, 1, 1, totalCols);
        const titleCell = sheet.getCell(1, 1);
        titleCell.value = `📄 Laporan Detail APD — ${titleLabel} — ${bulan}`;
        titleCell.font = { bold: true, size: 12, color: { argb: 'FFB71C1C' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(1).height = 24;

        // ── Header row (baris 2) ──
        const patroliColHeader = activeApdTab === 'ketersediaan' ? 'Ya/Tidak' : 'Jml Patuh';
        let cols: any = [
          { header: 'No', key: 'no', width: 5 },
          { header: 'Tanggal', key: 'tanggal', width: 15 },
          { header: 'Nama Petugas', key: 'petugas', width: 20 },
          { header: 'Ruangan', key: 'ruangan', width: 25 },
          { header: 'Jumlah Pegawai', key: 'pegawai', width: 15 },
          ...Array(10).fill(0).map((_, i) => ({ header: `P${i + 1} — ${patroliColHeader}`, key: `p${i}`, width: 16 })),
        ];

        if (activeApdTab === "ketersediaan") {
          cols.push({ header: 'Rata-rata', key: 'rata', width: 15 });
        } else {
          cols.push({ header: 'Total Patuh', key: 'patuh', width: 15 });
          cols.push({ header: 'Total Tidak Patuh', key: 'tidak_patuh', width: 15 });
        }
        cols.push({ header: 'Keterangan', key: 'keterangan', width: 35 });

        // Gunakan baris 2 untuk header (karena baris 1 sudah dipakai title)
        sheet.getRow(2).values = cols.map((c: any) => c.header);
        sheet.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(2).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        sheet.getRow(2).height = 30;
        sheet.getRow(2).eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB71C1C' } };
          cell.border = { bottom: { style: 'thin', color: { argb: 'FF999999' } } };
        });
        // Set column widths
        cols.forEach((col: any, i: number) => {
          sheet.getColumn(i + 1).key = col.key;
          sheet.getColumn(i + 1).width = col.width;
        });
        // Data rows akan dimulai dari baris 3 (baris 1=title, baris 2=header)

        reportData.forEach((row, i) => {
          const rowData: any = {
            no: i + 1,
            tanggal: row.tanggal,
            petugas: row.namaPetugas,
            ruangan: row.isProfesi ? `${row.ruangan.substring(2)} (Profesi)` : row.ruangan,
            pegawai: row.jumlahKaryawan,
            keterangan: row.keterangan,
          };

          let yaCount = 0;
          let totalCount = 0;
          let sumCompliant = 0;
          let sumNonCompliant = 0;

          row.patrols.forEach((p, colIdx) => {
            let ans = "-";
            if (p) {
              if (activeApdTab === "ketersediaan") {
                const answerObj = p.answers.find((a: any) => a.label === "Ketersediaan terpenuhi" || a.label.includes("Ketersediaan"));
                ans = answerObj ? answerObj.jawaban : "-";
                if (ans === "Ya") { yaCount++; totalCount++; }
                else if (ans === "Tidak") { totalCount++; }
              } else {
                const answerObj = p.answers.find((a: any) => a.label.includes("menggunakan APD") || a.label.includes("Kepatuhan"));
                const rawAns = answerObj ? answerObj.jawaban : "-";
                
                if (rawAns !== "-" && rawAns !== "N/A" && rawAns !== "") {
                  if (row.jumlahKaryawan > 0) {
                    let nonCompliantCount = 0;
                    if (rawAns === "Tidak") {
                      const tagsCount = (p.tags || []).filter((t: string) => t.trim() !== "").length;
                      nonCompliantCount = tagsCount > 0 ? tagsCount : 1;
                    }
                    let compliant = row.jumlahKaryawan - nonCompliantCount;
                    if (compliant < 0) compliant = 0;
                    ans = compliant.toString(); // angka saja, % hanya di kolom Total Patuh/Tidak Patuh
                    sumCompliant += compliant;
                    sumNonCompliant += (row.jumlahKaryawan - compliant);
                  } else {
                    ans = "0";
                  }
                } else {
                  ans = rawAns;
                }
              }
            }
            rowData[`p${colIdx}`] = ans;
          });

          if (activeApdTab === "ketersediaan") {
            rowData['rata'] = totalCount > 0 ? ((yaCount / totalCount) * 100).toFixed(0) + "%" : "-";
          } else {
            const totalRow = sumCompliant + sumNonCompliant;
            const patuhPct = totalRow > 0 ? Math.round((sumCompliant / totalRow) * 100) : 0;
            const tidakPatuhPct = totalRow > 0 ? Math.round((sumNonCompliant / totalRow) * 100) : 0;
            rowData['patuh'] = totalRow > 0 ? `${sumCompliant} (${patuhPct}%)` : "-";
            rowData['tidak_patuh'] = totalRow > 0 ? `${sumNonCompliant} (${tidakPatuhPct}%)` : "-";
          }

          sheet.addRow(rowData);
        });

        // Append summary rows
        if (activeApdTab === "ketersediaan") {
          const rowPct: any = { ruangan: 'Persentase (%)' };
          rowPct['pegawai'] = reportData.reduce((acc, curr) => acc + curr.jumlahKaryawan, 0);
          let totalYa = 0;
          let totalAns = 0;
          apdSummary?.forEach((s, i) => {
            const t = s.ya + s.tidak;
            rowPct[`p${i}`] = t > 0 ? `${s.ya} (${((s.ya / t) * 100).toFixed(0)}%)` : "0%";
            totalYa += s.ya;
            totalAns += t;
          });
          rowPct['rata'] = totalAns > 0 ? `${totalYa} (${((totalYa / totalAns) * 100).toFixed(0)}%)` : "-";

          sheet.addRow(rowPct);
        } else {
          const rowAvg: any = { ruangan: 'Total Keseluruhan' };
          let totalPegawai = reportData.reduce((acc, curr) => acc + curr.jumlahKaryawan, 0);
          rowAvg['pegawai'] = totalPegawai;

          let totalCompliantSum = 0;
          apdSummary?.forEach((s, i) => {
            const pct = s.totalKaryawan > 0 ? Math.round((s.totalCompliant / s.totalKaryawan) * 100) : 0;
            rowAvg[`p${i}`] = s.totalKaryawan > 0 ? `${s.totalCompliant} (${pct}%)` : "-";
            totalCompliantSum += s.totalCompliant;
          });

          let totalNonCompliantSum = 0;
          reportData.forEach(row => {
            row.patrols.forEach(p => {
              if (p && row.jumlahKaryawan > 0) {
                 const ansObj = p.answers.find((a: any) => a.label.includes("menggunakan APD") || a.label.includes("Kepatuhan"));
                 if (ansObj && ansObj.jawaban !== "-" && ansObj.jawaban !== "N/A" && ansObj.jawaban !== "") {
                    let nonCompliantCount = 0;
                    if (ansObj.jawaban === "Tidak") {
                      const tagsCount = (p.tags || []).filter((t: string) => t.trim() !== "").length;
                      nonCompliantCount = tagsCount > 0 ? tagsCount : 1;
                    }
                    let compliant = row.jumlahKaryawan - nonCompliantCount;
                    if (compliant < 0) compliant = 0;
                    totalNonCompliantSum += (row.jumlahKaryawan - compliant);
                 }
              }
            });
          });

          let denom = totalCompliantSum + totalNonCompliantSum;
          const patuhSumPct = denom > 0 ? Math.round((totalCompliantSum / denom) * 100) : 0;
          const tidakSumPct = denom > 0 ? Math.round((totalNonCompliantSum / denom) * 100) : 0;
          rowAvg['patuh'] = denom > 0 ? `${totalCompliantSum} (${patuhSumPct}%)` : "-";
          rowAvg['tidak_patuh'] = denom > 0 ? `${totalNonCompliantSum} (${tidakSumPct}%)` : "-";

          sheet.addRow(rowAvg);
        }

        // --- CHART APD ---
        const apdLabels = Array.from({ length: 10 }, (_, i) => `P${i + 1}`);
        const apdData = apdSummary?.map(s => {
          if (activeApdTab === "ketersediaan") {
            const t = s.ya + s.tidak;
            return t > 0 ? Number(((s.ya / t) * 100).toFixed(0)) : 0;
          } else {
            return s.totalKaryawan > 0 ? Number(((s.totalCompliant / s.totalKaryawan) * 100).toFixed(0)) : 0;
          }
        }) || [];

        const chartConfig = {
          type: 'line',
          data: {
            labels: apdLabels,
            datasets: [{
              label: activeApdTab === "ketersediaan" ? 'Ketersediaan APD (%)' : 'Kepatuhan Penggunaan APD (%)',
              data: apdData,
              borderColor: '#199e70',
              backgroundColor: 'rgba(25, 158, 112, 0.1)',
              fill: true
            }]
          },
          options: {
            title: { display: true, text: 'Tren Kepatuhan per Patroli', fontSize: 16 },
            scales: { yAxes: [{ ticks: { min: 0, max: 100 } }] },
            plugins: {
              datalabels: { anchor: 'end', align: 'bottom', formatter: (value: any) => value + '%' }
            }
          }
        };

        try {
          const qcUrl = `https://quickchart.io/chart?w=600&h=300&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
          const qcRes = await fetch(qcUrl);
          if (qcRes.ok) {
            const buffer = await qcRes.arrayBuffer();
            const imageId = workbook.addImage({ buffer, extension: 'png' });
            sheet.addImage(imageId, {
              tl: { col: 1, row: reportData.length + 6 } as any,
              br: { col: 7, row: reportData.length + 22 } as any
            });
          }
        } catch (e) {
          console.warn('Gagal load chart APD', e);
        }
        // --- CHART PROFESI MELANGGAR (hanya tab kepatuhan) ---
        if (activeApdTab === "kepatuhan") {
          const profesiCount: Record<string, number> = {};
          // Kumpulkan tag dari semua submissions (profesi yang melanggar)
          if (data?.submissions) {
            for (const sub of data.submissions) {
              if (sub.tags && sub.tags.length > 0) {
                for (const tag of sub.tags) {
                  let profesi = (tag as string).trim();
                  if (!profesi) continue;
                  if (profesi.toLowerCase() === "perawat") {
                    profesi = `Perawat-${(sub as any).location || 'Tidak Diketahui'}`;
                  }
                  profesiCount[profesi] = (profesiCount[profesi] || 0) + 1;
                }
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
                scales: { yAxes: [{ ticks: { min: 0, stepSize: 1 } }] },
                plugins: {
                  datalabels: { anchor: 'end', align: 'top', color: 'black', font: { weight: 'bold' } }
                }
              }
            };
            try {
              const pQcUrl = `https://quickchart.io/chart?w=600&h=400&c=${encodeURIComponent(JSON.stringify(profesiChartConfig))}`;
              const pQcRes = await fetch(pQcUrl);
              if (pQcRes.ok) {
                const buffer = await pQcRes.arrayBuffer();
                const imgId2 = workbook.addImage({ buffer, extension: 'png' });
                sheet.addImage(imgId2, {
                  tl: { col: 8, row: reportData.length + 6 } as any,
                  br: { col: 14, row: reportData.length + 26 } as any
                });
              }
            } catch (e) {
              console.warn('Gagal load chart profesi APD', e);
            }
          }
        }

      } else if (type === 'b3') {
        let h1 = "", h2 = "";
        if (activeB3Tab === "a") { h1 = "Penyimpanan terpisah B3"; h2 = "Ketersediaan SDS"; }
        else if (activeB3Tab === "b") { h1 = "Ketersediaan Spill Kit"; h2 = "Kelengkapan Spill Kit"; }
        else { h1 = "Eyewasher berfungsi baik"; h2 = "Bodywasher berfungsi baik"; }

        const cols: any[] = [
          { key: 'no', width: 5 },
          { key: 'ruangan', width: 25 }
        ];

        if (activeB3Tab === "a") {
          cols.push({ key: 'seh', width: 15 }, { key: 'ter', width: 15 });
        } else if (activeB3Tab === "c") {
          cols.push({ key: 'eye', width: 15 }, { key: 'body', width: 15 });
        }

        cols.push(
          { key: 'p1_1', width: 15 },
          { key: 'p1_2', width: 15 },
          { key: 'p2_1', width: 15 },
          { key: 'p2_2', width: 15 },
          { key: 'rata', width: 15 },
          { key: 'keterangan', width: 30 }
        );
        sheet.columns = cols;

        let row1 = ['No', 'Ruangan'];
        let row2 = ['', ''];
        let mCols = 2; // offset for merging

        if (activeB3Tab === "a") {
          row1.push('Seharusnya', 'Terlihat');
          row2.push('Jumlah Lemari B3', 'Jumlah Lemari B3');
          mCols += 2;
        } else if (activeB3Tab === "c") {
          row1.push('Jumlah Eyewasher', 'Jumlah Bodywasher');
          row2.push('', '');
          mCols += 2;
        }

        row1.push(h1, '', h2, '', 'Rata-rata (%)', 'Keterangan');
        row2.push('Patroli 1', 'Patroli 2', 'Patroli 1', 'Patroli 2', '', '');

        sheet.addRow(row1);
        sheet.addRow(row2);

        sheet.mergeCells('A1:A2');
        sheet.mergeCells('B1:B2');

        if (activeB3Tab === "c") {
          sheet.mergeCells(1, 3, 2, 3);
          sheet.mergeCells(1, 4, 2, 4);
        }

        sheet.mergeCells(1, mCols + 1, 1, mCols + 2);
        sheet.mergeCells(1, mCols + 3, 1, mCols + 4);
        sheet.mergeCells(1, mCols + 5, 2, mCols + 5);
        sheet.mergeCells(1, mCols + 6, 2, mCols + 6);

        sheet.getRow(1).font = { bold: true };
        sheet.getRow(2).font = { bold: true };
        sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(2).alignment = { horizontal: 'center', vertical: 'middle' };

        b3ReportData.forEach((row, i) => {
          const rowData: any = {
            no: i + 1,
            ruangan: row.ruangan,
            keterangan: activeB3Tab === "c" ? row.keteranganC : row.keteranganA,
          };
          if (activeB3Tab === "a") {
            rowData.seh = row.seharusnyaLemari;
            rowData.ter = row.terlihatLemari;
          } else if (activeB3Tab === "c") {
            rowData.eye = row.eyewasher;
            rowData.body = row.bodywasher;
          }

          let totalExpected = 0;
          let compliantCount = 0;

          const getExpected = () => {
             if (activeB3Tab === "a") return row.seharusnyaLemari > 0 ? row.seharusnyaLemari : (parseInt(String(row.terlihatLemari), 10) || 0);
             if (activeB3Tab === "c") return parseInt(String(row.eyewasher), 10) || 0;
             return 1;
          };
          const expectedQ1 = getExpected();
          const getExpectedQ2 = () => {
             if (activeB3Tab === "a") return row.seharusnyaLemari > 0 ? row.seharusnyaLemari : (parseInt(String(row.terlihatLemari), 10) || 0);
             if (activeB3Tab === "c") return parseInt(String(row.bodywasher), 10) || 0;
             return 1;
          };
          const expectedQ2 = getExpectedQ2();

          [0, 1].forEach((colIdx) => {
            const p = row.patrols[colIdx];
            let ans: string | number = "-";
            if (p) {
              const labelToMatch = activeB3Tab === "a" ? "Penyimpanan B3" : activeB3Tab === "b" ? "Ketersediaan Spill Kit" : "Eyewasher";
              const answerObj = p.answers.find((a: any) => a.label.includes(labelToMatch));
              const rawAns = answerObj ? answerObj.jawaban : "-";
              
              if (rawAns !== "-" && rawAns !== "N/A" && rawAns !== "") {
                totalExpected += expectedQ1;
                if (rawAns === "Ya") {
                  ans = expectedQ1;
                  compliantCount += expectedQ1;
                } else if (rawAns === "Tidak") {
                  const nonCompliant = (p.tags && p.tags.length > 0) ? p.tags.length : expectedQ1;
                  ans = Math.max(0, expectedQ1 - nonCompliant);
                  compliantCount += ans;
                }
              } else {
                ans = rawAns;
              }
            }
            rowData[`p1_${colIdx + 1}`] = ans;
          });

          [0, 1].forEach((colIdx) => {
            const p = row.patrols[colIdx];
            let ans: string | number = "-";
            if (p) {
              const labelToMatch = activeB3Tab === "a" ? "Ketersediaan SDS" : activeB3Tab === "b" ? "Kelengkapan Spill Kit" : "Bodywasher";
              const answerObj = p.answers.find((a: any) => a.label.includes(labelToMatch));
              const rawAns = answerObj ? answerObj.jawaban : "-";

              if (rawAns !== "-" && rawAns !== "N/A" && rawAns !== "") {
                totalExpected += expectedQ2;
                if (rawAns === "Ya") {
                  ans = expectedQ2;
                  compliantCount += expectedQ2;
                } else if (rawAns === "Tidak") {
                  const nonCompliant = (p.tags && p.tags.length > 0) ? p.tags.length : expectedQ2;
                  ans = Math.max(0, expectedQ2 - nonCompliant);
                  compliantCount += ans;
                }
              } else {
                ans = rawAns;
              }
            }
            rowData[`p2_${colIdx + 1}`] = ans;
          });

          rowData.rata = totalExpected > 0 ? ((compliantCount / totalExpected) * 100).toFixed(0) + "%" : "-";

          sheet.addRow(rowData);
        });

        const rowPct: any = { ruangan: 'Persentase (%)' };

        b3Summary?.forEach((s, i) => {
          let colKey = i < 2 ? `p1_${i + 1}` : `p2_${i - 1}`;
          const t = s.ya + s.tidak;
          rowPct[colKey] = t > 0 ? `${s.ya} (${((s.ya / t) * 100).toFixed(0)}%)` : "0%";
        });

        let totalYa = 0, totalAns = 0;
        b3Summary?.forEach(s => {
          totalYa += s.ya;
          totalAns += (s.ya + s.tidak);
        });
        rowPct['rata'] = totalAns > 0 ? `${totalYa} (${((totalYa / totalAns) * 100).toFixed(0)}%)` : "-";

        sheet.addRow(rowPct);

        const rowCombined: any = { ruangan: 'Total Rata-rata 📊 (P1 + P2)' };
        if (b3Summary && b3Summary.length >= 4) {
          const s1 = b3Summary[0];
          const s2 = b3Summary[1];
          const t1 = s1.ya + s1.tidak + s2.ya + s2.tidak;
          rowCombined['p1_1'] = t1 > 0 ? `${s1.ya + s2.ya} (${(((s1.ya + s2.ya) / t1) * 100).toFixed(0)}%)` : "0%";
          
          const s3 = b3Summary[2];
          const s4 = b3Summary[3];
          const t2 = s3.ya + s3.tidak + s4.ya + s4.tidak;
          rowCombined['p2_1'] = t2 > 0 ? `${s3.ya + s4.ya} (${(((s3.ya + s4.ya) / t2) * 100).toFixed(0)}%)` : "0%";
        }
        sheet.addRow(rowCombined);

        // --- CHART B3 ---
        const b3Labels = [`${h1} (P1)`, `${h1} (P2)`, `${h2} (P1)`, `${h2} (P2)`];
        const b3Data = [
          b3Summary && b3Summary[0] ? (b3Summary[0].ya + b3Summary[0].tidak > 0 ? Number(((b3Summary[0].ya / (b3Summary[0].ya + b3Summary[0].tidak)) * 100).toFixed(0)) : 0) : 0,
          b3Summary && b3Summary[1] ? (b3Summary[1].ya + b3Summary[1].tidak > 0 ? Number(((b3Summary[1].ya / (b3Summary[1].ya + b3Summary[1].tidak)) * 100).toFixed(0)) : 0) : 0,
          b3Summary && b3Summary[2] ? (b3Summary[2].ya + b3Summary[2].tidak > 0 ? Number(((b3Summary[2].ya / (b3Summary[2].ya + b3Summary[2].tidak)) * 100).toFixed(0)) : 0) : 0,
          b3Summary && b3Summary[3] ? (b3Summary[3].ya + b3Summary[3].tidak > 0 ? Number(((b3Summary[3].ya / (b3Summary[3].ya + b3Summary[3].tidak)) * 100).toFixed(0)) : 0) : 0
        ];

        const chartConfig = {
          type: 'bar',
          data: {
            labels: b3Labels,
            datasets: [{
              label: 'Kepatuhan (%)',
              data: b3Data,
              backgroundColor: b3Data.map(d => d >= 90 ? '#199e70' : '#d03b3b')
            }]
          },
          options: {
            title: { display: true, text: 'Rata-rata Kepatuhan', fontSize: 16 },
            scales: { yAxes: [{ ticks: { min: 0, max: 100 } }] },
            plugins: {
              datalabels: { anchor: 'end', align: 'bottom', formatter: (value: any) => value + '%' }
            }
          }
        };

        try {
          const qcUrl = `https://quickchart.io/chart?w=600&h=300&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
          const qcRes = await fetch(qcUrl);
          if (qcRes.ok) {
            const buffer = await qcRes.arrayBuffer();
            const imageId = workbook.addImage({ buffer, extension: 'png' });
            sheet.addImage(imageId, {
              tl: { col: 1, row: b3ReportData.length + 5 } as any,
              br: { col: 7, row: b3ReportData.length + 21 } as any
            });
          }
        } catch (e) {
          console.warn('Gagal load chart B3', e);
        }

      } else if (type === 'elektrik') {
        const cols: any[] = [
          { key: 'no', width: 5 },
          { key: 'tanggal', width: 15 },
          { key: 'petugas', width: 20 },
          { key: 'ruangan', width: 25 },
        ];

        for (let i = 1; i <= 10; i++) {
          cols.push({ key: `p${i}_a`, width: 12 });
          cols.push({ key: `p${i}_b`, width: 12 });
        }
        cols.push({ key: 'rata', width: 15 });
        cols.push({ key: 'keterangan', width: 30 });

        sheet.columns = cols;

        let row1 = ['No', 'Tanggal', 'Nama Petugas', 'Ruangan'];
        let row2 = ['', '', '', ''];

        for (let i = 1; i <= 10; i++) {
          row1.push(`Patroli Ke-${i}`, '');
          row2.push('Kabel', 'Sambungan');
        }

        row1.push('Rata-rata', 'Keterangan');
        row2.push('', '');

        sheet.addRow(row1);
        sheet.addRow(row2);

        sheet.mergeCells('A1:A2');
        sheet.mergeCells('B1:B2');
        sheet.mergeCells('C1:C2');
        sheet.mergeCells('D1:D2');

        let startCol = 5;
        for (let i = 1; i <= 10; i++) {
          sheet.mergeCells(1, startCol, 1, startCol + 1);
          startCol += 2;
        }
        sheet.mergeCells(1, startCol, 2, startCol); // Rata-rata
        sheet.mergeCells(1, startCol + 1, 2, startCol + 1); // Keterangan

        sheet.getRow(1).font = { bold: true };
        sheet.getRow(2).font = { bold: true };
        sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(2).alignment = { horizontal: 'center', vertical: 'middle' };

        elektrikReportData.forEach((row, i) => {
          const rowData: any = {
            no: i + 1,
            tanggal: row.tanggal,
            petugas: row.namaPetugas,
            ruangan: row.ruangan,
            keterangan: row.keterangan,
          };

          let yaCount = 0;
          let totalCount = 0;

          row.patrols.forEach((p: any, colIdx: number) => {
            let jawA = "-";
            let jawB = "-";
            if (p) {
              const ansA = p.answers.find((a: any) => a.label.includes("Perkabelan aman"))?.jawaban;
              const ansB = p.answers.find((a: any) => a.label.toLowerCase().includes("sambungan listrik aman"))?.jawaban;
              jawA = ansA || "-";
              jawB = ansB || "-";

              if (jawA === "Ya") { yaCount++; totalCount++; } else if (jawA === "Tidak") { totalCount++; }
              if (jawB === "Ya") { yaCount++; totalCount++; } else if (jawB === "Tidak") { totalCount++; }
            }
            rowData[`p${colIdx + 1}_a`] = jawA;
            rowData[`p${colIdx + 1}_b`] = jawB;
          });

          rowData.rata = totalCount > 0 ? ((yaCount / totalCount) * 100).toFixed(0) + "%" : "-";
          sheet.addRow(rowData);
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const tabName = type === 'apd' ? activeApdTab : type === 'b3' ? activeB3Tab : '';
      await downloadWithSavePrompt(blob, `K3_RSOMH_DETAIL_${type.toUpperCase()}${tabName ? '_' + tabName : ''}_${bulan}.xlsx`);
    } catch (e) {
      console.error(e);
      alert('Gagal membuat Excel.');
    } finally {
      setDownloading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!data || data.submissions.length === 0) return;

    setDownloading(true);
    try {

      // We get the rendered table from DOM for autotable
      const doc = new jsPDF("landscape");

      // Header setup with Logos
      const pageWidth = doc.internal.pageSize.getWidth();

      // Add logos
      const tryAddLogo = (src: string, x: number, y: number, w: number, h: number) => {
        try {
          const img = new Image();
          img.src = src;
          doc.addImage(img, 'PNG', x, y, w, h);
        } catch (e) {
          // Ignored
        }
      };

      // Add logos on the right
      // RSOMH paling kanan
      tryAddLogo(window.location.origin + '/RSOMH_logo.png', pageWidth - 54, 12, 40, 14);
      // K3 di sebelah kirinya RSOMH
      tryAddLogo(window.location.origin + '/K3_logo.png', pageWidth - 78, 9, 20, 20);

      // Text di kiri
      doc.setFontSize(14);
      doc.text(`Laporan Patroli K3 - ${moduleDef.title}`, 14, 20);
      doc.setFontSize(10);
      doc.text(`Bulan: ${formatBulan(bulan)}${ruangan ? ` | Ruangan: ${ruangan}` : ""}`, 14, 28);

      let startY = 35;

      // Capture Chart if exists
      const chartEl = document.getElementById("chart-per-pertanyaan");
      if (chartEl && !moduleDef.logOnly) {
        try {
          const html2canvas = (await import("html2canvas")).default;
          // Memberi sedikit waktu jika chart baru selesai dirender
          await new Promise(r => setTimeout(r, 500));
          const canvas = await html2canvas(chartEl, { scale: 2, backgroundColor: "#ffffff" });
          const imgData = canvas.toDataURL("image/png");

          const imgWidth = pageWidth - 28; // 14px padding left and right
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          doc.addImage(imgData, "PNG", 14, startY, imgWidth, imgHeight);
          startY += imgHeight + 10;

          // Ensure enough space for the table, otherwise add new page
          if (startY > doc.internal.pageSize.getHeight() - 40) {
            doc.addPage();
            startY = 20;
          }
        } catch (e) {
          console.warn("Failed to capture chart for PDF", e);
        }
      }

      // Capture Profesi Chart if APD
      const profesiEl = document.getElementById("chart-profesi-melanggar");
      if (profesiEl && slug === "apd") {
        try {
          const html2canvas = (await import("html2canvas")).default;
          const canvas = await html2canvas(profesiEl, { scale: 2, backgroundColor: "#ffffff" });
          const imgData = canvas.toDataURL("image/png");

          const imgWidth = pageWidth - 28;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          if (startY + imgHeight > doc.internal.pageSize.getHeight() - 40) {
            doc.addPage();
            startY = 20;
          }

          doc.addImage(imgData, "PNG", 14, startY, imgWidth, imgHeight);
          startY += imgHeight + 10;

          if (startY > doc.internal.pageSize.getHeight() - 40) {
            doc.addPage();
            startY = 20;
          }
        } catch (e) {
          console.warn("Failed to capture profesi chart for PDF", e);
        }
      }

      // @ts-ignore
      doc.autoTable({
        html: '#submission-table',
        startY: startY,
        styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' }, // Wrap text
        headStyles: { fillColor: [183, 28, 28] }, // B71C1C
        theme: 'grid',
        didParseCell: function (data: any) {
          const isSosialisasi = moduleDef.slug === "sosialisasi";

          // Handle footer
          if (!isSosialisasi && data.row.section === 'foot') {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [255, 243, 224]; // FFF3E0
            data.cell.styles.textColor = [0, 0, 0]; // Ensure text is visible
            if (data.column.index === 0) {
              data.cell.styles.halign = 'right';
              data.cell.styles.textColor = [183, 28, 28]; // Dark red
            }
          }

          // Handle body for raw URLs
          if (data.section === 'body') {
            const rawEl = data.cell.raw;
            if (rawEl && rawEl.hasAttribute && rawEl.hasAttribute('data-photo-url')) {
              const photoUrl = rawEl.getAttribute('data-photo-url');
              if (photoUrl) {
                // Karena jsPDF tidak otomatis memotong string panjang tanpa spasi,
                // kita potong URL secara manual menjadi potongan maksimal 30 karakter per baris.
                const urlLines: string[] = [];
                for (let i = 0; i < photoUrl.length; i += 30) {
                  urlLines.push(photoUrl.substring(i, i + 30));
                }

                data.cell.text = data.cell.text.flatMap((line: string) => {
                  if (line.includes("Lihat Foto")) {
                    return [line.replace(/📷 Lihat Foto|Lihat Foto/g, "URL Foto:"), ...urlLines];
                  }
                  return [line];
                });
              }
            }
          }
        }
      });

      if (!moduleDef.logOnly) {
        // @ts-ignore
        const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : startY + 20;
        const legendText = "Catatan: N/A (Not Applicable) pada tabel di atas menandakan bahwa item pertanyaan tersebut tidak tersedia, tidak dibutuhkan, atau tidak berlaku di ruangan/lokasi yang bersangkutan. Data N/A dikeluarkan dari perhitungan persentase kepatuhan (baik pembilang maupun penyebut) agar tidak mendistorsi hasil penilaian ruangan.";

        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);

        const splitText = doc.splitTextToSize(legendText, doc.internal.pageSize.getWidth() - 28);

        let legendY = finalY + 8;
        if (legendY + (splitText.length * 4) > doc.internal.pageSize.getHeight() - 10) {
          doc.addPage();
          legendY = 20;
        }

        doc.text(splitText, 14, legendY);
      }

      doc.save(`K3_RSOMH_${slug.toUpperCase()}_${bulan}.pdf`);
    } catch (e) {
      console.error(e);
      alert("Gagal mengekspor PDF.");
    } finally {
      setDownloading(false);
    }
  };

  // Invalid slug
  if (!moduleDef) {
    return (
      <div className="p-8 text-center">
        <div className="card p-10 max-w-sm mx-auto">
          <div className="text-4xl mb-3">❓</div>
          <p className="text-red-500 font-semibold mb-1">Topik tidak ditemukan</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            Slug <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded">{slug}</code> tidak ada dalam daftar.
          </p>
          <Link href="/" className="btn-primary">← Kembali ke Dashboard</Link>
        </div>
      </div>
    );
  }

  // Get unique locations from submissions for filter dropdown
  const uniqueLocations = data
    ? Array.from(new Set(data.submissions.map((s) => s.location))).sort()
    : [];

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* ── Keterangan Popup Modal ── */}
      {keteranganPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setKeteranganPopup(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full p-6 relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base flex items-center gap-2">
                <span>📋</span> Detail Keterangan / Temuan
              </h3>
              <button
                onClick={() => setKeteranganPopup(null)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl font-bold leading-none"
              >
                ×
              </button>
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto bg-gray-50 dark:bg-slate-900/50 rounded-lg p-4">
              {keteranganPopup.split(" ; ").map((part, idx) => (
                <div key={idx} className={`${idx > 0 ? "mt-3 pt-3 border-t border-gray-200 dark:border-slate-700" : ""}`}>
                  <span className="font-semibold text-indigo-700 dark:text-indigo-400">{part.match(/^P\d+:/) ? part.split(":")[0] + ":" : ""}</span>
                  <span>{part.match(/^P\d+:/) ? part.substring(part.indexOf(":") + 1) : part}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/" className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-sm">
          ← Dashboard
        </Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <span>{moduleDef.icon}</span>
          {moduleDef.title}
        </h1>
        <span className="badge-blue">{moduleDef.group}</span>
        {moduleDef.logOnly && (
          <span className="badge-warning">Log Kegiatan (Tidak ada skor)</span>
        )}
      </div>

      {/* ── Filter bar ── */}
      <div className="card p-4 flex items-center flex-wrap gap-3">
        {/* Month */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Bulan:</label>
          <input
            type="month"
            value={bulan}
            onChange={(e) => setBulan(e.target.value)}
            className="form-control h-9"
            id="filter-bulan"
          />
          <LockMonthButton bulan={bulan} infoOnlyMode={true} />
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 dark:text-gray-400">Tgl:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="form-control h-9"
            id="filter-start-date"
          />
          <span className="text-gray-400 dark:text-gray-500 text-xs">–</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="form-control h-9"
            id="filter-end-date"
          />
        </div>

        {/* Ruangan filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Ruangan:</label>
          <select
            value={ruangan}
            onChange={(e) => setRuangan(e.target.value)}
            className="form-control h-9"
            id="filter-ruangan"
          >
            <option value="">Semua</option>
            {uniqueLocations.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="btn-ghost text-xs"
            id="btn-refresh"
          >
            {loading ? "⏳" : "🔄"} Refresh
          </button>
          {!moduleDef.logOnly && (
            <button
              onClick={handleGenerateSummary}
              disabled={generatingAi || loading || !data?.submissions.length}
              className="btn-primary bg-indigo-600 hover:bg-indigo-700 text-xs disabled:opacity-50 border-indigo-600 hover:border-indigo-700 shadow-md shadow-indigo-500/20"
            >
              {generatingAi ? "⏳" : "✨"} AI Summary
            </button>
          )}
          {!moduleDef.logOnly && (
            <button
              onClick={handleExportExcel}
              disabled={downloading || loading || !data?.submissions.length}
              className="btn-success text-xs disabled:opacity-50"
              id="btn-export-excel"
            >
              {downloading ? "⏳" : "📊"} Excel
            </button>
          )}
          <button
            onClick={handleExportPDF}
            disabled={downloading || loading || !data?.submissions.length}
            className="btn-primary text-xs disabled:opacity-50"
            id="btn-export-pdf"
          >
            📄 PDF
          </button>
        </div>
      </div>

      {/* ── AI Summary Result ── */}
      {(aiSummary || generatingAi) && (
        <div className="card p-5 border-l-4 border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-indigo-600 dark:text-indigo-400 text-lg">✨</span>
            <h3 className="font-bold text-gray-800 dark:text-gray-100">Ringkasan Eksekutif AI</h3>
          </div>
          {generatingAi ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-full"></div>
              <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-5/6"></div>
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
                  <input
                    type="text"
                    value={aiContext}
                    onChange={(e) => setAiContext(e.target.value)}
                    placeholder="Contoh: Fokuskan pada temuan di Ruang UGD..."
                    className="form-control text-sm w-full bg-white dark:bg-slate-800"
                    disabled={generatingAi}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleGenerateSummary();
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

      {/* ── Error ── */}
      {error && (
        <div className="card p-6 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800/50 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-red-600 dark:text-red-400 font-semibold mb-1">Gagal Memuat Data</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">{error}</p>
          <button onClick={fetchData} className="btn-primary">Coba Lagi</button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && !data && !error && <LoadingScreen />}

      {/* ── Summary card (gauge + stats) ── */}
      {!moduleDef.logOnly && data && !loading && (
        <div className={`grid grid-cols-1 ${data.trendData && data.trendData.length > 0 && ((startDate && endDate) || data.trendData.length > 1) ? 'lg:grid-cols-2' : ''} gap-4 mb-6`}>
          <div className="card p-6">
            <div className="flex items-center gap-8 flex-wrap h-full">
              <GaugeChart pct={slug === "apd" ? apdGaugePct : (slug === "b3" ? b3OverallPct : data.totalPct)} size={160} />
              <div className="flex-1 space-y-3 min-w-[200px]">
                <div>
                  <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                    {data.module.icon} {data.module.title}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {startDate && endDate
                      ? `Periode ${formatTanggal(startDate)} - ${formatTanggal(endDate)}`
                      : `Bulan ${formatBulan(bulan)}`
                    } ·{" "}
                    <strong>{data.submissionCount}</strong> submission
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                    <div className="text-xl font-black text-gray-800 dark:text-gray-100">
                      {data.submissionCount}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Submission</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                    <div className="text-xl font-black text-green-700 dark:text-green-400">
                      {data.questionResults.filter((q) => q.pct !== null && q.pct >= (q.targetPct ?? 90)).length}
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-500">Pertanyaan Patuh</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
                    <div className="text-xl font-black text-red-700 dark:text-red-400">
                      {data.questionResults.filter((q) => q.pct !== null && q.pct < (q.targetPct ?? 90)).length}
                    </div>
                    <div className="text-xs text-red-600 dark:text-red-500">Perlu Perhatian</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trend Chart (Conditional) */}
          {data.trendData && data.trendData.length > 0 && ((startDate && endDate) || data.trendData.length > 1) && (
            <div className="h-full">
              <TrendChart data={data.trendData} />
            </div>
          )}
        </div>
      )}

      {/* ── Per-question cards ── */}
      {!moduleDef.logOnly && data && !loading && (
        <section aria-label="Detail Per Pertanyaan" id="chart-per-pertanyaan" className="bg-white dark:bg-slate-900 rounded-2xl p-2">
          <h2 className="section-label mb-3 ml-4 mt-2">📊 Kepatuhan Per Pertanyaan</h2>
          {customQuestionResults.length ? (
            <QuestionHorizontalChart data={customQuestionResults} moduleSlug={slug} />
          ) : (
            <div className="card p-6 text-center text-gray-400 dark:text-gray-500">
              Tidak ada data pertanyaan untuk periode ini.
            </div>
          )}
        </section>
      )}

      {/* ── APD Profesi Chart ── */}
      {slug === "apd" && data && !loading && (
        <section aria-label="Statistik Profesi Melanggar" id="chart-profesi-melanggar" className="bg-white dark:bg-slate-900 rounded-2xl p-2 mt-4">
          <ApdProfesiChart submissions={data.submissions} />
        </section>
      )}

      {/* ── Submission table ── */}
      {slug !== "elektrik" && slug !== "apd" && slug !== "b3" && (
        <section aria-label="Detail Submission">
          <h2 className="section-label mb-3">📋 Detail Submission {slug === "pcra" && "(Semua Data)"}</h2>
          {!loading && (
            <div className="card overflow-hidden">
              {!data?.submissions.length ? (
                <div className="p-10 text-center text-gray-400 dark:text-gray-500">
                  <div className="text-4xl mb-3">📭</div>
                  <p>Belum ada data untuk periode ini.</p>
                </div>
              ) : (
                <div className="card-body">
                  <SubmissionTable
                    moduleDef={moduleDef}
                    submissions={data.submissions}
                    questionResults={data.questionResults}
                    totalPct={data.totalPct}
                    masterData={masterData}
                  />
                  {!moduleDef.logOnly && (
                    <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                      <strong>Catatan:</strong> N/A (Not Applicable) pada tabel di atas menandakan bahwa item pertanyaan tersebut tidak tersedia, tidak dibutuhkan, atau tidak berlaku di ruangan/lokasi yang bersangkutan. Data N/A dikeluarkan dari perhitungan persentase kepatuhan (baik pembilang maupun penyebut) agar tidak mendistorsi hasil penilaian ruangan.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Elektrik Tabbed Tables ── */}
      {slug === "elektrik" && !loading && data && (
        <section aria-label="Laporan Detail Elektrik" className="mt-8">
          <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
            <h2 className="section-label mb-0">📄 Laporan Detail Elektrik (Harian)</h2>
            <button
              onClick={() => handleExportDetailExcel('elektrik')}
              disabled={downloading}
              className="btn-success text-xs shadow-sm py-2 px-3 whitespace-nowrap rounded-md"
            >
              {downloading ? "⏳" : "📊"} Excel
            </button>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto p-4">
              <table className="data-table text-sm w-full text-left min-w-[1200px]">
                <thead>
                  <tr>
                    <th rowSpan={2} className="w-12 text-center align-middle border-r border-gray-200 dark:border-slate-700">No</th>
                    <th rowSpan={2} className="w-32 align-middle border-r border-gray-200 dark:border-slate-700">Tanggal</th>
                    <th rowSpan={2} className="w-40 align-middle border-r border-gray-200 dark:border-slate-700">Nama Petugas</th>
                    <th rowSpan={2} className="w-48 align-middle border-r border-gray-200 dark:border-slate-700">Ruangan</th>
                    {[...Array(10)].map((_, i) => (
                      <th key={i} colSpan={2} className="text-center bg-gray-50 dark:bg-slate-800 border-b border-r border-gray-200 dark:border-slate-700">
                        Patroli Ke-{i + 1}
                      </th>
                    ))}
                    <th rowSpan={2} className="w-24 text-center align-middle bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300 border-r border-gray-200 dark:border-slate-700">Rata-rata</th>
                    <th rowSpan={2} className="w-48 align-middle">Keterangan</th>
                  </tr>
                  <tr>
                    {[...Array(10)].map((_, i) => (
                      <Fragment key={`sub-${i}`}>
                        <th className="w-20 text-center text-[10px] uppercase bg-blue-50/50 dark:bg-blue-900/10 border-r border-gray-200 dark:border-slate-700" title="Perkabelan aman">Kabel</th>
                        <th className="w-20 text-center text-[10px] uppercase bg-emerald-50/50 dark:bg-emerald-900/10 border-r border-gray-200 dark:border-slate-700" title="Sambungan listrik aman">Sambungan</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {elektrikReportData.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      <td className="text-center font-medium text-gray-500 border-r border-gray-200 dark:border-slate-700">{i + 1}</td>
                      <td className="whitespace-nowrap text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-slate-700">{row.tanggal}</td>
                      <td className="text-gray-700 dark:text-gray-300 truncate max-w-[150px] border-r border-gray-200 dark:border-slate-700">{row.namaPetugas}</td>
                      <td className="font-medium text-gray-800 dark:text-gray-100 truncate border-r border-gray-200 dark:border-slate-700">{row.ruangan}</td>

                      {[...Array(10)].map((_, colIdx) => {
                        const p = row.patrols[colIdx];
                        let jawA = "-";
                        let jawB = "-";
                        if (p) {
                          const ansA = p.answers.find((a: any) => a.label.includes("Perkabelan aman"));
                          const ansB = p.answers.find((a: any) => a.label.toLowerCase().includes("sambungan listrik aman"));
                          jawA = ansA ? ansA.jawaban : "-";
                          jawB = ansB ? ansB.jawaban : "-";
                        }

                        const getBadge = (jawaban: string) => {
                          if (jawaban === "Ya") return "text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded font-medium text-xs";
                          if (jawaban === "Tidak") return "text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded font-medium text-xs";
                          if (jawaban === "N/A") return "text-gray-600 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-medium text-xs";
                          return "text-gray-400 text-xs";
                        };

                        return (
                          <Fragment key={colIdx}>
                            <td className="text-center border-r border-gray-200 dark:border-slate-700">
                              {p ? <span className={getBadge(jawA)}>{jawA || "-"}</span> : <span className="text-gray-300">-</span>}
                            </td>
                            <td className="text-center border-r border-gray-200 dark:border-slate-700">
                              {p ? <span className={getBadge(jawB)}>{jawB || "-"}</span> : <span className="text-gray-300">-</span>}
                            </td>
                          </Fragment>
                        );
                      })}

                      {(() => {
                        let yaCount = 0;
                        let totalCount = 0;
                        row.patrols.forEach((p: any) => {
                          if (p) {
                            const ansA = p.answers.find((a: any) => a.label.includes("Perkabelan aman"))?.jawaban;
                            const ansB = p.answers.find((a: any) => a.label.toLowerCase().includes("sambungan listrik aman"))?.jawaban;
                            if (ansA === "Ya") { yaCount++; totalCount++; } else if (ansA === "Tidak") { totalCount++; }
                            if (ansB === "Ya") { yaCount++; totalCount++; } else if (ansB === "Tidak") { totalCount++; }
                          }
                        });
                        const avgText = totalCount > 0 ? ((yaCount / totalCount) * 100).toFixed(0) + "%" : "-";

                        return (
                          <td className="text-center font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10 border-r border-gray-200 dark:border-slate-700">
                            {avgText}
                          </td>
                        );
                      })()}

                      <td className="text-xs max-w-[150px]">
                        {row.keterangan && row.keterangan !== "-" ? (
                          <button
                            onClick={() => setKeteranganPopup(row.keterangan)}
                            className="text-left text-blue-600 dark:text-blue-400 underline underline-offset-2 truncate block w-full hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                            title="Klik untuk lihat selengkapnya"
                          >
                            {row.keterangan.length > 40 ? row.keterangan.substring(0, 40) + "…" : row.keterangan}
                          </button>
                        ) : <span className="text-gray-400">-</span>}
                      </td>
                    </tr>
                  ))}
                  {elektrikReportData.length === 0 && (
                    <tr>
                      <td colSpan={25} className="text-center p-8 text-gray-500">
                        Tidak ada data ruangan di Master Data.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-indigo-50 dark:bg-indigo-900/20 font-bold text-indigo-700 dark:text-indigo-400">
                    <td colSpan={4} className="text-right p-2 border-r border-gray-200 dark:border-slate-700">Persentase (%)</td>
                    {elektrikSummary?.map((s, i) => {
                      const total = s.ya + s.tidak;
                      return (
                        <td key={i} className="text-center p-2 border-r border-gray-200 dark:border-slate-700">
                          {total > 0 ? ((s.ya / total) * 100).toFixed(0) + "%" : "-"}
                        </td>
                      );
                    })}
                    <td className="text-center font-bold bg-indigo-100/80 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 border-r border-gray-200 dark:border-slate-700">
                      {(() => {
                        const totalYa = elektrikSummary?.reduce((acc, curr) => acc + curr.ya, 0) || 0;
                        const totalAll = elektrikSummary?.reduce((acc, curr) => acc + curr.ya + curr.tidak, 0) || 0;
                        return totalAll > 0 ? ((totalYa / totalAll) * 100).toFixed(0) + "%" : "-";
                      })()}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── APD Tabbed Tables ── */}
      {slug === "apd" && !loading && data && (
        <section aria-label="Laporan APD" className="mt-8">
          <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
            <h2 className="section-label mb-0">📄 Laporan Detail APD</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-lg">
                <button
                  onClick={() => setActiveApdTab("ketersediaan")}
                  className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${activeApdTab === "ketersediaan"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                >
                  a. Ketersediaan Terpenuhi
                </button>
                <button
                  onClick={() => setActiveApdTab("kepatuhan")}
                  className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${activeApdTab === "kepatuhan"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                >
                  b. Karyawan Menggunakan Sesuai
                </button>
              </div>
              <button
                onClick={() => handleExportDetailExcel('apd')}
                disabled={downloading}
                className="btn-success text-xs shadow-sm h-full py-2 px-3 whitespace-nowrap rounded-md"
              >
                {downloading ? "⏳" : "📊"} Excel
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto p-4">
              <table className="data-table text-sm w-full text-left min-w-[1200px]">
                <thead>
                  <tr>
                    <th className="w-12 text-center">No</th>
                    <th className="w-32">Tanggal</th>
                    <th className="w-40">Nama Petugas</th>
                    <th className="w-48">Ruangan</th>
                    <th className="w-24 text-center">Jumlah Pegawai</th>
                    {[...Array(10)].map((_, i) => (
                      <th key={i} className="w-20 text-center">Patroli Ke-{i + 1}</th>
                    ))}
                    {activeApdTab === "ketersediaan" ? (
                      <th className="w-24 text-center bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300">Rata-rata</th>
                    ) : (
                      <>
                        <th className="w-24 text-center bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300">Total Patuh</th>
                        <th className="w-24 text-center bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300">Total Tidak Patuh</th>
                      </>
                    )}
                    <th className="w-48">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((row, i) => (
                    <tr key={i} className={`hover:bg-gray-50 dark:hover:bg-slate-800/50 ${row.isProfesi ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}>
                      <td className="text-center font-medium text-gray-500">{i + 1}</td>
                      <td className="whitespace-nowrap text-gray-600 dark:text-gray-300">{row.tanggal}</td>
                      <td className="text-gray-700 dark:text-gray-300 truncate max-w-[150px]">{row.namaPetugas}</td>
                      <td className="font-medium text-gray-800 dark:text-gray-100 truncate">
                        {row.isProfesi ? <span className="text-blue-700 dark:text-blue-400 font-bold">{row.ruangan.substring(2)} (Profesi)</span> : row.ruangan}
                      </td>
                      <td className="text-center font-semibold text-gray-700 dark:text-gray-300">{row.jumlahKaryawan}</td>

                      {[...Array(10)].map((_, colIdx) => {
                        const p = row.patrols[colIdx];

                        if (activeApdTab === "ketersediaan") {
                          let ketersediaan = "-";
                          if (p) {
                            const answerObj = p.answers.find((a: any) => a.label === "Ketersediaan terpenuhi" || a.label.includes("Ketersediaan"));
                            ketersediaan = answerObj ? answerObj.jawaban : "-";
                          }

                          let badgeColor = "text-gray-400";
                          if (ketersediaan === "Ya") badgeColor = "text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded";
                          if (ketersediaan === "Tidak") badgeColor = "text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded";

                          return (
                            <td key={colIdx} className="text-center font-medium">
                              {p ? <span className={badgeColor}>{ketersediaan || "-"}</span> : <span className="text-gray-300">-</span>}
                            </td>
                          );
                        } else {
                          let valDisplay = "-";
                          let kepatuhan = 0;
                          if (p) {
                            if (row.jumlahKaryawan > 0) {
                              const ansObj = p.answers.find((a: any) => a.label.includes("menggunakan APD") || a.label.includes("Kepatuhan"));
                              const rawAns = ansObj ? ansObj.jawaban : "-";
                              
                              if (rawAns !== "-" && rawAns !== "N/A" && rawAns !== "") {
                                let nonCompliantCount = 0;
                                if (rawAns === "Tidak") {
                                  const tagsCount = (p.tags || []).filter((t: string) => t.trim() !== "").length;
                                  nonCompliantCount = tagsCount > 0 ? tagsCount : 1;
                                }
                                let compliant = row.jumlahKaryawan - nonCompliantCount;
                                if (compliant < 0) compliant = 0;
                                valDisplay = compliant.toString();
                                kepatuhan = (compliant / row.jumlahKaryawan) * 100;
                              } else {
                                valDisplay = rawAns;
                              }
                            } else {
                              valDisplay = "N/A";
                            }
                          }

                          let badgeColor = "text-gray-600 font-bold";
                          if (valDisplay !== "-" && valDisplay !== "N/A") {
                            if (kepatuhan === 100) badgeColor = "text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded font-bold";
                            else if (kepatuhan >= 80) badgeColor = "text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded font-bold";
                            else badgeColor = "text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded font-bold";
                          }

                          return (
                            <td key={colIdx} className="text-center">
                              {p ? <span className={badgeColor}>{valDisplay}</span> : <span className="text-gray-300">-</span>}
                            </td>
                          );
                        }
                      })}

                      {(() => {
                        if (activeApdTab === "ketersediaan") {
                          let yaCount = 0;
                          let totalCount = 0;
                          row.patrols.forEach(p => {
                            if (p) {
                              const answerObj = p.answers.find((a: any) => a.label === "Ketersediaan terpenuhi" || a.label.includes("Ketersediaan"));
                              const ans = answerObj ? answerObj.jawaban : "-";
                              if (ans === "Ya") { yaCount++; totalCount++; }
                              else if (ans === "Tidak") { totalCount++; }
                            }
                          });
                          const avgText = totalCount > 0 ? ((yaCount / totalCount) * 100).toFixed(0) + "%" : "-";
                          return (
                            <td className="text-center font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10">
                              {avgText}
                            </td>
                          );
                        } else {
                          let sumCompliant = 0;
                          let sumNonCompliant = 0;
                          row.patrols.forEach((p: any) => {
                            if (p && row.jumlahKaryawan > 0) {
                              const ansObj = p.answers.find((a: any) => a.label.includes("menggunakan APD") || a.label.includes("Kepatuhan"));
                              if (ansObj && ansObj.jawaban !== "-" && ansObj.jawaban !== "N/A" && ansObj.jawaban !== "") {
                                let nonCompliantCount = 0;
                                if (ansObj.jawaban === "Tidak") {
                                  const tagsCount = (p.tags || []).filter((t: string) => t.trim() !== "").length;
                                  nonCompliantCount = tagsCount > 0 ? tagsCount : 1;
                                }
                                let compliant = row.jumlahKaryawan - nonCompliantCount;
                                if (compliant < 0) compliant = 0;
                                sumCompliant += compliant;
                                sumNonCompliant += (row.jumlahKaryawan - compliant);
                              }
                            }
                          });
                          return (
                            <>
                              <td className="text-center py-2 font-bold text-green-700 dark:text-green-400 bg-green-50/50 dark:bg-green-900/10 border-l border-green-100 dark:border-green-900/30">
                                <div className="flex flex-col items-center justify-center gap-1">
                                  <span>{sumCompliant}</span>
                                  {sumCompliant + sumNonCompliant > 0 && <span className="text-[10px] font-medium bg-green-100 dark:bg-green-900/50 px-1.5 py-0.5 rounded-md leading-none">{Math.round((sumCompliant / (sumCompliant + sumNonCompliant)) * 100)}%</span>}
                                </div>
                              </td>
                              <td className="text-center py-2 font-bold text-red-700 dark:text-red-400 bg-red-50/50 dark:bg-red-900/10 border-l border-red-100 dark:border-red-900/30">
                                <div className="flex flex-col items-center justify-center gap-1">
                                  <span>{sumNonCompliant}</span>
                                  {sumCompliant + sumNonCompliant > 0 && <span className="text-[10px] font-medium bg-red-100 dark:bg-red-900/50 px-1.5 py-0.5 rounded-md leading-none">{Math.round((sumNonCompliant / (sumCompliant + sumNonCompliant)) * 100)}%</span>}
                                </div>
                              </td>
                            </>
                          );
                        }
                      })()}

                      <td className="text-xs max-w-[150px]">
                        {row.keterangan && row.keterangan !== "-" ? (
                          <button
                            onClick={() => setKeteranganPopup(row.keterangan)}
                            className="text-left text-blue-600 dark:text-blue-400 underline underline-offset-2 truncate block w-full hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                            title="Klik untuk lihat selengkapnya"
                          >
                            {row.keterangan.length > 40 ? row.keterangan.substring(0, 40) + "…" : row.keterangan}
                          </button>
                        ) : <span className="text-gray-400">-</span>}
                      </td>
                    </tr>
                  ))}
                  {reportData.length === 0 && (
                    <tr>
                      <td colSpan={16} className="text-center p-8 text-gray-500">
                        Tidak ada data ruangan di Master Data.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  {activeApdTab === "ketersediaan" ? (
                    <tr className="bg-indigo-50 dark:bg-indigo-900/20 font-bold text-indigo-700 dark:text-indigo-400 border-t-2 border-indigo-200 dark:border-indigo-800/50">
                      <td colSpan={4} className="text-right p-2 border-r border-gray-200 dark:border-slate-700">Persentase (%)</td>
                      <td className="text-center border-r border-gray-200 dark:border-slate-700">
                        {reportData.reduce((acc, curr) => acc + curr.jumlahKaryawan, 0)}
                      </td>
                      {apdSummary?.map((s, i) => {
                        const t = s.ya + s.tidak;
                        return <td key={i} className="text-center border-r border-gray-200 dark:border-slate-700">{t > 0 ? ((s.ya / t) * 100).toFixed(0) + "%" : "0%"}</td>;
                      })}
                      <td className="text-center font-bold bg-indigo-100/80 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300">
                        {(() => {
                          let totalYa = 0, totalAns = 0;
                          apdSummary?.forEach(s => {
                            totalYa += s.ya;
                            totalAns += (s.ya + s.tidak);
                          });
                          return totalAns > 0 ? ((totalYa / totalAns) * 100).toFixed(0) + "%" : "-";
                        })()}
                      </td>
                      <td></td>
                    </tr>
                  ) : (
                    <tr className="bg-indigo-50 dark:bg-indigo-900/20 font-bold text-indigo-700 dark:text-indigo-400 border-t-2 border-indigo-200 dark:border-indigo-800/50">
                      <td colSpan={4} className="text-right p-2 border-r border-gray-200 dark:border-slate-700">Total Keseluruhan</td>
                      <td className="text-center border-r border-gray-200 dark:border-slate-700 text-gray-800 dark:text-gray-200">
                        {reportData.reduce((acc, curr) => acc + curr.jumlahKaryawan, 0)}
                      </td>
                      {apdSummary?.map((s, i) => (
                        <td key={i} className="text-center py-1 border-r border-gray-200 dark:border-slate-700">
                          {s.totalKaryawan > 0 ? (
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <span>{s.totalCompliant}</span>
                              <span className="text-[10px] font-medium bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-100 px-1 py-0.5 rounded leading-none">
                                {Math.round((s.totalCompliant / s.totalKaryawan) * 100)}%
                              </span>
                            </div>
                          ) : "-"}
                        </td>
                      ))}
                      <td className="text-center py-2 font-bold bg-green-100/80 dark:bg-green-900/40 text-green-800 dark:text-green-300">
                        {(() => {
                          let totalCompliantSum = 0;
                          apdSummary?.forEach(s => {
                            totalCompliantSum += s.totalCompliant;
                          });
                          return (
                            <div className="flex flex-col items-center justify-center gap-1">
                              <span>{totalCompliantSum}</span>
                              {apdOverallPct !== null && (
                                <span className="text-[10px] bg-green-200 dark:bg-green-800 px-1.5 py-0.5 rounded-md leading-none">{apdOverallPct}%</span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="text-center py-2 font-bold bg-red-100/80 dark:bg-red-900/40 text-red-800 dark:text-red-300">
                        {(() => {
                          let totalNonCompliantSum = 0;
                          reportData.forEach(row => {
                            row.patrols.forEach(p => {
                              if (p && row.jumlahKaryawan > 0) {
                                const ansObj = p.answers.find((a: any) => a.label.includes("menggunakan APD") || a.label.includes("Kepatuhan"));
                                if (ansObj && ansObj.jawaban !== "-" && ansObj.jawaban !== "N/A" && ansObj.jawaban !== "") {
                                  let nonCompliantCount = 0;
                                  if (ansObj.jawaban === "Tidak") {
                                    const tagsCount = (p.tags || []).filter((t: string) => t.trim() !== "").length;
                                    nonCompliantCount = tagsCount > 0 ? tagsCount : 1;
                                  }
                                  let compliant = row.jumlahKaryawan - nonCompliantCount;
                                  if (compliant < 0) compliant = 0;
                                  totalNonCompliantSum += (row.jumlahKaryawan - compliant);
                                }
                              }
                            });
                          });
                          return (
                            <div className="flex flex-col items-center justify-center gap-1">
                              <span>{totalNonCompliantSum}</span>
                              {apdOverallPct !== null && (
                                <span className="text-[10px] bg-red-200 dark:bg-red-800 px-1.5 py-0.5 rounded-md leading-none">{100 - apdOverallPct}%</span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td></td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── B3 Tabbed Tables ── */}
      {slug === "b3" && !loading && data && (
        <section aria-label="Laporan Detail B3" className="mt-8">
          <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
            <h2 className="section-label mb-0">📄 Laporan Detail B3</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap p-1 bg-gray-100 dark:bg-slate-800 rounded-lg gap-1">
                <button
                  onClick={() => setActiveB3Tab("a")}
                  className={`px-3 py-2 text-xs md:text-sm font-semibold rounded-md transition-all ${activeB3Tab === "a"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                >
                  a. Penyimpanan B3 & Ketersediaan SDS
                </button>
                <button
                  onClick={() => setActiveB3Tab("b")}
                  className={`px-3 py-2 text-xs md:text-sm font-semibold rounded-md transition-all ${activeB3Tab === "b"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                >
                  b. Ketersediaan & Kelengkapan Spill Kit
                </button>
                <button
                  onClick={() => setActiveB3Tab("c")}
                  className={`px-3 py-2 text-xs md:text-sm font-semibold rounded-md transition-all ${activeB3Tab === "c"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                >
                  c. Eyewasher & Bodywasher
                </button>
              </div>
              <button
                onClick={() => handleExportDetailExcel('b3')}
                disabled={downloading}
                className="btn-success text-xs shadow-sm h-full py-2 px-3 whitespace-nowrap rounded-md"
              >
                {downloading ? "⏳" : "📊"} Excel
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto p-4">
              <table className="data-table text-sm w-full text-left min-w-[800px]">
                <thead>
                  <tr>
                    <th rowSpan={2} className="w-12 text-center align-middle border-r border-gray-200 dark:border-slate-700">No</th>
                    <th rowSpan={2} className="w-48 align-middle border-r border-gray-200 dark:border-slate-700">Ruangan</th>
                    {activeB3Tab === "a" && (
                      <>
                        <th className="w-24 text-center bg-blue-50/50 dark:bg-blue-900/10 border-b border-r border-gray-200 dark:border-slate-700">
                          <div className="text-[10px] opacity-70 uppercase tracking-wider">Seharusnya</div>
                        </th>
                        <th className="w-24 text-center bg-emerald-50/50 dark:bg-emerald-900/10 border-b border-r border-gray-200 dark:border-slate-700">
                          <div className="text-[10px] opacity-70 uppercase tracking-wider">Terlihat</div>
                        </th>
                      </>
                    )}
                    {activeB3Tab === "c" && (
                      <>
                        <th rowSpan={2} className="w-24 text-center align-middle border-r border-gray-200 dark:border-slate-700">Jumlah Eyewasher</th>
                        <th rowSpan={2} className="w-24 text-center align-middle border-r border-gray-200 dark:border-slate-700">Jumlah Bodywasher</th>
                      </>
                    )}
                    <th colSpan={2} className="text-center bg-gray-50 dark:bg-slate-800 border-b border-r border-gray-200 dark:border-slate-700">
                      {activeB3Tab === "a" ? "Penyimpanan terpisah B3" : activeB3Tab === "b" ? "Ketersediaan Spill Kit" : "Eyewasher berfungsi baik"}
                    </th>
                    <th colSpan={2} className="text-center bg-gray-50 dark:bg-slate-800 border-b border-r border-gray-200 dark:border-slate-700">
                      {activeB3Tab === "a" ? "Ketersediaan SDS" : activeB3Tab === "b" ? "Kelengkapan Spill Kit" : "Bodywasher berfungsi baik"}
                    </th>
                    <th rowSpan={2} className="w-24 text-center align-middle bg-green-50/50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-r border-gray-200 dark:border-slate-700">Jml Patuh</th>
                    <th rowSpan={2} className="w-24 text-center align-middle bg-red-50/50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-r border-gray-200 dark:border-slate-700">Tdk Patuh</th>
                    <th rowSpan={2} className="w-24 text-center align-middle bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-r border-gray-200 dark:border-slate-700">Rata-rata (%)</th>
                    <th rowSpan={2} className="w-48 align-middle">Keterangan</th>
                  </tr>
                  <tr>
                    {activeB3Tab === "a" && (
                      <>
                        <th className="w-24 text-center bg-blue-50/50 dark:bg-blue-900/10 border-r border-gray-200 dark:border-slate-700">Jumlah Lemari B3</th>
                        <th className="w-24 text-center bg-emerald-50/50 dark:bg-emerald-900/10 border-r border-gray-200 dark:border-slate-700">Jumlah Lemari B3</th>
                      </>
                    )}
                    <th className="w-24 text-center border-r border-gray-200 dark:border-slate-700">Patroli 1</th>
                    <th className="w-24 text-center border-r border-gray-200 dark:border-slate-700">Patroli 2</th>
                    <th className="w-24 text-center border-r border-gray-200 dark:border-slate-700">Patroli 1</th>
                    <th className="w-24 text-center border-r border-gray-200 dark:border-slate-700">Patroli 2</th>
                  </tr>
                </thead>
                <tbody>
                  {b3ReportData.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      <td className="text-center font-medium text-gray-500 border-r border-gray-200 dark:border-slate-700">{i + 1}</td>
                      <td className="font-medium text-gray-800 dark:text-gray-100 truncate border-r border-gray-200 dark:border-slate-700">{row.ruangan}</td>

                      {activeB3Tab === "a" && (
                        <>
                          <td className="text-center font-semibold text-blue-700 bg-blue-50/20 border-r border-gray-200 dark:border-slate-700">{row.seharusnyaLemari}</td>
                          <td className={`text-center font-semibold border-r border-gray-200 dark:border-slate-700 ${row.seharusnyaLemari !== 0 && parseInt(row.terlihatLemari as string) < row.seharusnyaLemari ? 'text-red-600 bg-red-50/50' : 'text-emerald-700 bg-emerald-50/20'}`}>{row.terlihatLemari}</td>
                        </>
                      )}
                      {activeB3Tab === "c" && (
                        <>
                          <td className="text-center font-medium text-gray-700 border-r border-gray-200 dark:border-slate-700">{row.eyewasher}</td>
                          <td className="text-center font-medium text-gray-700 border-r border-gray-200 dark:border-slate-700">{row.bodywasher}</td>
                        </>
                      )}

                      {[...Array(2)].map((_, colIdx) => {
                        const p = row.patrols[colIdx];
                        let ans = "-";
                        let valDisplay: string | number = "-";

                        if (p) {
                          const labelToMatch = activeB3Tab === "a" ? "Penyimpanan B3" : activeB3Tab === "b" ? "Ketersediaan Spill Kit" : "Eyewasher";
                          const answerObj = p.answers.find((a: any) => a.label.includes(labelToMatch));
                          ans = answerObj ? answerObj.jawaban : "-";

                          if (ans !== "-" && ans !== "N/A" && ans !== "") {
                            let expected = 1;
                            if (activeB3Tab === "a") expected = row.seharusnyaLemari > 0 ? row.seharusnyaLemari : (parseInt(row.terlihatLemari as string, 10) || 0);

                            if (activeB3Tab === "a") {
                              if (ans === "Ya") {
                                valDisplay = expected;
                              } else if (ans === "Tidak") {
                                const nonCompliant = (p.tags && p.tags.length > 0) ? p.tags.length : expected;
                                valDisplay = Math.max(0, expected - nonCompliant);
                              }
                            } else {
                              valDisplay = ans;
                            }
                          } else {
                            valDisplay = ans;
                          }
                        }

                        let badgeColor = "text-gray-400";
                        if (activeB3Tab === "a" && (valDisplay !== "-" && valDisplay !== "N/A" && typeof valDisplay === "number")) {
                          let expected = row.seharusnyaLemari > 0 ? row.seharusnyaLemari : (parseInt(row.terlihatLemari as string, 10) || 0);

                          if (valDisplay === expected) badgeColor = "text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded font-bold";
                          else badgeColor = "text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded font-bold";
                        } else {
                          if (ans === "Ya") badgeColor = "text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded font-medium";
                          if (ans === "Tidak") badgeColor = "text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded font-medium";
                          if (ans === "N/A") badgeColor = "text-gray-600 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-medium";
                        }

                        return (
                          <td key={`q1-${colIdx}`} className="text-center border-r border-gray-200 dark:border-slate-700">
                            {p ? <span className={badgeColor}>{valDisplay}</span> : <span className="text-gray-300">-</span>}
                          </td>
                        );
                      })}

                      {[...Array(2)].map((_, colIdx) => {
                        const p = row.patrols[colIdx];
                        let ans = "-";
                        let valDisplay: string | number = "-";

                        if (p) {
                          const labelToMatch = activeB3Tab === "a" ? "Ketersediaan SDS" : activeB3Tab === "b" ? "Kelengkapan Spill Kit" : "Bodywasher";
                          const answerObj = p.answers.find((a: any) => a.label.includes(labelToMatch));
                          ans = answerObj ? answerObj.jawaban : "-";

                          if (ans !== "-" && ans !== "N/A" && ans !== "") {
                            let expected = 1;
                            if (activeB3Tab === "a") expected = row.seharusnyaLemari > 0 ? row.seharusnyaLemari : (parseInt(row.terlihatLemari as string, 10) || 0);

                            if (activeB3Tab === "a") {
                              if (ans === "Ya") {
                                valDisplay = expected;
                              } else if (ans === "Tidak") {
                                const nonCompliant = (p.tags && p.tags.length > 0) ? p.tags.length : expected;
                                valDisplay = Math.max(0, expected - nonCompliant);
                              }
                            } else {
                              valDisplay = ans;
                            }
                          } else {
                            valDisplay = ans;
                          }
                        }

                        let badgeColor = "text-gray-400";
                        if (activeB3Tab === "a" && (valDisplay !== "-" && valDisplay !== "N/A" && typeof valDisplay === "number")) {
                          let expected = row.seharusnyaLemari > 0 ? row.seharusnyaLemari : (parseInt(row.terlihatLemari as string, 10) || 0);

                          if (valDisplay === expected) badgeColor = "text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded font-bold";
                          else badgeColor = "text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded font-bold";
                        } else {
                          if (ans === "Ya") badgeColor = "text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded font-medium";
                          if (ans === "Tidak") badgeColor = "text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded font-medium";
                          if (ans === "N/A") badgeColor = "text-gray-600 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-medium";
                        }

                        return (
                          <td key={`q2-${colIdx}`} className="text-center border-r border-gray-200 dark:border-slate-700">
                            {p ? <span className={badgeColor}>{valDisplay}</span> : <span className="text-gray-300">-</span>}
                          </td>
                        );
                      })}

                      {(() => {
                        let totalExpected = 0;
                        let compliantCount = 0;
                        [0, 1].forEach((colIdx) => {
                          const p = row.patrols[colIdx];
                          if (p) {
                            const lbl1 = activeB3Tab === "a" ? "Penyimpanan B3" : activeB3Tab === "b" ? "Ketersediaan Spill Kit" : "Eyewasher";
                            const lbl2 = activeB3Tab === "a" ? "Ketersediaan SDS" : activeB3Tab === "b" ? "Kelengkapan Spill Kit" : "Bodywasher";

                            const a1 = p.answers.find((a: any) => a.label.includes(lbl1));
                            const a2 = p.answers.find((a: any) => a.label.includes(lbl2));

                            const getExpected = (lbl: string) => {
                              if (lbl === "Penyimpanan B3" || lbl === "Ketersediaan SDS") return row.seharusnyaLemari > 0 ? row.seharusnyaLemari : (parseInt(String(row.terlihatLemari), 10) || 0);
                              return 1;
                            };

                            if (a1 && a1.jawaban !== "N/A" && a1.jawaban !== "-" && a1.jawaban !== "") {
                              const exp = getExpected(lbl1);
                              totalExpected += exp;
                              if (a1.jawaban === "Ya") compliantCount += exp;
                              else if (a1.jawaban === "Tidak") {
                                const nonCompliant = (p.tags && p.tags.length > 0) ? p.tags.length : exp;
                                compliantCount += Math.max(0, exp - nonCompliant);
                              }
                            }
                            if (a2 && a2.jawaban !== "N/A" && a2.jawaban !== "-" && a2.jawaban !== "") {
                              const exp = getExpected(lbl2);
                              totalExpected += exp;
                              if (a2.jawaban === "Ya") compliantCount += exp;
                              else if (a2.jawaban === "Tidak") {
                                const nonCompliant = (p.tags && p.tags.length > 0) ? p.tags.length : exp;
                                compliantCount += Math.max(0, exp - nonCompliant);
                              }
                            }
                          }
                        });

                        let avgText = "-";
                        let nonCompliantCount = totalExpected - compliantCount;
                        if (totalExpected > 0) avgText = ((compliantCount / totalExpected) * 100).toFixed(0) + "%";

                        return (
                          <>
                            <td className="text-center font-bold text-green-700 dark:text-green-400 bg-green-50/50 dark:bg-green-900/10 border-r border-green-100 dark:border-green-900/30">
                              {totalExpected > 0 ? compliantCount : "-"}
                            </td>
                            <td className="text-center font-bold text-red-700 dark:text-red-400 bg-red-50/50 dark:bg-red-900/10 border-r border-red-100 dark:border-red-900/30">
                              {totalExpected > 0 ? nonCompliantCount : "-"}
                            </td>
                            <td className="text-center font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10 border-r border-indigo-100 dark:border-indigo-900/30">
                              {avgText}
                            </td>
                          </>
                        );
                      })()}

                      {(() => {
                        const ket = activeB3Tab === "c" ? row.keteranganC : row.keteranganA;
                        return (
                          <td className="text-xs max-w-[150px]">
                            {ket && ket !== "-" ? (
                              <button
                                onClick={() => setKeteranganPopup(ket)}
                                className="text-left text-blue-600 dark:text-blue-400 underline underline-offset-2 truncate block w-full hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                                title="Klik untuk lihat selengkapnya"
                              >
                                {ket.length > 40 ? ket.substring(0, 40) + "…" : ket}
                              </button>
                            ) : <span className="text-gray-400">-</span>}
                          </td>
                        );
                      })()}
                    </tr>
                  ))}
                  {b3ReportData.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-gray-500">
                        Tidak ada data ruangan di Master Data.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-indigo-50 dark:bg-indigo-900/20 font-bold text-indigo-700 dark:text-indigo-400">
                    <td colSpan={2} className="text-right p-2 border-r border-gray-200 dark:border-slate-700">Persentase (%)</td>
                    {activeB3Tab === "a" && (
                      <>
                        <td className="text-center p-2 border-r border-gray-200 dark:border-slate-700">
                          {b3ReportData.reduce((acc, row) => acc + (parseInt(String(row.seharusnyaLemari)) || 0), 0)}
                        </td>
                        <td className="text-center p-2 border-r border-gray-200 dark:border-slate-700">
                          {b3ReportData.reduce((acc, row) => acc + (parseInt(String(row.terlihatLemari)) || 0), 0)}
                        </td>
                      </>
                    )}
                    {activeB3Tab === "c" && (
                      <>
                        <td className="text-center p-2 border-r border-gray-200 dark:border-slate-700">
                          {b3ReportData.reduce((acc, row) => acc + (parseInt(String(row.eyewasher)) || 0), 0)}
                        </td>
                        <td className="text-center p-2 border-r border-gray-200 dark:border-slate-700">
                          {b3ReportData.reduce((acc, row) => acc + (parseInt(String(row.bodywasher)) || 0), 0)}
                        </td>
                      </>
                    )}
                    {b3Summary?.map((s, i) => {
                      const t = s.ya + s.tidak;
                      return (
                        <td key={i} className="text-center py-2 border-r border-gray-200 dark:border-slate-700 font-medium text-gray-700 dark:text-gray-300">
                          {t > 0 ? (
                            <div className="flex flex-col items-center justify-center gap-1">
                              <span>{s.ya}</span>
                              <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/40 px-1.5 py-0.5 rounded-md leading-none text-indigo-700 dark:text-indigo-300">
                                {((s.ya / t) * 100).toFixed(0)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-center py-2 font-bold bg-green-100/80 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-r border-gray-200 dark:border-slate-700">
                      {(() => {
                        let totalYa = 0;
                        let totalAns = 0;
                        b3Summary?.forEach(s => {
                          totalYa += s.ya;
                          totalAns += (s.ya + s.tidak);
                        });
                        return totalAns > 0 ? (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <span>{totalYa}</span>
                            <span className="text-[10px] bg-green-200 dark:bg-green-800 px-1.5 py-0.5 rounded-md leading-none">{((totalYa / totalAns) * 100).toFixed(0)}%</span>
                          </div>
                        ) : "-";
                      })()}
                    </td>
                    <td className="text-center py-2 font-bold bg-red-100/80 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-r border-gray-200 dark:border-slate-700">
                      {(() => {
                        let totalTidak = 0;
                        let totalAns = 0;
                        b3Summary?.forEach(s => {
                          totalTidak += s.tidak;
                          totalAns += (s.ya + s.tidak);
                        });
                        return totalAns > 0 ? (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <span>{totalTidak}</span>
                            <span className="text-[10px] bg-red-200 dark:bg-red-800 px-1.5 py-0.5 rounded-md leading-none">{((totalTidak / totalAns) * 100).toFixed(0)}%</span>
                          </div>
                        ) : "-";
                      })()}
                    </td>
                    <td className="text-center py-2 font-bold bg-indigo-100/80 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 border-r border-gray-200 dark:border-slate-700">
                      {(() => {
                        let totalYa = 0;
                        let totalAns = 0;
                        b3Summary?.forEach(s => {
                          totalYa += s.ya;
                          totalAns += (s.ya + s.tidak);
                        });
                        return totalAns > 0 ? ((totalYa / totalAns) * 100).toFixed(0) + "%" : "-";
                      })()}
                    </td>
                    <td></td>
                  </tr>

                  {/* --- NEW ROW: COMBINED PERCENTAGE (P1 + P2) --- */}
                  <tr className="bg-indigo-100 dark:bg-indigo-900/30 font-bold text-indigo-800 dark:text-indigo-300 border-t-2 border-indigo-200 dark:border-indigo-800/50">
                    <td colSpan={activeB3Tab === "b" ? 2 : 4} className="text-right p-2 border-r border-gray-200 dark:border-slate-700 text-xs md:text-sm">
                      Total Rata-rata 📊 (P1 + P2)
                    </td>
                    <td colSpan={2} className="text-center p-2 border-r border-gray-200 dark:border-slate-700 text-lg">
                      {(() => {
                        if (!b3Summary || b3Summary.length < 2) return "-";
                        const s1 = b3Summary[0];
                        const s2 = b3Summary[1];
                        const totalYa = s1.ya + s2.ya;
                        const totalAns = s1.ya + s1.tidak + s2.ya + s2.tidak;
                        return totalAns > 0 ? ((totalYa / totalAns) * 100).toFixed(0) + "%" : "0%";
                      })()}
                    </td>
                    <td colSpan={2} className="text-center p-2 border-r border-gray-200 dark:border-slate-700 text-lg">
                      {(() => {
                        if (!b3Summary || b3Summary.length < 4) return "-";
                        const s3 = b3Summary[2];
                        const s4 = b3Summary[3];
                        const totalYa = s3.ya + s4.ya;
                        const totalAns = s3.ya + s3.tidak + s4.ya + s4.tidak;
                        return totalAns > 0 ? ((totalYa / totalAns) * 100).toFixed(0) + "%" : "0%";
                      })()}
                    </td>
                    <td colSpan={2} className="bg-indigo-200/30 dark:bg-indigo-800/20"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── Pengelompokan Topik PCRA ── */}
      {slug === "pcra" && data && !loading && (
        <section aria-label="Pengelompokan Topik PCRA" className="mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
            <h2 className="section-label mb-0">📂 Topik / Proyek PCRA</h2>
            <button
              onClick={() => requirePcraAuth(() => {
                setEditingTopic(null);
                setTopicNameInput("");
                setTopicStartDate("");
                setTopicEndDate("");
                setSelectedTopicLocations([]);
                setIsTopicModalOpen(true);
              })}
              className="btn-primary text-sm whitespace-nowrap"
            >
              + Buat Topik
            </button>
          </div>

          {pcraTopics.length === 0 ? (
            <div className="card p-10 text-center text-gray-400 dark:text-gray-500">
              <div className="text-4xl mb-3">📂</div>
              <p>Belum ada topik yang dibuat. Klik &quot;+ Buat Topik&quot; untuk mengelompokkan data berdasarkan proyek.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {pcraTopics.map(topic => {
                const topicSubmissions = topic.locations
                  .flatMap(loc => groupedSubmissionsByLoc[loc.toLowerCase()] || [])
                  .filter(s => {
                    const dateMatchStart = !topic.startDate || s.tanggalPemantauan >= topic.startDate;
                    const dateMatchEnd = !topic.endDate || s.tanggalPemantauan <= topic.endDate;
                    return dateMatchStart && dateMatchEnd;
                  });

                let sumYa = 0;
                let sumTotal = 0;
                const topicQuestionResults = moduleDef.questions?.map((q: any) => {
                  let ya = 0;
                  let tidak = 0;
                  let na = 0;
                  topicSubmissions.forEach((sub: any) => {
                    const a = sub.answers?.find((ans: any) => ans.sheetHeader === q.sheetHeader);
                    if (a) {
                      if (a.jawaban === "Ya") ya++;
                      else if (a.jawaban === "Tidak") tidak++;
                      else if (a.jawaban === "N/A") na++;
                    }
                  });
                  sumYa += ya;
                  sumTotal += (ya + tidak);
                  return {
                    sheetHeader: q.sheetHeader,
                    label: q.label,
                    pct: (ya + tidak) > 0 ? Math.round((ya / (ya + tidak)) * 100) : null,
                    countYa: ya,
                    countTidak: tidak,
                    countNA: na,
                    countEmpty: topicSubmissions.length - ya - tidak - na
                  };
                }) || [];
                
                const topicTotalPct = sumTotal > 0 ? Math.round((sumYa / sumTotal) * 100) : 0;

                return (
                  <div key={topic.id} className="card overflow-hidden border-t-4 border-indigo-500">
                    <div className="bg-gray-50 dark:bg-slate-800 p-4 border-b border-gray-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{topic.name}</h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                          Periode: {topic.startDate || "-"} s.d {topic.endDate || "-"}
                        </p>
                        <p className="text-sm text-gray-500 mt-1 max-w-2xl">{topic.locations.join(", ")}</p>
                      </div>
                      <div className="flex gap-2 self-end sm:self-auto shrink-0">
                        <button
                          onClick={() => requirePcraAuth(() => {
                            setEditingTopic(topic);
                            setTopicNameInput(topic.name);
                            setTopicStartDate(topic.startDate);
                            setTopicEndDate(topic.endDate);
                            setSelectedTopicLocations(topic.locations);
                            setIsTopicModalOpen(true);
                          })}
                          className="px-3 py-1.5 text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-md font-medium transition-colors"
                        >
                          ✎ Edit
                        </button>
                        <button
                          onClick={() => {
                            let url = `/api/export/excel?slug=${slug}&bulan=${bulan}&ruangan=${encodeURIComponent(ruangan)}`;
                            url += `&topicName=${encodeURIComponent(topic.name)}&startDate=${encodeURIComponent(topic.startDate)}&endDate=${encodeURIComponent(topic.endDate)}&locations=${encodeURIComponent(topic.locations.join(","))}`;
                            window.open(url, "_blank");
                          }}
                          className="btn-success py-1.5 px-3 text-sm flex items-center gap-1"
                        >
                          📊 Unduh Excel Topik
                        </button>
                      </div>
                    </div>
                    <div className="card-body">
                      {topicSubmissions.length > 0 ? (
                        <SubmissionTable
                          moduleDef={moduleDef}
                          submissions={topicSubmissions}
                          questionResults={topicQuestionResults}
                          totalPct={topicTotalPct}
                          masterData={masterData}
                        />
                      ) : (
                        <div className="p-6 text-center text-gray-400">Tidak ada data (kosong) untuk topik ini di periode yang dipilih.</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* PCRA Topic Modal */}
      {isTopicModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {editingTopic ? "Edit Topik PCRA" : "Buat Topik PCRA Baru"}
              </h3>
              <button
                onClick={() => setIsTopicModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nama Topik
                </label>
                <input
                  type="text"
                  value={topicNameInput}
                  onChange={(e) => setTopicNameInput(e.target.value)}
                  placeholder="Contoh: Proyek Gedung A"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={topicStartDate}
                    onChange={(e) => setTopicStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    value={topicEndDate}
                    onChange={(e) => setTopicEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pilih Lokasi yang Termasuk:
                </label>
                <div className="bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                  {uniquePcraLocations.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Belum ada data lokasi PCRA bulan ini.</p>
                  ) : (
                    uniquePcraLocations.map(loc => (
                      <label key={loc} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTopicLocations.includes(loc)}
                          onChange={() => toggleTopicLocation(loc)}
                          className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{loc}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Sistem hanya akan mengambil patroli yang <strong>Lokasi/Ruangannya dicentang di atas</strong>, dan dilakukan pada rentang tanggal tersebut.
              </p>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center">
              {editingTopic && editingTopic._rowIndex ? (
                <button
                  onClick={() => handleDeleteTopic(editingTopic.id, editingTopic._rowIndex)}
                  className="btn-danger py-2 px-3 text-sm flex items-center justify-center min-w-[100px]"
                  disabled={isSavingTopic}
                >
                  {isSavingTopic ? "⏳" : "🗑 Hapus Topik"}
                </button>
              ) : (
                <div></div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setIsTopicModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-600 dark:hover:bg-slate-700"
                  disabled={isSavingTopic}
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveTopic}
                  disabled={isSavingTopic || !topicNameInput.trim() || selectedTopicLocations.length === 0}
                  className="btn-primary py-2 px-6 shadow-sm min-w-[120px] disabled:opacity-50"
                >
                  {isSavingTopic ? "Menyimpan..." : "Simpan Topik"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Authentication Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 text-center">
                Autentikasi Diperlukan
              </h3>
            </div>
            <form onSubmit={handleAuthSubmit} className="p-5">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
                Masukkan password admin untuk mengelola Topik PCRA.
              </p>
              <input
                type="password"
                value={authPasswordInput}
                onChange={(e) => setAuthPasswordInput(e.target.value)}
                placeholder="Password"
                className="input-field mb-5"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  className="flex-1 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-slate-700 dark:text-gray-300 dark:border-slate-600 dark:hover:bg-slate-600 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm transition-colors"
                >
                  Login
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
