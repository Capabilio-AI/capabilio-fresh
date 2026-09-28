"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TrajectoryPoint {
  date: string;
  rating: number;
}

/** Real Arena rating history only — never rendered unless the caller has ≥2 real completed-attempt points. */
export function CodeDnaTrajectoryChart({ points }: { points: TrajectoryPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={points}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--lp-border-hairline, #e5e7eb)" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} width={32} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Line type="monotone" dataKey="rating" stroke="#3457a6" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
