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
  countNA: number;
  countEmpty: number;
  targetPct?: number;
  description?: string;
}

// The descriptions are now coming from the dynamic master data.
// QUESTION_DESCRIPTIONS is removed.

export default function QuestionHorizontalChart({
  data,
}: {
  data: QuestionResult[];
}) {
  // Hanya tampilkan pertanyaan yang memiliki data persentase
  const chartData = useMemo(() => {
    return data.map((q) => ({
      name: q.label,
      pct: q.pct === null ? 0 : q.pct, // Draw a 0 length bar or default to 0 for display
      isNull: q.pct === null,
      fullData: q
    }));
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
          <div className="flex gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="text-green-600 font-semibold">✓ {p.countYa}</span>
            <span className="text-red-600 font-semibold">✗ {p.countTidak}</span>
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
      <div className="w-full" style={{ height: `${height}px` }}>
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
            <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false}>
              {chartData.map((entry, index) => {
                const target = entry.fullData.targetPct ?? 90;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isNull ? "#9CA3AF" : ((entry.pct ?? 0) >= target ? "#199e70" : "#d03b3b")}
                  />
                );
              })}
              <LabelList
                dataKey="pct"
                content={(props: any) => {
                  const { x, y, width, height, value, index } = props;
                  const item = chartData[index];
                  return (
                    <text x={x + width + 10} y={y + height / 2 + 4} fill="#4B5563" fontSize="12" fontWeight="bold">
                      {item?.isNull ? "-" : `${value}%`}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Custom Legend */}
      <div className="mt-6 flex flex-wrap items-center gap-6 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-slate-800 pt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#199e70" }}></div>
          <span className="font-medium">Memenuhi standar (≥ {globalTargetPct}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#d03b3b" }}></div>
          <span className="font-medium">Di bawah standar (&lt; {globalTargetPct}%)</span>
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
