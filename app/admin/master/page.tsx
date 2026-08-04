"use client";

import { useState, useEffect, useCallback } from "react";
import LoadingScreen from "@/components/LoadingScreen";

// Konfigurasi schema tabel
const SCHEMAS: Record<string, { label: string; type: string }[]> = {
  "Master Ruangan": [
    { label: "Ruangan", type: "text" },
    { label: "Jumlah APAR Powder", type: "number" },
    { label: "Jumlah APAR CO2", type: "number" },
    { label: "Jumlah Karyawan", type: "number" },
    { label: "Jumlah Lemari B3", type: "number" },
  ],
  "Master Luar": [
    { label: "Lokasi", type: "text" },
    { label: "Jumlah APAR Powder 6 kg", type: "number" },
    { label: "Jumlah APAR Powder 25 kg", type: "number" },
    { label: "Jumlah APAR CO2", type: "number" },
  ],
  "Master Topik": [
    { label: "Topik", type: "text" },
    { label: "Standar Minimum (%)", type: "number" },
  ],
  "Master Pertanyaan": [
    { label: "Topik", type: "text" },
    { label: "Pertanyaan", type: "text" },
    { label: "Deskripsi", type: "text" },
  ],
};

export default function MasterDataAdminPage() {
  // State untuk autentikasi
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");

  const [activeTab, setActiveTab] = useState("Master Ruangan");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State untuk form modal
  const [showModal, setShowModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null); // rowIndex
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [isProfesiModal, setIsProfesiModal] = useState(false);

  const fetchMasterData = useCallback(async (sheetName: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/master?sheetName=${encodeURIComponent(sheetName)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal memuat data master");
      }
      const json = await res.json();
      if (json.status === "success" || Array.isArray(json.data)) {
        setData(json.data || []);
      } else {
        throw new Error(json.message || json.error || "Unknown error");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMasterData(activeTab);
    }
  }, [activeTab, fetchMasterData, isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { verifyPassword } = await import("@/app/actions");
    const isValid = await verifyPassword(passwordInput);
    
    if (isValid) {
      setIsAuthenticated(true);
      setAuthError("");
    } else {
      setAuthError("Password salah!");
    }
  };

  const handleOpenAddModal = () => {
    setFormData({});
    setEditingIndex(null);
    setIsProfesiModal(false);
    setShowModal(true);
  };

  const handleOpenAddProfesi = () => {
    setFormData({
      "Jumlah APAR Powder": 0,
      "Jumlah APAR CO2": 0,
      "Jumlah Lemari B3": 0
    });
    setEditingIndex(null);
    setIsProfesiModal(true);
    setShowModal(true);
  };

  const handleOpenEditModal = (row: any) => {
    const isProfesi = row.Ruangan?.startsWith("**");
    setIsProfesiModal(isProfesi);
    
    const formValues = { ...row };
    if (isProfesi) {
      formValues.Ruangan = formValues.Ruangan.replace("**", "").trim();
    }
    
    setFormData(formValues);
    setEditingIndex(row.rowIndex);
    setShowModal(true);
  };

  const handleDelete = async (rowIndex: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data ini?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/master?sheetName=${encodeURIComponent(activeTab)}&rowIndex=${rowIndex}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal menghapus data");
      await fetchMasterData(activeTab); // refresh
    } catch (e: any) {
      alert("Error: " + e.message);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const finalData = { ...formData };
      if (isProfesiModal) {
        finalData.Ruangan = `** ${finalData.Ruangan}`;
        finalData["Jumlah APAR Powder"] = 0;
        finalData["Jumlah APAR CO2"] = 0;
        finalData["Jumlah Lemari B3"] = 0;
      }

      const isUpdate = editingIndex !== null;
      const method = isUpdate ? "PUT" : "POST";
      const payload = isUpdate
        ? { sheetName: activeTab, rowIndex: editingIndex, rowData: finalData }
        : { sheetName: activeTab, rowData: finalData };

      const res = await fetch("/api/master", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menyimpan data");
      }

      setShowModal(false);
      await fetchMasterData(activeTab);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const currentSchema = SCHEMAS[activeTab];

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-20 card p-8 border border-gray-100 shadow-sm animate-in fade-in zoom-in-95">
        <h1 className="text-2xl font-black text-center mb-2 text-gray-800 dark:text-gray-100">🔒 Admin K3</h1>
        <p className="text-center text-sm text-gray-500 mb-6">Masukkan kata sandi admin untuk mengakses Master Data.</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Kata Sandi..."
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="form-control w-full text-center pr-10"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-3 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              title={showPassword ? "Sembunyikan Sandi" : "Tampilkan Sandi"}
            >
              {showPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
          {authError && <p className="text-red-500 text-xs text-center font-semibold">{authError}</p>}
          <button type="submit" className="btn-primary w-full">Masuk</button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-gray-100 flex items-center gap-2">
            ⚙️ Admin Master Data
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Kelola data master Ruangan dan Area Luar Gedung untuk keperluan dropdown.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-200 dark:border-slate-700">
        {Object.keys(SCHEMAS).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-bold whitespace-nowrap rounded-t-lg transition-colors ${
              activeTab === tab
                ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-500"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {tab === "Master Ruangan" ? "Master Ruangan & Unit Profesi" : tab}
          </button>
        ))}
      </div>

      {/* Action Bar */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
        <h2 className="font-bold text-gray-700 dark:text-gray-300">
          Data {activeTab === "Master Ruangan" ? "Master Ruangan & Unit Profesi" : activeTab}
        </h2>
        <div className="flex gap-2">
          {activeTab === "Master Ruangan" && (
            <button onClick={handleOpenAddProfesi} className="btn-success flex items-center gap-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold transition-all" disabled={loading}>
              <span>+ Tambah Profesi</span>
            </button>
          )}
          <button onClick={handleOpenAddModal} className="btn-primary flex items-center gap-2 text-sm" disabled={loading}>
            <span>+ Tambah {activeTab === "Master Ruangan" ? "Ruangan" : "Data"}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="card overflow-hidden">
        {loading && data.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Memuat data master...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500 bg-red-50 dark:bg-red-900/10">
            <p className="font-bold">Gagal memuat data</p>
            <p className="text-sm">{error}</p>
            <button onClick={() => fetchMasterData(activeTab)} className="mt-4 btn-primary text-xs">Coba Lagi</button>
          </div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <span className="text-3xl block mb-2">📁</span>
            Belum ada data di {activeTab}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table text-sm w-full text-left">
              <thead>
                <tr>
                  <th className="w-12">No</th>
                  {currentSchema.map((col) => (
                    <th key={col.label}>{col.label}</th>
                  ))}
                  <th className="text-right w-24">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={row.rowIndex || i}>
                    <td className="text-center font-medium text-gray-500">{i + 1}</td>
                    {currentSchema.map((col) => (
                      <td key={col.label}>{row[col.label] || "-"}</td>
                    ))}
                    <td>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenEditModal(row)}
                          className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40"
                        >
                          Edit
                        </button>
                        {/* Tombol Hapus sengaja dihilangkan agar Admin tidak merusak perhitungan historis bulan sebelumnya */}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal CRUD */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">
                {editingIndex !== null ? "Edit Data" : "Tambah Data"} {isProfesiModal ? "Unit Profesi" : (activeTab === "Master Ruangan" ? "Ruangan" : activeTab)}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {currentSchema.map((col) => {
                if (isProfesiModal && !["Ruangan", "Jumlah Karyawan"].includes(col.label)) {
                  return null;
                }
                const displayLabel = (isProfesiModal && col.label === "Ruangan") ? "Nama Unit Profesi" : col.label;
                const isReadonly = editingIndex !== null && 
                  ((activeTab === "Master Pertanyaan" && (col.label === "Topik" || col.label === "Pertanyaan")) ||
                  (activeTab === "Master Topik" && col.label === "Topik"));

                return (
                  <div key={col.label}>
                    <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">
                      {displayLabel}
                    </label>
                    <input
                      type={col.type}
                      required
                      value={formData[col.label] || ""}
                      onChange={(e) => setFormData({ ...formData, [col.label]: e.target.value })}
                      className={`form-control w-full text-sm ${isReadonly ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200 dark:bg-slate-800 dark:text-gray-400 dark:border-slate-700' : ''}`}
                      placeholder={`Masukkan ${displayLabel.toLowerCase()}`}
                      disabled={isReadonly}
                    />
                  </div>
                );
              })}

              <div className="pt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700"
                  disabled={submitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary text-sm min-w-[100px] flex justify-center items-center"
                  disabled={submitting}
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    "Simpan"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
