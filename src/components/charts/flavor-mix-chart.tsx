"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#0f766e", "#d97706", "#db2777", "#2563eb", "#6d28d9"];

type FlavorMixChartProps = {
  data: { name: string; units: number }[];
};

export function FlavorMixChart({ data }: FlavorMixChartProps) {
  return (
    <div className="h-[280px] min-h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%" minHeight={280}>
        <PieChart>
          <Pie data={data} dataKey="units" nameKey="name" cx="50%" cy="50%" innerRadius={65} outerRadius={100}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
