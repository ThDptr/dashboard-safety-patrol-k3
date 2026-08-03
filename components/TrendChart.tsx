"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import { formatBulan } from "@/lib/utils";

interface TrendData {
  month: string; // YYYY-MM
  pct: number | null;
}

export default function TrendChart({ data }: { data: TrendData[] }) {
  // Format the month for display
  const chartData = data.map(d => ({
    ...d,
    displayMonth: formatBulan(d.month)
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded shadow-lg text-sm max-w-[200px] z-50">
          <p className="font-semibold text-gray-800 dark:text-gray-100">{p.displayMonth}</p>
          {p.pct !== null ? (
            <p className="text-gray-700 dark:text-gray-300 mt-1">
              Kepatuhan: <span className="font-bold text-gray-900 dark:text-white">{p.pct}%</span>
            </p>
          ) : (
            <p className="text-gray-500 mt-1">Tidak ada data</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card p-6 flex flex-col h-full w-full">
      <div className="w-full flex-grow min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
            <XAxis 
              dataKey="displayMonth" 
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-color)' }}
            />
            <YAxis 
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `${val}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={90} stroke="#9CA3AF" strokeDasharray="4 4" />
            <Line 
              type="monotone" 
              dataKey="pct" 
              stroke="#4f46e5" 
              strokeWidth={3}
              activeDot={{ r: 6, fill: "#4f46e5" }} 
              dot={{ r: 4, fill: "#fff", stroke: "#4f46e5", strokeWidth: 2 }}
              connectNulls={true}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-slate-800 pt-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
          <span>Total Kepatuhan Bulanan</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 border-t-2 border-dashed border-gray-400"></div>
          <span>Standar 90%</span>
        </div>
      </div>
    </div>
  );
}
