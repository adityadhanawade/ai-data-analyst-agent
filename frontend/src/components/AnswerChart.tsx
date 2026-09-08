"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { AskResult } from "@/lib/api";

const PRIMARY = "#1e40af";
const PIE_COLORS = ["#1e40af", "#3b82f6", "#93c5fd", "#1e3a8a", "#60a5fa", "#bfdbfe"];

export default function AnswerChart({ chart }: { chart: AskResult["chart"] }) {
  if (chart.type === "none" || chart.datasets.length === 0) return null;

  const rows = chart.labels.map((label, i) => {
    const row: Record<string, string | number> = { label };
    chart.datasets.forEach((ds) => {
      row[ds.label] = ds.data[i];
    });
    return row;
  });

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {chart.type === "line" ? (
          <LineChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#475569" }} />
            <YAxis tick={{ fontSize: 11, fill: "#475569" }} />
            <Tooltip />
            {chart.datasets.map((ds, i) => (
              <Line
                key={ds.label}
                type="monotone"
                dataKey={ds.label}
                stroke={i === 0 ? PRIMARY : PIE_COLORS[(i + 1) % PIE_COLORS.length]}
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        ) : chart.type === "bar" ? (
          <BarChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#475569" }} />
            <YAxis tick={{ fontSize: 11, fill: "#475569" }} />
            <Tooltip />
            {chart.datasets.map((ds, i) => (
              <Bar
                key={ds.label}
                dataKey={ds.label}
                fill={i === 0 ? PRIMARY : PIE_COLORS[(i + 1) % PIE_COLORS.length]}
                radius={[6, 6, 0, 0]}
              />
            ))}
          </BarChart>
        ) : (
          <PieChart>
            <Tooltip />
            <Pie
              data={rows}
              dataKey={chart.datasets[0].label}
              nameKey="label"
              outerRadius={80}
              label={(entry) => entry.label}
            >
              {rows.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
