"use client";

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  LabelList
} from "recharts";

interface QuestionResult {
  label: string;
  sheetHeader: string;
  pct: number | null;
  countYa: number;
  countTidak: number;
  countSetengah?: number;
  countNA: number;
  countEmpty: number;
  countTidakAda?: number;
  targetPct?: number;
  description?: string;
}

// The descriptions are now coming from the dynamic master data.
// QUESTION_DESCRIPTIONS is removed.

export default function QuestionHorizontalChart({
  data,
  moduleSlug,
}: {
  data: QuestionResult[];
  moduleSlug?: string;
}) {
  const chartData = useMemo(() => {
    return data.map((q) => {
      const isNull = q.pct === null;
      const achieve = q.pct ?? 0;
      const target = q.targetPct ?? 90;
      
      const gap = isNull ? 0 : Math.max(0, target - achieve);
      const remaining = isNull ? 0 : 100 - Math.max(achieve, target);
      const noData = isNull ? 100 : 0;

      return {
        name: q.label,
        achieve,
        gap,
        remaining,
        noData,
        isNull,
        target,
        fullData: q
      };
    });
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="card p-6 text-center text-gray-400">
        Tidak ada data pertanyaan untuk periode ini.
      </div>
    );
  }

  // Hitung tinggi dinamis berdasarkan jumlah pertanyaan agar bar tidak menyusut (diperbesar untuk menampung deskripsi panjang)
  const height = Math.max(300, chartData.length * 70 + 100);

  const globalTargetPct = chartData[0]?.fullData?.targetPct ?? 90;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload.fullData;
      const description = p.description;
      const isSaranaProteksi = moduleSlug === "sarana-proteksi";
      const isHydrant = moduleSlug === "hydrant";
      const isSaranaOrHydrant = isHydrant || isSaranaProteksi;
      
      let countIndikator2 = p.countTidak;
      let countIndikator3 = p.countTidakAda ?? 0;
      let labelIndikator2 = "✗ ";
      let labelIndikator3 = "Tidak Ada: ";
      
      if (isHydrant) {
        countIndikator2 = p.countTidak - countIndikator3;
        labelIndikator3 = "🚒 Tidak ada hydrant: ";
      } else if (isSaranaProteksi) {
        countIndikator2 = p.countSetengah ?? 0;
        labelIndikator2 = "⚠️ Kurang Baik: ";
        labelIndikator3 = "✗ Tidak: ";
      }

      return (
        <div className="bg-white p-3 border rounded shadow-lg text-sm max-w-[300px] z-50">
          <p className="font-semibold text-gray-800 dark:text-gray-100">{p.label}</p>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-1 mb-2 leading-tight">
              {description}
            </p>
          )}
          <p className="text-gray-700 dark:text-gray-300">
            Kepatuhan: <span className="font-bold text-gray-900 dark:text-white">
              {p.pct === null ? "Belum ada data" : `${p.pct}%`}
            </span>
          </p>
          <div className="flex gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            <span className="text-green-600 font-semibold">✓ {p.countYa}</span>
            
            <span className={isSaranaProteksi ? "text-amber-600 font-semibold" : "text-red-600 font-semibold"}>
              {labelIndikator2}{countIndikator2}
            </span>
            
            {isSaranaOrHydrant && p.countTidakAda !== undefined && (
              <span className={isHydrant ? "text-orange-600 dark:text-orange-400 font-semibold" : "text-red-800 dark:text-red-300 font-semibold"}>
                {labelIndikator3}{countIndikator3}
              </span>
            )}
            <span className="text-gray-400">N/A {p.countNA}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomYAxisTick = (props: any) => {
    const { y, payload } = props;
    const targetData = chartData.find(d => d.name === payload.value)?.fullData;
    const description = targetData?.description;

    // Fungsi untuk memecah teks panjang menjadi beberapa baris
    const getLines = (text: string, maxLen: number) => {
      const words = text.split(" ");
      const lines: string[] = [];
      let currentLine = "";
      words.forEach(word => {
        if ((currentLine + word).length > maxLen) {
          if (currentLine) lines.push(currentLine.trim());
          currentLine = word + " ";
        } else {
          currentLine += word + " ";
        }
      });
      if (currentLine) lines.push(currentLine.trim());
      return lines;
    };

    const descLines = description ? getLines(description, 38) : [];

    return (
      <g transform={`translate(0, ${y})`}>
        <text
          x={0}
          y={-6}
          textAnchor="start"
          fill="var(--text-main)"
          fontSize={11}
          fontWeight="bold"
        >
          {payload.value.length > 35 ? payload.value.substring(0, 35) + "..." : payload.value}
        </text>
        {descLines.length > 0 && (
          <text
            x={0}
            y={8}
            textAnchor="start"
            fill="#6b7280" /* text-gray-500 */
            fontSize={9}
            className="dark:fill-gray-400"
          >
            {descLines.map((line, i) => (
              <tspan key={i} x={0} dy={i === 0 ? 0 : 12}>
                {line}
              </tspan>
            ))}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="card p-6 flex flex-col">
      <div className="w-full overflow-x-auto pb-4">
        <div className="w-[800px] lg:w-full" style={{ height: `${height}px` }}>
          <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border-color)" />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickCount={6}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickFormatter={(val) => `${val}%`}
            />
            <YAxis
              dataKey="name"
              type="category"
              axisLine={{ stroke: "var(--border-color)", strokeWidth: 4 }}
              tickLine={false}
              width={230}
              tick={<CustomYAxisTick />}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F3F4F6' }} />
            <ReferenceLine x={globalTargetPct} stroke="#9CA3AF" strokeDasharray="4 4" />
            
            {/* 1. Pencapaian Nyata (Hijau) */}
            <Bar dataKey="achieve" stackId="a" fill="#199e70" barSize={25} isAnimationActive={false}>
              <LabelList
                dataKey="achieve"
                content={(props: any) => {
                  const { x, y, width, height, value } = props;
                  if (!value || value <= 0) return null;
                  return (
                    <text
                      x={x + Math.max(width - 5, width / 2)}
                      y={y + height / 2 + 4}
                      fill="#fff"
                      fontSize="11"
                      fontWeight="bold"
                      textAnchor={width > 25 ? "end" : "middle"}
                    >
                      {Number(Number(value).toFixed(2))}%
                    </text>
                  );
                }}
              />
            </Bar>
            
            {/* 2. Jarak ke Standar (Kuning) */}
            <Bar dataKey="gap" stackId="a" fill="#FBBF24" isAnimationActive={false}>
              <LabelList
                dataKey="gap"
                content={(props: any) => {
                  const { x, y, width, height, value } = props;
                  if (!value || value < 2) return null; // hide label if < 2%
                  return (
                    <text x={x + width / 2} y={y + height / 2 + 4} fill="#000" fontSize="11" fontWeight="bold" textAnchor="middle">
                      {Number(Number(value).toFixed(2))}%
                    </text>
                  );
                }}
              />
            </Bar>
            
            {/* 3. Lawan ke 100% / Di Luar Target (Merah) */}
            <Bar dataKey="remaining" stackId="a" fill="#d03b3b" isAnimationActive={false}>
              <LabelList
                dataKey="remaining"
                content={(props: any) => {
                  const { x, y, width, height, value } = props;
                  if (!value || value < 2) return null; // hide label if < 2%
                  return (
                    <text x={x + width / 2} y={y + height / 2 + 4} fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">
                      {Number(Number(value).toFixed(2))}%
                    </text>
                  );
                }}
              />
            </Bar>

            {/* 4. State kosong / Belum ada data */}
            <Bar dataKey="noData" stackId="a" fill="#9CA3AF" isAnimationActive={false}>
              <LabelList
                dataKey="noData"
                content={(props: any) => {
                  const { x, y, width, height, value } = props;
                  if (!value || value <= 0) return null;
                  return (
                    <text x={x + width / 2} y={y + height / 2 + 4} fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">
                      Belum ada data
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      </div>

      {/* Custom Legend */}
      <div className="mt-6 flex flex-wrap items-center gap-6 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-slate-800 pt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#199e70" }}></div>
          <span className="font-medium">Pencapaian Nyata [H]</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#FBBF24" }}></div>
          <span className="font-medium">Jarak ke Standar [K]</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#d03b3b" }}></div>
          <span className="font-medium">Di Luar Target [M]</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 border-t-2 border-dashed border-gray-400"></div>
          <span className="font-medium">Standar minimum {globalTargetPct}%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#9CA3AF" }}></div>
          <span className="font-medium">Belum ada data</span>
        </div>
      </div>
    </div>
  );
}
