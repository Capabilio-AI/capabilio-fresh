"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";

export default function SkillRadar({ data }: { data: { skill: string; score: number; target: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} outerRadius="66%">
        <PolarGrid stroke="rgb(23 19 31 / 0.14)" />
        <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: "var(--m-muted)" }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar name="Role target" dataKey="target" stroke="var(--m-off)" strokeDasharray="4 4" fill="none" />
        <Radar name="You" dataKey="score" stroke="var(--m-accent)" fill="var(--m-accent)" fillOpacity={0.25} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
