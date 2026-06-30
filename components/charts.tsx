"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ExperimentResult } from "@/lib/bandit";
import { ANGLE_COLORS } from "@/lib/colors";
import { PageSpec } from "@/lib/types";

function colorById(pages: PageSpec[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const p of pages) m[p.id] = ANGLE_COLORS[p.primaryAngle].hex;
  return m;
}

// Stacked share of traffic each page receives, round by round. Watch the winner
// swallow the chart as the bandit concentrates spend.
export function AllocationChart({
  pages,
  experiment,
}: {
  pages: PageSpec[];
  experiment: ExperimentResult;
}) {
  const colors = colorById(pages);
  const data = experiment.rounds.map((r) => {
    const total = Object.values(r.allocation).reduce((a, b) => a + b, 0) || 1;
    const row: Record<string, number> = { round: r.round };
    for (const id of experiment.pageIds) row[id] = (r.allocation[id] / total) * 100;
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f3" vertical={false} />
        <XAxis
          dataKey="round"
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
          axisLine={false}
          tickLine={false}
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(value, name) => [`${Number(value).toFixed(0)}%`, `Page ${name}`]}
          labelFormatter={(l) => `Round ${l}`}
          contentStyle={{ borderRadius: 12, border: "1px solid #e4e4e7", fontSize: 12 }}
        />
        {experiment.pageIds.map((id) => (
          <Area
            key={id}
            type="monotone"
            dataKey={id}
            stackId="1"
            stroke={colors[id]}
            fill={colors[id]}
            fillOpacity={0.85}
            strokeWidth={0}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Cumulative conversion rate of the bandit vs. the even-split counterfactual.
export function ConversionChart({ experiment }: { experiment: ExperimentResult }) {
  const data = experiment.rounds.map((r) => ({
    round: r.round,
    thompson: r.cumConvRate * 100,
    uniform: experiment.uniformConvRate * 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f3" vertical={false} />
        <XAxis
          dataKey="round"
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v.toFixed(0)}%`}
        />
        <Tooltip
          formatter={(value, name) => [
            `${Number(value).toFixed(1)}%`,
            name === "thompson" ? "Bandit (Thompson)" : "Even split",
          ]}
          labelFormatter={(l) => `Round ${l}`}
          contentStyle={{ borderRadius: 12, border: "1px solid #e4e4e7", fontSize: 12 }}
        />
        <ReferenceLine
          y={experiment.uniformConvRate * 100}
          stroke="#a1a1aa"
          strokeDasharray="4 4"
        />
        <Line
          type="monotone"
          dataKey="uniform"
          stroke="#a1a1aa"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="thompson"
          stroke="#7c3aed"
          strokeWidth={2.5}
          dot={{ r: 2.5, fill: "#7c3aed" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
