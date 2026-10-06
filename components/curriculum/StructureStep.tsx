"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { searchBranches } from "@/lib/branch-catalog";
import type { CourseRow } from "@/lib/curriculum/admin-data";
import { Panel } from "@/components/org/ui";
import { api } from "./api";

interface Props {
  importId: string;
  branch: string;
  program: string | null;
  regulation: string | null;
  editable: boolean;
  courses: CourseRow[];
}

/** The academic frame: program, branch and regulation, and how the courses fall across years and semesters. */
export function StructureStep({ importId, branch, program, regulation, editable, courses }: Props) {
  const router = useRouter();
  const [b, setB] = useState(branch);
  const [p, setP] = useState(program ?? "");
  const [r, setR] = useState(regulation ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = b.trim() !== branch || p.trim() !== (program ?? "") || r.trim() !== (regulation ?? "");

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await api("PATCH", `/api/admin/curriculum/imports/${importId}`, { branch: b.trim(), program: p.trim() || null, regulation: r.trim() || null });
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  const cells = new Map<string, { year: number; semester: number | null; count: number; credits: number; unknownCredits: number }>();
  for (const c of courses) {
    const key = `${c.year}-${c.semester ?? 0}`;
    const cell = cells.get(key) ?? { year: c.year, semester: c.semester, count: 0, credits: 0, unknownCredits: 0 };
    cell.count++;
    if (c.credits == null) cell.unknownCredits++;
    else cell.credits += c.credits;
    cells.set(key, cell);
  }
  const grid = [...cells.values()].sort((a, c) => a.year - c.year || (a.semester ?? 9) - (c.semester ?? 9));

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Program, branch and regulation">
        <fieldset disabled={!editable || busy} className="m-0 border-0 p-0">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><label htmlFor="st-program" className="mb-1 block font-lp-mono text-[11px] text-app-muted">Program</label><input id="st-program" className="o-input" value={p} onChange={(e) => setP(e.target.value)} placeholder="e.g. B.Tech" maxLength={200} /></div>
            <div>
              <label htmlFor="st-branch" className="mb-1 block font-lp-mono text-[11px] text-app-muted">Branch</label>
              <input id="st-branch" list="st-branch-options" className="o-input" value={b} onChange={(e) => setB(e.target.value)} maxLength={200} autoComplete="off" />
              <datalist id="st-branch-options">{(b.trim() ? searchBranches(b) : []).map((x) => <option key={x.name} value={x.name} />)}</datalist>
            </div>
            <div><label htmlFor="st-reg" className="mb-1 block font-lp-mono text-[11px] text-app-muted">Regulation</label><input id="st-reg" className="o-input" value={r} onChange={(e) => setR(e.target.value)} placeholder="e.g. R23" maxLength={80} /></div>
          </div>
          <p className="mt-2 font-lp-body text-[12px] text-app-muted">Students are matched to a curriculum by branch. A different regulation is kept as its own curriculum; publishing a new version of the same regulation archives the old one.</p>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" className="o-btn" onClick={save} disabled={!editable || busy || !dirty || !b.trim()}>{busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} Save</button>
            {msg && <p className={`font-lp-body text-[12.5px] ${msg.ok ? "text-app-success" : "text-app-rose"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
          </div>
        </fieldset>
      </Panel>

      <Panel title="Years and semesters">
        {grid.length === 0 ? (
          <p className="font-lp-body text-[13px] text-app-muted">No courses yet. Add them in the Courses step.</p>
        ) : (
          <table className="w-full border-collapse font-lp-body text-[13px]">
            <caption className="sr-only">Courses and credits by year and semester</caption>
            <thead><tr className="text-left"><th scope="col" className="o-eyebrow pb-2 font-normal">Year · Semester</th><th scope="col" className="o-eyebrow pb-2 font-normal">Courses</th><th scope="col" className="o-eyebrow pb-2 font-normal">Credits</th></tr></thead>
            <tbody>
              {grid.map((g) => (
                <tr key={`${g.year}-${g.semester}`} className="border-t border-app-border">
                  <th scope="row" className="py-2 text-left font-medium text-app-charcoal">Year {g.year}{g.semester ? ` · Semester ${g.semester}` : " · semester not stated"}</th>
                  <td className="py-2 text-app-charcoal">{g.count}</td>
                  <td className="py-2 text-app-muted">{g.credits}{g.unknownCredits > 0 ? ` (+ ${g.unknownCredits} not stated)` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 font-lp-body text-[12px] text-app-muted">To move a course to a different year or semester, open it from the Courses step.</p>
      </Panel>
    </div>
  );
}
