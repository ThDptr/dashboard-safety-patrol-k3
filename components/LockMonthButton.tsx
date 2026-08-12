"use client";

import { useState, useEffect } from "react";
import { Lock, Loader2, CheckCircle2, Info } from "lucide-react";

interface Props {
  bulan: string;
  infoOnlyMode?: boolean;
}

export default function LockMonthButton({ bulan, infoOnlyMode = false }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [checkingLock, setCheckingLock] = useState(true);

  // Cek status kunci bulan ini setiap kali bulan berubah
  useEffect(() => {
    let cancelled = false;
    setCheckingLock(true);
    setIsLocked(false);

    fetch("/api/locked-months")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const months: string[] = data.lockedMonths ?? [];
        setIsLocked(months.includes(bulan));
      })
      .catch(() => {
        // Diam-diam jika gagal — jangan ganggu UI
      })
      .finally(() => {
        if (!cancelled) setCheckingLock(false);
      });

    return () => { cancelled = true; };
  }, [bulan]);

  const handleLock = async () => {
    if (!password) {
      setError("Password harus diisi");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/lock-month", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulan, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengunci data");
      }

      // Invalidate locked-months cache di server
      await fetch("/api/locked-months", { method: "POST" }).catch(() => {});

      setSuccess("Bulan berhasil dikunci!");
      setIsLocked(true);

      setTimeout(() => {
        setIsOpen(false);
        setPassword("");
        setSuccess("");
        // Reload untuk mengambil data baru dari snapshot "Kunci"
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Tampilan tombol saat sudah dikunci ──────────────────────────────────────
  if (!checkingLock && isLocked) {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-100 border border-emerald-300 rounded-md hover:bg-emerald-200 transition-colors cursor-pointer"
          title={`Data bulan ${bulan} sudah dikunci sebagai historis`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Sudah Terkunci
        </button>

        {/* Info modal — bulan sudah dikunci */}
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-5 border-b dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  Bulan {bulan} Sudah Dikunci
                </h3>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex items-start gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    Data master bulan ini (nama ruangan, jumlah pegawai, dll.) telah di-<em>freeze</em>.
                    Saat Anda memfilter ke bulan ini, dashboard akan menampilkan
                    <strong> data historis yang tersimpan</strong>, bukan data master terkini.
                  </p>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Jika ingin mengunci ulang (memperbarui snapshot), gunakan tombol di bawah dengan password admin.
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password Admin (untuk kunci ulang)
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Masukkan password rahasia..."
                    disabled={loading || !!success}
                  />
                </div>

                {error && (
                  <div className="p-2.5 bg-red-50 text-red-600 text-sm rounded-md border border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="p-2.5 bg-green-50 text-green-700 text-sm rounded-md border border-green-200 flex items-center gap-2 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
                    <Lock className="w-4 h-4" />
                    {success}
                  </div>
                )}
              </div>
              <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-2">
                <button
                  onClick={() => { setIsOpen(false); setPassword(""); setError(""); }}
                  disabled={loading || !!success}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Tutup
                </button>
                <button
                  onClick={handleLock}
                  disabled={loading || !!success || !password}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  Kunci Ulang
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Tampilan tombol normal (belum dikunci) ──────────────────────────────────
  if (infoOnlyMode) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={checkingLock}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors disabled:opacity-60"
        title="Kunci data master untuk bulan ini agar tersimpan sebagai historis"
      >
        {checkingLock ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Lock className="w-3.5 h-3.5" />
        )}
        Kunci Data
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-500" />
                Kunci Data Bulan {bulan}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Aksi ini akan mem-<em>freeze</em> (snapshot) data master saat ini untuk bulan{" "}
                <strong>{bulan}</strong> — termasuk nama ruangan, jumlah pegawai, dan parameter
                lainnya. Data ini akan digunakan sebagai acuan historis jika bulan ini difilter
                di masa depan.
              </p>
            </div>

            <div className="p-5 space-y-3">
              <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Setelah dikunci, perubahan pada master data (misalnya perubahan jumlah pegawai
                  di bulan berikutnya) <strong>tidak akan mempengaruhi</strong> data bulan ini.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password Admin
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Masukkan password rahasia..."
                  disabled={loading || !!success}
                  onKeyDown={(e) => { if (e.key === "Enter") handleLock(); }}
                />
              </div>

              {error && (
                <div className="p-2.5 bg-red-50 text-red-600 text-sm rounded-md border border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-2.5 bg-green-50 text-green-700 text-sm rounded-md border border-green-200 flex items-center gap-2 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
                  <Lock className="w-4 h-4" />
                  {success}
                </div>
              )}
            </div>

            <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-2">
              <button
                onClick={() => { setIsOpen(false); setPassword(""); setError(""); }}
                disabled={loading || !!success}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                Batal
              </button>
              <button
                onClick={handleLock}
                disabled={loading || !!success || !password}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Konfirmasi Kunci
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
