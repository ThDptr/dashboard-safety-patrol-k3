import React from "react";
import { formatTimestamp, formatMaybeDate } from "@/lib/utils";

export default function SubmissionTable({
  moduleDef,
  submissions,
  questionResults,
  totalPct,
  masterData = [],
}: {
  moduleDef: any;
  submissions: any[];
  questionResults?: any[];
  totalPct?: number | null;
  masterData?: any[];
}) {
  const isPCRA = moduleDef.slug === "pcra";
  const isLuarGedung = moduleDef.slug === "luar-gedung";
  const isB3 = moduleDef.slug === "b3";
  const isAPAR = moduleDef.slug === "apar";
  const isSosialisasi = moduleDef.logOnly === true;
  const isHydrant = moduleDef.slug === "hydrant";

  // Array of distinct pastel colors for question columns
  const Q_COLORS = [
    "bg-blue-50/60 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200 border-l border-r border-blue-100/60 dark:border-blue-800/40",
    "bg-amber-50/60 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 border-l border-r border-amber-100/60 dark:border-amber-800/40",
    "bg-emerald-50/60 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-200 border-l border-r border-emerald-100/60 dark:border-emerald-800/40",
    "bg-purple-50/60 dark:bg-purple-900/20 text-purple-900 dark:text-purple-200 border-l border-r border-purple-100/60 dark:border-purple-800/40",
    "bg-rose-50/60 dark:bg-rose-900/20 text-rose-900 dark:text-rose-200 border-l border-r border-rose-100/60 dark:border-rose-800/40",
    "bg-cyan-50/60 dark:bg-cyan-900/20 text-cyan-900 dark:text-cyan-200 border-l border-r border-cyan-100/60 dark:border-cyan-800/40",
  ];
  const isAPD = moduleDef.slug === "apd";

  // Location Header
  let locationHeader = "Ruangan";
  if (isPCRA) locationHeader = "Lokasi & Deskripsi Pekerjaan";
  if (isLuarGedung) locationHeader = "Lokasi";
  if (isB3) locationHeader = "Ruangan Patroli B3";

  // Extra fields grouping
  const getExtraValue = (sub: any, labelToMatch: string) => {
    const ext = sub.extras?.find((e: any) => e.label === labelToMatch || e.label.includes(labelToMatch));
    return ext ? formatMaybeDate(ext.value) : "-";
  };

  const extrasBefore = React.useMemo(() => {
    if (moduleDef.slug === "apar") return ["Jumlah APAR Powder", "Jumlah APAR CO2"];
    if (isLuarGedung) return ["Jumlah APAR Powder 6 kg", "Jumlah APAR Powder 25 kg", "Jumlah APAR CO2"];
    if (isB3) return ["Jumlah Lemari B3"];
    return [];
  }, [moduleDef.slug, isLuarGedung, isB3]);

  const extrasAfter = React.useMemo(() => {
    if (moduleDef.slug === "apar" || isLuarGedung) return ["Tgl. Pemeliharaan Terakhir"];
    if (isB3) return ["Jumlah Eyewasher", "Jumlah Bodywasher"];
    return [];
  }, [moduleDef.slug, isLuarGedung, isB3]);

  // For APAR and B3, we want to split the extra numeric fields into Seharusnya (from master) and Terlihat (from form)
  const isMasterComparison = moduleDef.slug === "apar" || isLuarGedung || isB3;

  // Helper to find master row (Optimized with O(1) Map lookup)
  const masterDataMap = React.useMemo(() => {
    const map = new Map<string, any>();
    if (!masterData || !Array.isArray(masterData)) return map;
    masterData.forEach((m: any) => {
      if (m.Ruangan) map.set(String(m.Ruangan).trim().toLowerCase(), m);
      if (m.Lokasi) map.set(String(m.Lokasi).trim().toLowerCase(), m);
      if (m['Area Luar']) map.set(String(m['Area Luar']).trim().toLowerCase(), m);
    });
    return map;
  }, [masterData]);

  // Precompute professions for APD to prevent O(N^2) lookup
  const masterProfesiNames = React.useMemo(() => {
    if (!masterData || !Array.isArray(masterData)) return [];
    return masterData
      .filter((m: any) => m.Ruangan?.startsWith('**'))
      .map((m: any) => m.Ruangan?.substring(2).trim().toLowerCase());
  }, [masterData]);

  const getMasterRow = React.useCallback((location: string) => {
    if (!location) return null;
    return masterDataMap.get(String(location).trim().toLowerCase()) || null;
  }, [masterDataMap]);

  // State for calculating totals
  const totals = React.useMemo(() => {
    const calc: Record<string, { seharusnya: number; terlihat: number }> = {};
    if (!isMasterComparison) return calc;
    
    extrasBefore.forEach(label => {
      calc[label] = { seharusnya: 0, terlihat: 0 };
    });

    submissions.forEach(sub => {
      const mRow = getMasterRow(sub.location);
      extrasBefore.forEach(label => {
        const terlihatVal = parseInt(getExtraValue(sub, label) as string, 10) || 0;
        let seharusnyaVal = mRow && mRow[label] !== undefined && mRow[label] !== "" ? parseInt(mRow[label], 10) || 0 : 0;
        
        // Fallback to form data (Terlihat) if Master data for Seharusnya is 0 or missing
        if (seharusnyaVal === 0) {
           seharusnyaVal = terlihatVal;
        }

        calc[label].terlihat += terlihatVal;
        calc[label].seharusnya += seharusnyaVal;
      });
    });

    return calc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions, masterData, isMasterComparison, extrasBefore]);

  // Helper for answers
  const getAnswerFor = (sub: any, sheetHeader: string) => {
    const ans = sub.answers?.find((a: any) => a.sheetHeader === sheetHeader);
    return ans ? ans.jawaban : "";
  };

  const JawabanBadge = ({ jawaban }: { jawaban: string }) => {
    if (jawaban === "Ya") return <span className="badge-green text-xs px-2 py-1">Ya</span>;
    if (jawaban === "Tidak") return <span className="badge-red text-xs px-2 py-1">{moduleDef.slug === "sarana-proteksi" ? "Tidak Ada" : "Tidak"}</span>;
    if (jawaban === "Setengah") return <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-medium text-xs px-2 py-1 rounded-md whitespace-nowrap">Kurang Baik</span>;
    if (jawaban === "TidakAda") return <span className="bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 font-medium text-xs px-2 py-1 rounded-md whitespace-nowrap">{isHydrant ? "Tidak ada hydrant" : "Tidak Ada"}</span>;
    if (jawaban === "N/A") return <span className="badge-gray text-xs px-2 py-1">N/A</span>;
    return <span className="text-gray-400 font-bold">-</span>;
  };

  const sortedSubmissions = [...submissions].sort((a, b) => {
    // Sort A-Z by location
    const locA = a.location || "";
    const locB = b.location || "";
    const locCompare = locA.localeCompare(locB);
    if (locCompare !== 0) return locCompare;
    
    // If same location, sort by date
    const dateA = new Date(a.tanggalPemantauan || a.timestamp).getTime();
    const dateB = new Date(b.tanggalPemantauan || b.timestamp).getTime();
    return dateA - dateB;
  });

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto" style={{ transform: "rotateX(180deg)" }}>
        <table className="data-table text-sm" id="submission-table">
          <thead>
            <tr>
              <th className="w-10">No</th>
              <th>Tanggal</th>
              <th>Nama Petugas</th>
              <th>{locationHeader}</th>
              <th className="text-center w-24">Patroli Ke-</th>

              {isSosialisasi ? (
                <>
                  <th>Topik Sosialisasi</th>
                  <th>Sasaran</th>
                </>
              ) : (
                <>
                  {extrasBefore.map((l) => (
                    isMasterComparison ? (
                      <React.Fragment key={l}>
                        <th className="text-center bg-blue-50/50 dark:bg-blue-900/10 text-blue-800 dark:text-blue-300">
                          <div className="text-[10px] opacity-70 uppercase tracking-wider">Seharusnya</div>
                          <div>{l}</div>
                        </th>
                        <th className="text-center bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-300">
                          <div className="text-[10px] opacity-70 uppercase tracking-wider">Terlihat</div>
                          <div>{l}</div>
                        </th>
                      </React.Fragment>
                    ) : (
                      <th key={l} className="text-center">{l}</th>
                    )
                  ))}
                  {(isAPAR || isLuarGedung) && (
                    <th className="text-center min-w-[100px] bg-blue-50/50 dark:bg-blue-900/10 text-blue-800 dark:text-blue-300">
                      <div className="text-[10px] opacity-70 uppercase tracking-wider">Seharusnya</div>
                      <div>Total APAR</div>
                    </th>
                  )}
                  {isAPD && (
                    <th className="text-center min-w-[100px] bg-blue-50/50 dark:bg-blue-900/10 text-blue-800 dark:text-blue-300">
                      <div className="text-[10px] opacity-70 uppercase tracking-wider">Seharusnya</div>
                      <div>Total Karyawan</div>
                    </th>
                  )}
                  {moduleDef.questions?.map((q: any, qIdx: number) => (
                    <th key={q.sheetHeader} className={`text-center min-w-[100px] ${Q_COLORS[qIdx % Q_COLORS.length]}`}>
                      {q.label}
                    </th>
                  ))}
                  {(isAPAR || isLuarGedung) && (
                    <>
                      <th className="text-center min-w-[80px] bg-green-50/50 dark:bg-green-900/10 text-green-800 dark:text-green-300 border-l-2 border-green-200/50 dark:border-green-800/30">
                        <div className="text-[10px] opacity-70 uppercase tracking-wider">Per Baris</div>
                        <div>Patuh</div>
                      </th>
                      <th className="text-center min-w-[80px] bg-red-50/50 dark:bg-red-900/10 text-red-800 dark:text-red-300 border-l-2 border-red-200/50 dark:border-red-800/30">
                        <div className="text-[10px] opacity-70 uppercase tracking-wider">Per Baris</div>
                        <div>Tdk Patuh</div>
                      </th>
                      <th className="text-center min-w-[80px] bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-800 dark:text-indigo-300 border-l-2 border-indigo-200/50 dark:border-indigo-800/30">
                        <div className="text-[10px] opacity-70 uppercase tracking-wider">Per Baris</div>
                        <div>Total %</div>
                      </th>
                    </>
                  )}
                  {isAPD && (
                    <th className="text-center min-w-[80px] bg-red-50/50 dark:bg-red-900/10 text-red-800 dark:text-red-300 border-l-2 border-red-200/50 dark:border-red-800/30">
                      <div className="text-[10px] opacity-70 uppercase tracking-wider">Per Baris</div>
                      <div>Total %</div>
                    </th>
                  )}
                  {extrasAfter.map((l) => (
                    <th key={l} className="text-center">{l}</th>
                  ))}
                </>
              )}
              {isB3 ? (
                <>
                  <th>Keterangan B3 &amp; Spill Kit</th>
                  <th>Keterangan Eyewasher &amp; Bodywasher</th>
                </>
              ) : (
                <th>Keterangan</th>
              )}
              <th>Foto</th>
            </tr>
          </thead>
          <tbody>
            {sortedSubmissions.map((sub, idx) => {
              // Construct Keterangan
              let tagPrefix = "";
              if (sub.tags && sub.tags.length > 0) {
                if (isAPD) {
                  const counts: Record<string, number> = {};
                  sub.tags.forEach((t: string) => {
                    counts[t] = (counts[t] || 0) + 1;
                  });
                  const formattedCounts = Object.entries(counts)
                    .map(([name, count]) => `${count} ${name}`)
                    .join(", ");
                  tagPrefix = `[Tidak patuh: ${formattedCounts}] `;
                } else if (isB3) {
                  tagPrefix = `[Sub-unit bermasalah: ${sub.tags.join(", ")}] `;
                } else {
                  tagPrefix = `[${sub.tags.join(", ")}] `;
                }
              }

              return (
                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <td className="text-center text-gray-500 dark:text-gray-400">{idx + 1}</td>
                  <td className="text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatTimestamp(sub.tanggalPemantauan || sub.timestamp) || "-"}</td>
                  <td className="font-medium text-gray-800 dark:text-gray-100 whitespace-nowrap">{sub.namaPetugas || "-"}</td>
                  <td className="text-gray-700 dark:text-gray-300">{sub.location || "-"}</td>
                  <td className="text-center text-gray-600 dark:text-gray-300">{sub.patroliKe || "-"}</td>

                  {isSosialisasi ? (
                    <>
                      <td className="text-gray-700 dark:text-gray-300">{getExtraValue(sub, "Topik")}</td>
                      <td className="text-gray-700 dark:text-gray-300">{getExtraValue(sub, "Sasaran")}</td>
                    </>
                  ) : (
                    <>
                      {extrasBefore.map((l) => {
                        const valTerlihat = getExtraValue(sub, l);
                        if (isMasterComparison) {
                          const mRow = getMasterRow(sub.location);
                          let valSeharusnyaStr = mRow && mRow[l] !== undefined && mRow[l] !== "" ? String(mRow[l]) : "-";
                          
                          const numTerlihat = parseInt(valTerlihat as string, 10) || 0;
                          let numSeharusnya = parseInt(valSeharusnyaStr, 10) || 0;

                          // Fallback to form data (Terlihat) if Master data for Seharusnya is 0 or missing
                          if (numSeharusnya === 0 || valSeharusnyaStr === "-") {
                            valSeharusnyaStr = numTerlihat.toString();
                            numSeharusnya = numTerlihat;
                          }

                          const isKurang = numTerlihat < numSeharusnya;

                          return (
                            <React.Fragment key={l}>
                              <td className="text-center font-semibold !text-blue-700 dark:!text-blue-400 bg-blue-50/20 dark:bg-blue-900/5">
                                {valSeharusnyaStr}
                              </td>
                              <td className={`text-center font-semibold ${
                                isKurang 
                                  ? "!text-red-700 dark:!text-red-400 bg-red-50/50 dark:bg-red-900/10" 
                                  : "!text-emerald-700 dark:!text-emerald-400 bg-emerald-50/20 dark:bg-emerald-900/5"
                              }`}>
                                {valTerlihat}
                              </td>
                            </React.Fragment>
                          );
                        }
                        return (
                          <td key={l} className="text-center text-gray-600 dark:text-gray-300">
                            {valTerlihat}
                          </td>
                        );
                      })}
                      
                      {(isAPAR || isLuarGedung) && (() => {
                        const mRow = getMasterRow(sub.location);
                        let totalApar = 0;
                        if (mRow) {
                          if (isAPAR) {
                            const numPowder = parseInt(mRow["Jumlah APAR Powder"], 10) || 0;
                            const numCo2 = parseInt(mRow["Jumlah APAR CO2"], 10) || 0;
                            totalApar = numPowder + numCo2;
                          } else {
                            const numPowder6 = parseInt(mRow["Jumlah APAR Powder 6 kg"], 10) || 0;
                            const numPowder25 = parseInt(mRow["Jumlah APAR Powder 25 kg"], 10) || 0;
                            const numCo2 = parseInt(mRow["Jumlah APAR CO2"], 10) || 0;
                            totalApar = numPowder6 + numPowder25 + numCo2;
                          }
                        }
                        
                        // Fallback to Terlihat (form data) if Master Data is missing or returned 0
                        if (totalApar === 0) {
                          if (isAPAR) {
                            const numPowder = parseInt(getExtraValue(sub, "Jumlah APAR Powder") as string, 10) || 0;
                            const numCo2 = parseInt(getExtraValue(sub, "Jumlah APAR CO2") as string, 10) || 0;
                            totalApar = numPowder + numCo2;
                          } else if (isLuarGedung) {
                            const numPowder6 = parseInt(getExtraValue(sub, "Jumlah APAR Powder 6 kg") as string, 10) || 0;
                            const numPowder25 = parseInt(getExtraValue(sub, "Jumlah APAR Powder 25 kg") as string, 10) || 0;
                            const numCo2 = parseInt(getExtraValue(sub, "Jumlah APAR CO2") as string, 10) || 0;
                            totalApar = numPowder6 + numPowder25 + numCo2;
                          }
                        }
                        return (
                          <td className="text-center font-bold text-blue-700 dark:text-blue-400 bg-blue-50/20 dark:bg-blue-900/5">
                            {totalApar}
                          </td>
                        );
                      })()}
                      
                      {isAPD && (() => {
                        const mRow = getMasterRow(sub.location);
                        const totalKaryawan = mRow ? (parseInt(mRow["Jumlah Karyawan"], 10) || 0) : 0;
                        return (
                          <td className="text-center font-bold text-blue-700 dark:text-blue-400 bg-blue-50/20 dark:bg-blue-900/5">
                            {totalKaryawan}
                          </td>
                        );
                      })()}

                      {moduleDef.questions?.map((q: any, qIdx: number) => {
                        const ans = getAnswerFor(sub, q.sheetHeader);
                        const colColor = Q_COLORS[qIdx % Q_COLORS.length];
                        
                        if (isAPAR || isLuarGedung) {
                          const mRow = getMasterRow(sub.location);
                          let totalApar = 0;
                          if (mRow) {
                            if (isAPAR) {
                              const numPowder = parseInt(mRow["Jumlah APAR Powder"], 10) || 0;
                              const numCo2 = parseInt(mRow["Jumlah APAR CO2"], 10) || 0;
                              totalApar = numPowder + numCo2;
                            } else {
                              const numPowder6 = parseInt(mRow["Jumlah APAR Powder 6 kg"], 10) || 0;
                              const numPowder25 = parseInt(mRow["Jumlah APAR Powder 25 kg"], 10) || 0;
                              const numCo2 = parseInt(mRow["Jumlah APAR CO2"], 10) || 0;
                              totalApar = numPowder6 + numPowder25 + numCo2;
                            }
                          }
                          
                          // Fallback to Terlihat (form data) if Master Data is missing or returned 0
                          if (totalApar === 0) {
                            if (isAPAR) {
                              const numPowder = parseInt(getExtraValue(sub, "Jumlah APAR Powder") as string, 10) || 0;
                              const numCo2 = parseInt(getExtraValue(sub, "Jumlah APAR CO2") as string, 10) || 0;
                              totalApar = numPowder + numCo2;
                            } else if (isLuarGedung) {
                              const numPowder6 = parseInt(getExtraValue(sub, "Jumlah APAR Powder 6 kg") as string, 10) || 0;
                              const numPowder25 = parseInt(getExtraValue(sub, "Jumlah APAR Powder 25 kg") as string, 10) || 0;
                              const numCo2 = parseInt(getExtraValue(sub, "Jumlah APAR CO2") as string, 10) || 0;
                              totalApar = numPowder6 + numPowder25 + numCo2;
                            }
                          }
                          
                          if (ans === "Ya") {
                            return <td key={q.sheetHeader} className={`text-center font-bold text-emerald-600 dark:text-emerald-400 ${colColor}`}>{totalApar}</td>;
                          } else if (ans === "Tidak") {
                            let nonCompliant = totalApar;
                            const desc = sub.description || "";
                            if (q.label.includes("Terjangkau")) {
                              const match = desc.match(/TJ[:=]\s*(\d+)/i);
                              if (match) nonCompliant = parseInt(match[1]);
                            } else if (q.label.includes("Rambu")) {
                              const match = desc.match(/RS[:=]\s*(\d+)/i);
                              if (match) nonCompliant = parseInt(match[1]);
                            } else if (q.label.includes("Kartu")) {
                              const match = desc.match(/KP[:=]\s*(\d+)/i);
                              if (match) nonCompliant = parseInt(match[1]);
                            }
                            const compliant = Math.max(0, totalApar - nonCompliant);
                            
                            return (
                              <td key={q.sheetHeader} className={`text-center font-bold ${colColor} ${compliant < totalApar ? '!bg-red-50/80 dark:!bg-red-900/20 !text-red-600 dark:!text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {compliant}
                              </td>
                            );
                          }
                        }
                        
                        if (isB3 && (q.label === "Penyimpanan B3" || q.label === "Ketersediaan SDS")) {
                          const mRow = getMasterRow(sub.location);
                          let totalLemari = mRow ? (parseInt(mRow["Jumlah Lemari B3"], 10) || 0) : 0;
                          if (totalLemari === 0) {
                            totalLemari = parseInt(getExtraValue(sub, "Jumlah Lemari B3") as string, 10) || 0;
                          }
                          
                          if (ans === "Ya") {
                            return <td key={q.sheetHeader} className={`text-center font-bold text-emerald-600 dark:text-emerald-400 ${colColor}`}>{totalLemari}</td>;
                          } else if (ans === "Tidak") {
                            const nonCompliant = (sub.tags && sub.tags.length > 0) ? sub.tags.length : totalLemari;
                            const compliant = Math.max(0, totalLemari - nonCompliant);
                            
                            return (
                              <td key={q.sheetHeader} className={`text-center font-bold ${colColor} ${compliant < totalLemari ? '!bg-red-50/80 dark:!bg-red-900/20 !text-red-600 dark:!text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {compliant}
                              </td>
                            );
                          }
                        }
                        
                        if (isAPD) {
                          const mRow = getMasterRow(sub.location);
                          const totalKaryawan = mRow ? (parseInt(mRow["Jumlah Karyawan"], 10) || 0) : 0;
                          
                          if (ans === "Ya") {
                            return <td key={q.sheetHeader} className={`text-center font-bold text-emerald-600 dark:text-emerald-400 ${colColor}`}>{totalKaryawan}</td>;
                          } else if (ans === "Tidak") {
                            let nonCompliant = sub.tags ? sub.tags.filter((t: any) => !masterProfesiNames.includes(t.toLowerCase())).length : 0;
                            if (nonCompliant === 0 && (!sub.tags || sub.tags.length === 0)) nonCompliant = 1; // fallback if tags are empty but they said Tidak
                            let compliant = Math.max(0, totalKaryawan - nonCompliant);
                            
                            return (
                              <td key={q.sheetHeader} className={`text-center font-bold ${colColor} ${compliant < totalKaryawan ? '!bg-red-50/80 dark:!bg-red-900/20 !text-red-600 dark:!text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {compliant}
                              </td>
                            );
                          }
                        }
                        
                        return (
                          <td key={q.sheetHeader} className={`text-center ${colColor}`}>
                            <JawabanBadge jawaban={ans} />
                          </td>
                        );
                      })}
                      
                      {(isAPAR || isLuarGedung) && (() => {
                        const mRow = getMasterRow(sub.location);
                        let totalApar = 0;
                        if (mRow) {
                          if (isAPAR) {
                            const numPowder = parseInt(mRow["Jumlah APAR Powder"], 10) || 0;
                            const numCo2 = parseInt(mRow["Jumlah APAR CO2"], 10) || 0;
                            totalApar = numPowder + numCo2;
                          } else {
                            const numPowder6 = parseInt(mRow["Jumlah APAR Powder 6 kg"], 10) || 0;
                            const numPowder25 = parseInt(mRow["Jumlah APAR Powder 25 kg"], 10) || 0;
                            const numCo2 = parseInt(mRow["Jumlah APAR CO2"], 10) || 0;
                            totalApar = numPowder6 + numPowder25 + numCo2;
                          }
                        }
                        
                        // Fallback to Terlihat (form data) if Master Data is missing or returned 0
                        if (totalApar === 0) {
                          if (isAPAR) {
                            const numPowder = parseInt(getExtraValue(sub, "Jumlah APAR Powder") as string, 10) || 0;
                            const numCo2 = parseInt(getExtraValue(sub, "Jumlah APAR CO2") as string, 10) || 0;
                            totalApar = numPowder + numCo2;
                          } else if (isLuarGedung) {
                            const numPowder6 = parseInt(getExtraValue(sub, "Jumlah APAR Powder 6 kg") as string, 10) || 0;
                            const numPowder25 = parseInt(getExtraValue(sub, "Jumlah APAR Powder 25 kg") as string, 10) || 0;
                            const numCo2 = parseInt(getExtraValue(sub, "Jumlah APAR CO2") as string, 10) || 0;
                            totalApar = numPowder6 + numPowder25 + numCo2;
                          }
                        }
                        
                        let sumCompliant = 0;
                        let maxCompliant = 0;
                        
                        moduleDef.questions?.forEach((q: any) => {
                          const ans = getAnswerFor(sub, q.sheetHeader);
                          if (ans === "N/A" || ans === "") return;
                          
                          maxCompliant += totalApar;
                          if (ans === "Ya") {
                            sumCompliant += totalApar;
                          } else if (ans === "Tidak") {
                            let nonCompliant = totalApar;
                            const desc = sub.description || "";
                            if (q.label.includes("Terjangkau")) {
                              const match = desc.match(/TJ[:=]\s*(\d+)/i);
                              if (match) nonCompliant = parseInt(match[1]);
                            } else if (q.label.includes("Rambu")) {
                              const match = desc.match(/RS[:=]\s*(\d+)/i);
                              if (match) nonCompliant = parseInt(match[1]);
                            } else if (q.label.includes("Kartu")) {
                              const match = desc.match(/KP[:=]\s*(\d+)/i);
                              if (match) nonCompliant = parseInt(match[1]);
                            }
                            const compliant = Math.max(0, totalApar - nonCompliant);
                            sumCompliant += compliant;
                          }
                        });
                        
                        const rowPct = maxCompliant === 0 ? "-" : Number(((sumCompliant / maxCompliant) * 100).toFixed(2)) + "%";
                        
                        return (
                          <>
                            <td className="text-center font-bold text-green-700 dark:text-green-400 bg-green-50/30 dark:bg-green-900/10 border-l-2 border-green-100 dark:border-green-900/50">
                              {maxCompliant > 0 ? sumCompliant : "-"}
                            </td>
                            <td className="text-center font-bold text-red-700 dark:text-red-400 bg-red-50/30 dark:bg-red-900/10 border-l-2 border-red-100 dark:border-red-900/50">
                              {maxCompliant > 0 ? maxCompliant - sumCompliant : "-"}
                            </td>
                            <td className="text-center font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/10 border-l-2 border-indigo-100 dark:border-indigo-900/50">
                              {rowPct}
                            </td>
                          </>
                        );
                      })()}
                      
                      {isAPD && (() => {
                        const mRow = getMasterRow(sub.location);
                        const totalKaryawan = mRow ? (parseInt(mRow["Jumlah Karyawan"], 10) || 0) : 0;
                        
                        let sumCompliant = 0;
                        let maxCompliant = 0;
                        
                        moduleDef.questions?.forEach((q: any) => {
                          const ans = getAnswerFor(sub, q.sheetHeader);
                          if (ans === "N/A" || ans === "") return;
                          
                          maxCompliant += totalKaryawan;
                          if (ans === "Ya") {
                            sumCompliant += totalKaryawan;
                          } else if (ans === "Tidak") {
                            let nonCompliant = sub.tags ? sub.tags.length : 0;
                            if (nonCompliant === 0) nonCompliant = 1;
                            let compliant = Math.max(0, totalKaryawan - nonCompliant);
                            sumCompliant += compliant;
                          }
                        });
                        
                        const rowPct = maxCompliant === 0 ? "-" : Number(((sumCompliant / maxCompliant) * 100).toFixed(2)) + "%";
                        
                        return (
                          <td className="text-center font-bold text-red-700 dark:text-red-400 bg-red-50/30 dark:bg-red-900/10 border-l-2 border-red-100 dark:border-red-900/50">
                            {rowPct}
                          </td>
                        );
                      })()}
                      
                      {extrasAfter.map((l) => (
                        <td key={l} className="text-center text-gray-600 dark:text-gray-300 whitespace-nowrap">
                          {getExtraValue(sub, l)}
                        </td>
                      ))}
                    </>
                  )}

                  {isB3 ? (
                    <>
                      <td className="text-gray-600 dark:text-gray-300 min-w-[200px]">
                        {tagPrefix && <span className="font-semibold text-amber-600 dark:text-amber-500">{tagPrefix}</span>}
                        {sub.description && <span>{sub.description}</span>}
                        {!tagPrefix && !sub.description && "-"}
                      </td>
                      {(() => {
                        const ewDesc = sub.secondaryDescription || "";
                        return (
                          <td className="text-gray-600 dark:text-gray-300 min-w-[200px]">
                            {ewDesc ? <span>{ewDesc}</span> : "-"}
                          </td>
                        );
                      })()}
                      <td className="text-gray-600 dark:text-gray-300 min-w-[120px]">
                        {(() => {
                          const hasPrimary = !!sub.photoUrl;
                          const hasSecondary = !!sub.secondaryPhotoUrl;
                          if (!hasPrimary && !hasSecondary) return "-";
                          
                          return (
                            <div className="flex flex-col gap-1">
                              {hasPrimary && (
                                <a
                                  href={sub.photoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium whitespace-nowrap"
                                >
                                  📷 {isB3 ? "Foto B3" : "Foto"}
                                </a>
                              )}
                              {hasSecondary && (
                                <a
                                  href={sub.secondaryPhotoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium whitespace-nowrap"
                                >
                                  📷 Foto Eyewasher
                                </a>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="text-gray-600 dark:text-gray-300 min-w-[200px]">
                        {tagPrefix && <span className="font-semibold text-amber-600 dark:text-amber-500">{tagPrefix}</span>}
                        {sub.description && <span>{sub.description}</span>}
                        {!tagPrefix && !sub.description && "-"}
                      </td>
                      <td className="text-gray-600 dark:text-gray-300 min-w-[120px]">
                        {sub.photoUrl ? (
                          <a
                            href={sub.photoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium whitespace-nowrap"
                          >
                            📷 Lihat Foto
                          </a>
                        ) : "-"}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>


          {questionResults && questionResults.length > 0 && !isSosialisasi && (
            <tfoot className="bg-gray-50 dark:bg-slate-800 border-t-2 border-gray-200 dark:border-slate-700">
              <tr className="bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800/50">
                <td colSpan={5} className="text-right font-bold text-red-800 dark:text-red-400 py-3 pr-4">
                  TOTAL KEPATUHAN: {totalPct ?? 0}%
                </td>
                {extrasBefore.map((l) => {
                  if (isMasterComparison) {
                    const sumSeharusnya = sortedSubmissions.reduce((acc, sub) => {
                      const mRow = getMasterRow(sub.location);
                      const val = mRow && mRow[l] !== undefined ? mRow[l] : 0;
                      return acc + (parseInt(val as string, 10) || 0);
                    }, 0);
                    
                    const sumTerlihat = sortedSubmissions.reduce((acc, sub) => {
                      return acc + (parseInt(getExtraValue(sub, l) as string, 10) || 0);
                    }, 0);
                    
                    return (
                      <React.Fragment key={l}>
                        <td className="text-center font-bold text-red-800 dark:text-red-400">{sumSeharusnya}</td>
                        <td className="text-center font-bold text-red-800 dark:text-red-400">{sumTerlihat}</td>
                      </React.Fragment>
                    );
                  } else {
                    const isNumeric = sortedSubmissions.some(sub => !isNaN(parseInt(getExtraValue(sub, l) as string, 10)));
                    if (isNumeric) {
                      const sum = sortedSubmissions.reduce((acc, sub) => acc + (parseInt(getExtraValue(sub, l) as string, 10) || 0), 0);
                      return <td key={l} className="text-center font-bold text-red-800 dark:text-red-400">{sum}</td>;
                    }
                    return <td key={l} className="text-center font-bold text-red-800 dark:text-red-400">-</td>;
                  }
                })}
                {(isAPAR || isLuarGedung) && (() => {
                  const sumApar = sortedSubmissions.reduce((acc, sub) => {
                    const mRow = getMasterRow(sub.location);
                    let totalApar = 0;
                    if (mRow) {
                      if (isAPAR) {
                        const numPowder = parseInt(mRow["Jumlah APAR Powder"], 10) || 0;
                        const numCo2 = parseInt(mRow["Jumlah APAR CO2"], 10) || 0;
                        totalApar = numPowder + numCo2;
                      } else {
                        const numPowder6 = parseInt(mRow["Jumlah APAR Powder 6 kg"], 10) || 0;
                        const numPowder25 = parseInt(mRow["Jumlah APAR Powder 25 kg"], 10) || 0;
                        const numCo2 = parseInt(mRow["Jumlah APAR CO2"], 10) || 0;
                        totalApar = numPowder6 + numPowder25 + numCo2;
                      }
                    } else {
                      if (isAPAR) {
                        const numPowder = parseInt(getExtraValue(sub, "Jumlah APAR Powder") as string, 10) || 0;
                        const numCo2 = parseInt(getExtraValue(sub, "Jumlah APAR CO2") as string, 10) || 0;
                        totalApar = numPowder + numCo2;
                      } else if (isLuarGedung) {
                        const numPowder6 = parseInt(getExtraValue(sub, "Jumlah APAR Powder 6 kg") as string, 10) || 0;
                        const numPowder25 = parseInt(getExtraValue(sub, "Jumlah APAR Powder 25 kg") as string, 10) || 0;
                        const numCo2 = parseInt(getExtraValue(sub, "Jumlah APAR CO2") as string, 10) || 0;
                        totalApar = numPowder6 + numPowder25 + numCo2;
                      }
                    }
                    return acc + totalApar;
                  }, 0);
                  return <td className="text-center font-bold text-blue-700 dark:text-blue-400 bg-blue-50/20 dark:bg-blue-900/5">{sumApar}</td>;
                })()}
                {isAPD && (() => {
                  const sumKaryawan = sortedSubmissions.reduce((acc, sub) => {
                    const mRow = getMasterRow(sub.location);
                    const totalKaryawan = mRow ? (parseInt(mRow["Jumlah Karyawan"], 10) || 0) : 0;
                    return acc + totalKaryawan;
                  }, 0);
                  return <td className="text-center font-bold text-blue-700 dark:text-blue-400 bg-blue-50/20 dark:bg-blue-900/5">{sumKaryawan}</td>;
                })()}
                {moduleDef.questions?.map((q: any) => {
                  const qr = questionResults.find((res: any) => res.sheetHeader === q.sheetHeader);
                  if (!qr) return <td key={q.sheetHeader} className="text-center">-</td>;
                  
                  const isSaranaProteksi = moduleDef.slug === "sarana-proteksi";
                  const total = qr.countYa + qr.countTidak; // countTidak sudah termasuk Setengah dan TidakAda
                  const yaPct = total > 0 ? Number(((qr.countYa / total) * 100).toFixed(2)) : 0;
                  
                  // Hitung nilai dan persentase untuk indikator ke-2 dan ke-3
                  let countIndikator2 = qr.countTidak;
                  let countIndikator3 = qr.countTidakAda ?? 0;
                  let labelIndikator2 = "Tidak";
                  let labelIndikator3 = "Tidak Ada";
                  
                  if (isHydrant) {
                    countIndikator2 = qr.countTidak - countIndikator3;
                    labelIndikator3 = "Tidak ada hydrant";
                  } else if (isSaranaProteksi) {
                    countIndikator2 = qr.countSetengah ?? 0;
                    labelIndikator2 = "Kurang Baik";
                    labelIndikator3 = "Tidak"; // Tidak Ada diubah labelnya jadi Tidak
                  }
                  
                  const pctIndikator2 = total > 0 ? Number(((countIndikator2 / total) * 100).toFixed(2)) : 0;
                  const pctIndikator3 = total > 0 ? Number(((countIndikator3 / total) * 100).toFixed(2)) : 0;

                  const hasData = total > 0 || countIndikator3 > 0;

                  return (
                    <td key={q.sheetHeader} className="text-center py-2 align-top">
                      {hasData ? (
                        <div className="flex flex-col gap-2">
                          {/* Indikator 1: Ya */}
                          <div className="flex flex-col items-center justify-center bg-green-50/50 dark:bg-green-900/10 p-1.5 rounded border border-green-100 dark:border-green-800/50">
                            <span className="text-[9px] font-semibold text-green-600 dark:text-green-500 mb-0.5">Ya</span>
                            <span className="font-bold text-green-700 dark:text-green-400">{qr.countYa}</span>
                            {total > 0 && <span className="text-[10px] font-bold bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100 px-1.5 py-0.5 rounded-md leading-none mt-1">{yaPct}%</span>}
                          </div>
                          
                          {/* Indikator 2: Tidak / Kurang Baik */}
                          <div className={`flex flex-col items-center justify-center p-1.5 rounded border ${
                            isSaranaProteksi 
                              ? "bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/50" 
                              : "bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-800/50"
                          }`}>
                            <span className={`text-[9px] font-semibold mb-0.5 ${
                              isSaranaProteksi ? "text-amber-600 dark:text-amber-500" : "text-red-600 dark:text-red-500"
                            }`}>{labelIndikator2}</span>
                            <span className={`font-bold ${
                              isSaranaProteksi ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400"
                            }`}>{countIndikator2}</span>
                            {total > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none mt-1 ${
                              isSaranaProteksi 
                                ? "bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100" 
                                : "bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100"
                            }`}>{pctIndikator2}%</span>}
                          </div>
                          
                          {/* Indikator 3: Tidak Ada (atau Tidak untuk sarana proteksi) */}
                          {(isHydrant || isSaranaProteksi) && qr.countTidakAda !== undefined && (
                            <div className={`flex flex-col items-center justify-center p-1.5 rounded border ${
                              isSaranaProteksi 
                                ? "bg-red-100/50 dark:bg-red-900/30 border-red-200 dark:border-red-700/50"
                                : (isHydrant ? "bg-orange-50/50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700/50" : "bg-red-100/50 dark:bg-red-900/30 border-red-200 dark:border-red-700/50")
                            }`}>
                              <span className={`text-[9px] font-semibold mb-0.5 text-center leading-tight ${
                                isSaranaProteksi 
                                  ? "text-red-800 dark:text-red-300"
                                  : (isHydrant ? "text-orange-700 dark:text-orange-300" : "text-red-800 dark:text-red-300")
                              }`}>
                                {labelIndikator3}
                              </span>
                              <span className={`font-bold ${
                                isSaranaProteksi 
                                  ? "text-red-800 dark:text-red-400"
                                  : (isHydrant ? "text-orange-700 dark:text-orange-400" : "text-red-800 dark:text-red-400")
                              }`}>{countIndikator3}</span>
                              {total > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none mt-1 ${
                                isSaranaProteksi 
                                  ? "bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100"
                                  : (isHydrant ? "bg-orange-200 dark:bg-orange-800 text-orange-900 dark:text-orange-100" : "bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100")
                              }`}>{pctIndikator3}%</span>}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="font-bold text-gray-400">-</span>
                      )}
                    </td>
                  );
                })}
                {(isAPAR || isLuarGedung) && (() => {
                  let allCompliant = 0;
                  let allExpected = 0;
                  
                  sortedSubmissions.forEach(sub => {
                    const mRow = getMasterRow(sub.location);
                    let totalApar = 0;
                    if (mRow) {
                      if (isAPAR) {
                        const numPowder = parseInt(mRow["Jumlah APAR Powder"], 10) || 0;
                        const numCo2 = parseInt(mRow["Jumlah APAR CO2"], 10) || 0;
                        totalApar = numPowder + numCo2;
                      } else {
                        const numPowder6 = parseInt(mRow["Jumlah APAR Powder 6 kg"], 10) || 0;
                        const numPowder25 = parseInt(mRow["Jumlah APAR Powder 25 kg"], 10) || 0;
                        const numCo2 = parseInt(mRow["Jumlah APAR CO2"], 10) || 0;
                        totalApar = numPowder6 + numPowder25 + numCo2;
                      }
                    } else {
                      if (isAPAR) {
                        const numPowder = parseInt(getExtraValue(sub, "Jumlah APAR Powder") as string, 10) || 0;
                        const numCo2 = parseInt(getExtraValue(sub, "Jumlah APAR CO2") as string, 10) || 0;
                        totalApar = numPowder + numCo2;
                      } else if (isLuarGedung) {
                        const numPowder6 = parseInt(getExtraValue(sub, "Jumlah APAR Powder 6 kg") as string, 10) || 0;
                        const numPowder25 = parseInt(getExtraValue(sub, "Jumlah APAR Powder 25 kg") as string, 10) || 0;
                        const numCo2 = parseInt(getExtraValue(sub, "Jumlah APAR CO2") as string, 10) || 0;
                        totalApar = numPowder6 + numPowder25 + numCo2;
                      }
                    }
                    
                    moduleDef.questions?.forEach((q: any) => {
                      const ans = getAnswerFor(sub, q.sheetHeader);
                      if (ans === "N/A" || ans === "") return;
                      allExpected += totalApar;
                      if (ans === "Ya") allCompliant += totalApar;
                      else if (ans === "Tidak") {
                        let nonCompliant = totalApar;
                        const desc = sub.description || "";
                        if (q.label.includes("Terjangkau")) {
                          const match = desc.match(/TJ[:=]\s*(\d+)/i);
                          if (match) nonCompliant = parseInt(match[1]);
                        } else if (q.label.includes("Rambu")) {
                          const match = desc.match(/RS[:=]\s*(\d+)/i);
                          if (match) nonCompliant = parseInt(match[1]);
                        } else if (q.label.includes("Kartu")) {
                          const match = desc.match(/KP[:=]\s*(\d+)/i);
                          if (match) nonCompliant = parseInt(match[1]);
                        }
                        allCompliant += Math.max(0, totalApar - nonCompliant);
                      }
                    });
                  });
                  
                  const allPct = allExpected > 0 ? Number(((allCompliant / allExpected) * 100).toFixed(2)) : null;
                  
                  return (
                    <>
                      <td className="text-center py-2 font-bold bg-green-100/50 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-l-2 border-green-200 dark:border-green-800">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span>{allCompliant}</span>
                          {allPct !== null && <span className="text-[10px] bg-green-200 dark:bg-green-800 px-1.5 py-0.5 rounded-md leading-none">{allPct}%</span>}
                        </div>
                      </td>
                      <td className="text-center py-2 font-bold bg-red-100/50 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-l-2 border-red-200 dark:border-red-800">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span>{allExpected - allCompliant}</span>
                          {allPct !== null && <span className="text-[10px] bg-red-200 dark:bg-red-800 px-1.5 py-0.5 rounded-md leading-none">{100 - allPct}%</span>}
                        </div>
                      </td>
                      <td className="text-center py-2 font-bold bg-indigo-100/50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 border-l-2 border-indigo-200 dark:border-indigo-800">
                        {allPct !== null ? allPct + "%" : "-"}
                      </td>
                    </>
                  );
                })()}
                
                {isAPD && (
                  <td className="text-center font-bold text-red-800 dark:text-red-400 bg-red-100/50 dark:bg-red-900/30 border-l-2 border-red-200 dark:border-red-800">
                    {totalPct ?? 0}%
                  </td>
                )}
                {extrasAfter.map((l) => {
                  if (l === "Tgl. Pemeliharaan Terakhir") {
                    return <td key={l} className="text-center font-bold text-red-800 dark:text-red-400">-</td>;
                  }
                  const isNumeric = sortedSubmissions.some(sub => !isNaN(parseInt(getExtraValue(sub, l) as string, 10)));
                  if (isNumeric) {
                    const sum = sortedSubmissions.reduce((acc, sub) => acc + (parseInt(getExtraValue(sub, l) as string, 10) || 0), 0);
                    return <td key={l} className="text-center font-bold text-red-800 dark:text-red-400">{sum}</td>;
                  }
                  return <td key={l} className="text-center font-bold text-red-800 dark:text-red-400">-</td>;
                })}
                {isB3 ? <><td></td><td></td></> : <td></td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
