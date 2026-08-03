import Link from "next/link";

const FORM_URL = "https://docs.google.com/forms/d/1Hm3NSzpeG7NdOiPwSBkBn49mVh-t-CYDPncOoKlo0Fg/edit";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1jrKUxgU106VhCsK2hwHFZSqcEUHWjiJmcXlqtZNWA1o/edit?usp=sharing";
const MANUAL_BOOK_URL = "https://docs.google.com/document/d/1tjTk21XYwqzbgRvE39rN0T7WQ1Y-OkdyeD7_k2rcL3g/edit?usp=sharing";

export default function SettingsPage() {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">⚙️ Pengaturan</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tautan akses form pengisian dan data mentah patroli K3
        </p>
      </div>

      {/* Quick links */}
      <div className="card p-6 space-y-3">
        <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-4">
          🔗 Tautan Cepat
        </h2>

        <a
          href={FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-4 rounded-xl border-2 transition-all hover:-translate-y-0.5 hover:shadow-md group"
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
        </a>

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
