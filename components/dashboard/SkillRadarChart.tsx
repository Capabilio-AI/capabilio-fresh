"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

export interface RadarSeries {
  key: string;
  label: string;
  color: string;
}

/** Generic radar over any set of named axes (skill or domain names) and 1-2 numeric series. */
export function SkillRadarChart({
  data,
  series,
  height = 300,
}: {
  data: Array<Record<string, string | number>>;
  series: RadarSeries[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="75%">
        <PolarGrid stroke="var(--lp-border-hairline, #e5e7eb)" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "var(--lp-text-muted, #6b7280)" }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} tickCount={5} />
        {series.map((s) => (
          <Radar
            key={s.key}
            name={s.label}
            dataKey={s.key}
            stroke={s.color}
            fill={s.color}
            fillOpacity={0.25}
            strokeWidth={2}
          />
        ))}
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
