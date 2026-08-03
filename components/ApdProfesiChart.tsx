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
  LabelList,
} from "recharts";

interface Submission {
  location: string;
  tags: string[];
}

export default function ApdProfesiChart({
  submissions,
}: {
  submissions: Submission[];
}) {
  const chartData = useMemo(() => {
    const counts = new Map<string, number>();

    for (const sub of submissions) {
      if (!sub.tags || sub.tags.length === 0) continue;
      
      for (const tag of sub.tags) {
        let profesi = tag.trim();
        if (!profesi) continue;
        
        // Gabungkan nama profesi dengan lokasi jika profesi adalah "Perawat"
        if (profesi.toLowerCase() === "perawat") {
          profesi = `Perawat-${sub.location}`;
        }
        
        counts.set(profesi, (counts.get(profesi) || 0) + 1);
      }
    }

    const data = Array.from(counts.entries()).map(([name, count]) => ({
      name,
      count,
    }));

    // Urutkan dari pelanggaran terbanyak ke terdikit
    data.sort((a, b) => b.count - a.count);
    return data;
  }, [submissions]);

  if (chartData.length === 0) {
    return (
      <div className="card p-6 text-center text-gray-400">
        Tidak ada data pelanggaran profesi bulan ini.
      </div>
    );
  }

  return (
    <div className="card p-6 h-96 flex flex-col">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-4">
        Statistik Profesi Melanggar
      </h3>
      <div className="flex-1 min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 25, right: 10, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              interval={0}
              angle={-45}
              textAnchor="end"
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              allowDecimals={false}
            />
            <Tooltip 
              cursor={{ fill: '#F3F4F6' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.name.toLowerCase().includes("perawat") ? "#B71C1C" : "#F59E0B"} 
                />
              ))}
              <LabelList
                dataKey="count"
                position="top"
                style={{ fontSize: '12px', fontWeight: 'bold', fill: '#6B7280' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
