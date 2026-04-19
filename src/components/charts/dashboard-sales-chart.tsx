"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatMoney } from "@/lib/utils";

type DashboardSalesChartProps = {
  data: { day: string; sales: number }[];
};

export function DashboardSalesChart({ data }: DashboardSalesChartProps) {
  return (
    <div className="h-[280px] min-h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%" minHeight={280}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="salesGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0f766e" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(value) => `$${value}`} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value) => formatMoney(Number(value ?? 0))} />
          <Area type="monotone" dataKey="sales" stroke="#0f766e" strokeWidth={2.5} fill="url(#salesGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
