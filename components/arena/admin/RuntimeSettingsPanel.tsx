"use client";

import { useState } from "react";
import type { RuntimeAdminRow } from "@/lib/arena-content/runtime-admin";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Kill switch and per-student daily caps for each workstation type, plus the last 24h of usage. Takes effect on the next attempt start. */
export function RuntimeSettingsPanel({ initial }: { initial: RuntimeAdminRow[] }) {
  const [rows, setRows] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function save(row: RuntimeAdminRow, patch: Partial<RuntimeAdminRow>) {
    const next = { ...row, ...patch };
    setBusy(row.runtimeType);
    setMessage(null);
    const res = await fetch("/api/arena-admin/runtime-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runtimeType: row.runtimeType, enabled: next.enabled, maxAttemptsPerStudentPerDay: next.maxAttemptsPerStudentPerDay, dailyCostCapCentsPerStudent: next.dailyCostCapCentsPerStudent, attemptCostCents: next.attemptCostCents }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (res?.ok) setRows(body.runtimes);
    else setMessage(body.error ?? "Could not save.");
  }

  const number = "w-20 rounded border border-app-border bg-white px-2 py-1 font-lp-mono text-[12px]";
  return (
    <section aria-label="Workstation settings">
      <h2 className="font-lp-body text-[14px] font-semibold text-app-charcoal">Workstations — switches, caps and usage (last 24h)</h2>
      {message && <p role="alert" className="mt-1 font-lp-body text-[13px] text-app-rose">{message}</p>}
      <div className="mt-2 overflow-x-auto rounded-xl border border-app-border bg-white">
        <table className="w-full border-collapse font-lp-body text-[13px]">
          <thead>
            <tr className="border-b border-app-border text-left text-app-muted">
              <th className="px-3 py-2">Workstation</th><th className="px-3 py-2">On</th><th className="px-3 py-2">Attempts / student / day</th><th className="px-3 py-2">Cost cap / student / day (¢)</th><th className="px-3 py-2">Cost / attempt (¢)</th><th className="px-3 py-2">Usage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.runtimeType} className="border-b border-app-border last:border-0">
                <td className="px-3 py-2"><p className="font-semibold text-app-charcoal">{r.label}</p><p className="font-lp-mono text-[11px] text-app-muted">{r.runtimeType}{r.available ? "" : " · not built yet"}</p></td>
                <td className="px-3 py-2">
                  <input type="checkbox" aria-label={`${r.label} enabled`} checked={r.enabled} disabled={!r.available || busy === r.runtimeType} onChange={(e) => save(r, { enabled: e.target.checked })} />
                </td>
                <td className="px-3 py-2"><input type="number" min={0} defaultValue={r.maxAttemptsPerStudentPerDay} className={number} aria-label={`${r.label} attempts per day`} onBlur={(e) => Number(e.target.value) !== r.maxAttemptsPerStudentPerDay && save(r, { maxAttemptsPerStudentPerDay: Number(e.target.value) })} /></td>
                <td className="px-3 py-2"><input type="number" min={0} defaultValue={r.dailyCostCapCentsPerStudent} className={number} aria-label={`${r.label} daily cost cap`} onBlur={(e) => Number(e.target.value) !== r.dailyCostCapCentsPerStudent && save(r, { dailyCostCapCentsPerStudent: Number(e.target.value) })} /></td>
                <td className="px-3 py-2"><input type="number" min={0} step="0.01" defaultValue={r.attemptCostCents} className={number} aria-label={`${r.label} cost per attempt`} onBlur={(e) => Number(e.target.value) !== r.attemptCostCents && save(r, { attemptCostCents: Number(e.target.value) })} /></td>
                <td className="px-3 py-2 text-app-muted">{r.attemptsToday} attempts · {r.students24h} students · {money(r.costTodayCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 font-lp-body text-[12px] text-app-muted">A cap of 0 means no cap. A cost per attempt of 0 means the workstation costs nothing to run (browser-based or pure code).</p>
    </section>
  );
}
