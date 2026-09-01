"use client";

import { useEffect, useState, useRef } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import { formatTanggal, downloadWithSavePrompt } from "@/lib/utils";


export default function TemuanPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Filters
  const [bulan, setBulan] = useState(() => {
    const today = new Date();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    return `${today.getFullYear()}-${m}`;
  });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        let url = `/api/patrol-data?mode=temuan&bulan=${bulan}`;
        if (startDate && endDate) {
          url += `&startDate=${startDate}&endDate=${endDate}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error("Gagal mengambil data temuan");
        const json = await res.json();
        setData(json.submissions || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [bulan, startDate, endDate]);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Rekap Temuan');

      sheet.columns = [
        { header: 'No', key: 'no', width: 5 },
        { header: 'Tanggal', key: 'tanggal', width: 15 },
        { header: 'Ruangan/Lokasi', key: 'ruangan', width: 25 },
        { header: 'Kategori', key: 'kategori', width: 25 },
        { header: 'Temuan/Keluhan', key: 'temuan', width: 45 },
        { header: 'URL Foto', key: 'foto', width: 40 },
      ];

      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).alignment = { horizontal: 'center' };

      data.forEach((row, i) => {
        sheet.addRow({
          no: i + 1,
          tanggal: formatTanggal(row.tanggalPemantauan),
          ruangan: row.location || "-",
          kategori: row.moduleTitle,
          temuan: row.description || "Hanya foto",
          foto: row.photoUrl || "-",
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      await downloadWithSavePrompt(blob, `Rekap_Temuan_K3_${startDate && endDate ? `${startDate}_${endDate}` : bulan}.xlsx`);
    } catch (err) {
      console.error("Gagal export Excel:", err);
      alert("Terjadi kesalahan saat membuat Excel.");
    } finally {
      setIsExporting(false);
    }
  };



  if (loading && data.length === 0) return <LoadingScreen />;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-gray-100 flex items-center gap-2">
            🚨 Rekap Temuan & Keluhan
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Menampilkan seluruh temuan, keluhan, dan foto dari semua modul patroli.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Rentang Tanggal Filter */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Rentang:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (e.target.value && endDate) setBulan("");
              }}
              className="text-sm bg-transparent border-none focus:ring-0 text-gray-700 dark:text-gray-300 p-0 cursor-pointer"
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                if (startDate && e.target.value) setBulan("");
              }}
              className="text-sm bg-transparent border-none focus:ring-0 text-gray-700 dark:text-gray-300 p-0 cursor-pointer"
            />
          </div>
          <span className="text-gray-300 dark:text-slate-700 font-bold">atau</span>
          
          <input
            type="month"
            value={bulan}
            onChange={(e) => {
              setBulan(e.target.value);
              setStartDate("");
              setEndDate("");
            }}
            className="form-control text-sm font-semibold"
          />

          <button
            onClick={handleExportExcel}
            disabled={isExporting || data.length === 0}
            className="btn-success text-sm flex items-center gap-2 px-4 py-2 rounded-lg font-semibold shadow-sm"
          >
            {isExporting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <span>📊</span>
            )}
            Unduh Excel
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-8 text-center text-red-500 bg-red-50 dark:bg-red-900/10 rounded-xl">
          <p className="font-bold">Gagal memuat data</p>
          <p className="text-sm">{error}</p>
        </div>
      ) : (
        <div className="card overflow-hidden" ref={contentRef}>
          {/* Header untuk di dalam PDF */}
          <div className="hidden pdf-header p-6 bg-white border-b border-gray-100">
            <h2 className="text-xl font-black text-center text-gray-800">Laporan Rekap Temuan & Keluhan K3</h2>
            <p className="text-center text-gray-500 mt-1">
              Periode: {startDate && endDate ? `${formatTanggal(startDate)} s/d ${formatTanggal(endDate)}` : bulan}
            </p>
          </div>

          {data.length === 0 ? (
            <div className="p-16 text-center">
              <span className="text-4xl block mb-3">✅</span>
              <p className="text-gray-500 dark:text-gray-400 font-medium">Tidak ada temuan atau keluhan pada periode ini.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table id="temuan-table" className="data-table text-sm w-full text-left">
                <thead>
                  <tr>
                    <th className="w-12 text-center">No</th>
                    <th className="w-32">Tanggal</th>
                    <th className="w-48">Ruangan/Lokasi</th>
                    <th className="w-48">Kategori</th>
                    <th>Temuan/Keluhan</th>
                    <th className="w-32 text-center">Foto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={row.id || i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      <td className="text-center font-medium text-gray-500">{i + 1}</td>
                      <td className="text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {formatTanggal(row.tanggalPemantauan)}
                      </td>
                      <td className="font-medium text-gray-800 dark:text-gray-100">{row.location || "-"}</td>
                      <td className="text-gray-600 dark:text-gray-300 text-xs">
                        {row.moduleTitle}
                      </td>
                      <td className="text-gray-700 dark:text-gray-300">
                        {row.description ? (
                          <span className="whitespace-pre-wrap">{row.description}</span>
                        ) : (
                          <span className="text-gray-400 italic">Hanya foto</span>
                        )}
                      </td>
                      <td className="text-center">
                        {row.photoUrl ? (
                          <a href={row.photoUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--brand)] font-semibold hover:underline">
                            Ada Lampiran
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
