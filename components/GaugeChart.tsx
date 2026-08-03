"use client";

interface GaugeChartProps {
  pct: number | null;
  size?: number;
  strokeWidth?: number;
}

const STATUS_COLORS = {
  green: { stroke: "var(--green)", text: "var(--green)", bg: "#dcfce7" },
  yellow: { stroke: "var(--yellow)", text: "var(--yellow)", bg: "#fef3c7" },
  red: { stroke: "var(--red)", text: "var(--red)", bg: "#fee2e2" },
  gray: { stroke: "var(--text-muted)", text: "var(--text-muted)", bg: "#f3f4f6" },
};

function getStatus(pct: number | null): keyof typeof STATUS_COLORS {
  if (pct === null) return "gray";
  if (pct >= 90) return "green";
  if (pct >= 70) return "yellow";
  return "red";
}

export default function GaugeChart({
  pct,
  size = 160,
  strokeWidth = 12,
}: GaugeChartProps) {
  const r = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const progress = pct !== null ? clamp(pct, 0, 100) / 100 : 0;
  const dashOffset = circumference * (1 - progress);
  const status = getStatus(pct);
  const colors = STATUS_COLORS[status];

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Gauge: ${pct ?? "N/A"}%`}>
        {/* Background ring */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--border-color)"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="gauge-ring"
        />
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-black leading-none"
          style={{ fontSize: size * 0.22, color: colors.text }}
        >
          {pct !== null ? `${pct}%` : "–"}
        </span>
        <span className="text-gray-400 dark:text-gray-500 mt-1" style={{ fontSize: size * 0.07 }}>
          {pct !== null ? statusLabel(pct) : "Belum Ada Data"}
        </span>
      </div>
    </div>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function statusLabel(pct: number): string {
  if (pct >= 90) return "Patuh";
  if (pct >= 70) return "Perlu Perbaikan";
  return "Tidak Patuh";
}
