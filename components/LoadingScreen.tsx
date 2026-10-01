import Image from "next/image";

export default function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 w-full">
      <style>{`
        @keyframes slideRight {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes pulse-soft {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .progress-bar-moving {
          animation: slideRight 1.5s ease-in-out infinite;
        }
        .logo-pulse {
          animation: pulse-soft 2s ease-in-out infinite;
        }
      `}</style>

      <div className="flex flex-col items-center gap-5">
        {/* Logos container */}
        <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl shadow-md z-10 logo-pulse">
          <Image src="/Logo_ITERA.png" alt="ITERA Logo" width={36} height={36} className="object-contain" />
          <div className="w-[1px] h-8 bg-gray-200" />
          <Image src="/K3_logo.png" alt="K3 Logo" width={36} height={36} className="object-contain" />
          <div className="w-[1px] h-8 bg-gray-200" />
          <Image src="/RSOMH_logo.png" alt="RSOMH Logo" width={88} height={28} className="object-contain" />
        </div>

        {/* Progress bar */}
        <div className="relative w-full max-w-[200px] h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1/2 bg-blue-600 rounded-full progress-bar-moving" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 text-center mt-1">
        <h3 className="text-gray-800 font-bold text-sm">Memuat Data Patroli...</h3>
        <p className="text-gray-500 text-[11px] max-w-[260px]">Menyinkronkan dari Google Sheets</p>
      </div>
    </div>
  );
}
