"use client";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { verifySettingsPassword } from "./actions";

const FORM_URL = "https://docs.google.com/forms/d/1aGG59GOZLQ7IGG6Jc1BakbETd8TgXkc-RaSqPI67Igc/edit#responses";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1cX0s-kW_fiGwmN5QQNSww3o2tiG3UK1_CeADJXIC5Ys/edit?usp=sharing";
const MANUAL_BOOK_URL = "https://docs.google.com/document/d/1tjTk21XYwqzbgRvE39rN0T7WQ1Y-OkdyeD7_k2rcL3g/edit?usp=sharing";

export default function SettingsPage() {
  const handleEditFormClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    const pwd = prompt("Masukkan password untuk mengedit form:");
    if (pwd !== null) {
      const isValid = await verifySettingsPassword(pwd);
      if (isValid) {
        window.open(FORM_URL, "_blank");
      } else {
        alert("Password salah!");
      }
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">⚙️ Pengaturan</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tautan akses form pengisian dan data mentah patroli K3
        </p>
      </div>

      {/* Tampilan */}
      <div className="card p-6 space-y-3">
        <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-4">
          🎨 Tampilan
        </h2>
        <div className="flex items-center justify-between p-4 rounded-xl border-2 transition-all hover:shadow-md" style={{ borderColor: "#9e9e9e", background: "linear-gradient(135deg,#f5f5f5,#eeeeee)" }}>
          <div className="flex items-center gap-4">
             <div className="text-3xl">🌗</div>
             <div>
               <div className="font-bold text-gray-800">
                 Mode Gelap
               </div>
               <div className="text-xs text-gray-600 mt-0.5">
                 Sesuaikan tampilan aplikasi
               </div>
             </div>
          </div>
          <div>
            <ThemeToggle isCollapsed={false} variant="settings" />
          </div>
        </div>
      </div>

      {/* Admin */}
      <div className="card p-6 space-y-3">
        <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-4">
          🛡️ Administrasi
        </h2>
        <Link
          href="/admin/master"
          className="flex items-center gap-4 p-4 rounded-xl border-2 transition-all hover:-translate-y-0.5 hover:shadow-md group"
          style={{ borderColor: "#673ab7", background: "linear-gradient(135deg,#ede7f6,#f3e5f5)" }}
        >
          <div className="text-3xl">🗄️</div>
          <div className="flex-1">
            <div className="font-bold text-purple-800 group-hover:underline">
              Admin Master Data
            </div>
            <div className="text-xs text-purple-600 mt-0.5">
              Kelola master data ruangan, unit profesi, dan lainnya
            </div>
          </div>
          <span className="text-purple-600">↗</span>
        </Link>
      </div>

      {/* Quick links */}
      <div className="card p-6 space-y-3">
        <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-4">
          🔗 Tautan Cepat
        </h2>

        <button
          onClick={handleEditFormClick}
          className="flex items-center gap-4 p-4 rounded-xl border-2 transition-all hover:-translate-y-0.5 hover:shadow-md group text-left w-full"
          style={{ borderColor: "#1e88e5", background: "linear-gradient(135deg,#e3f2fd,#e8eaf6)" }}
        >
          <div className="text-3xl">📝</div>
          <div className="flex-1">
            <div className="font-bold text-blue-800 group-hover:underline">
              Edit Form
            </div>
            <div className="text-xs text-blue-600 mt-0.5">
              Isi laporan patroli K3 melalui Google Forms
            </div>
          </div>
          <span className="text-blue-600">↗</span>
        </button>

        <a
          href={SHEET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-4 rounded-xl border-2 transition-all hover:-translate-y-0.5 hover:shadow-md group"
          style={{ borderColor: "#43a047", background: "linear-gradient(135deg,#e8f5e9,#f1f8e9)" }}
        >
          <div className="text-3xl">📊</div>
          <div className="flex-1">
            <div className="font-bold text-green-800 group-hover:underline">
              Spreadsheet Data Mentah
            </div>
            <div className="text-xs text-green-600 mt-0.5">
              Lihat dan atur data mentah dari Google Sheets
            </div>
          </div>
          <span className="text-green-600">↗</span>
        </a>

        <a
          href={MANUAL_BOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-4 rounded-xl border-2 transition-all hover:-translate-y-0.5 hover:shadow-md group"
          style={{ borderColor: "#fbc02d", background: "linear-gradient(135deg,#fffde7,#fff8e1)" }}
        >
          <div className="text-3xl">📖</div>
          <div className="flex-1">
            <div className="font-bold text-yellow-800 group-hover:underline">
              Manual Book
            </div>
            <div className="text-xs text-yellow-600 mt-0.5">
              Baca panduan penggunaan aplikasi Patroli K3
            </div>
          </div>
          <span className="text-yellow-600">↗</span>
        </a>

        <Link
          href="/"
          className="flex items-center gap-4 p-4 rounded-xl border-2 transition-all hover:-translate-y-0.5 hover:shadow-md group"
          style={{ borderColor: "#B71C1C", background: "linear-gradient(135deg,#fce4ec,#fff8f0)" }}
        >
          <div className="text-3xl">🏠</div>
          <div className="flex-1">
            <div className="font-bold text-red-800 group-hover:underline">
              Kembali ke Dashboard
            </div>
            <div className="text-xs text-red-600 mt-0.5">
              Lihat ringkasan kepatuhan patroli
            </div>
          </div>
          <span className="text-red-600">→</span>
        </Link>
      </div>
    </div>
  );
}
