"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { searchBranches } from "@/lib/branch-catalog";
import { CSV_TEMPLATE, parseCurriculumCsv, type CsvSubjectRow } from "@/lib/roadmap/csv";
import type { AdminSubject } from "@/lib/roadmap/admin-data";
import type { ExtractionRecord } from "@/lib/roadmap/extract/types";
import { SubjectMappingRow } from "./SubjectMappingRow";
import { SyllabusExtraction } from "./SyllabusExtraction";

interface Props {
  subjects: AdminSubject[];
  roleKey: string;
  roleName: string;
  areas: { key: string; name: string }[];
  extraction: ExtractionRecord | null;
}

const FIELD = "o-input";

async function post(body: unknown): Promise<{ ok: boolean; added?: number }> {
  const res = await fetch("/api/admin/curriculum/subjects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => null)) as { added?: number } | null;
  return { ok: res.ok, added: json?.added };
}

export function CurriculumManager({ subjects, roleKey, roleName, areas, extraction }: Props) {
  const router = useRouter();
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("1");
  const [lines, setLines] = useState("");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<CsvSubjectRow[] | null>(null);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function addFromForm() {
    const parsed = lines.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const [name, code] = l.split(",").map((s) => s.trim());
      return { name, ...(code ? { code } : {}) };
    });
    if (!branch.trim() || parsed.length === 0) return setMessage("Choose a branch and enter at least one subject.");
    setBusy(true);
    const r = await post({ branch: branch.trim(), year: Number(year), subjects: parsed });
    setBusy(false);
    if (!r.ok) return setMessage("Could not save — check the entries and try again.");
    setMessage(`${r.added} subject${r.added === 1 ? "" : "s"} added (duplicates skipped).`);
    setLines("");
    router.refresh();
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    setCsv(await file.text());
    setPreview(null);
    setCsvErrors([]);
  }

  function previewCsv() {
    const r = parseCurriculumCsv(csv);
    setMessage(null);
    if (!r.ok) {
      setCsvErrors(r.errors);
      return setPreview(null);
    }
    setCsvErrors([]);
    setPreview(r.rows);
  }

  async function importCsv() {
    if (!preview) return;
    setBusy(true);
    const groups = new Map<string, CsvSubjectRow[]>();
    for (const row of preview) {
      const key = `${row.branch}\u0000${row.year}\u0000${row.semester ?? ""}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    let added = 0;
    let failed = false;
    for (const rows of groups.values()) {
      const first = rows[0];
      const r = await post({
        branch: first.branch,
        year: first.year,
        ...(first.semester ? { semester: first.semester } : {}),
        subjects: rows.map((x) => ({ name: x.name, ...(x.code ? { code: x.code } : {}) })),
      });
      if (r.ok) added += r.added ?? 0;
      else failed = true;
    }
    setBusy(false);
    setMessage(failed ? `Imported ${added}; some rows could not be saved.` : `${added} subject${added === 1 ? "" : "s"} imported (duplicates skipped).`);
    setPreview(null);
    setCsv("");
    router.refresh();
  }

  const groups = new Map<string, AdminSubject[]>();
  for (const s of subjects) groups.set(`${s.branch} — Year ${s.year}`, [...(groups.get(`${s.branch} — Year ${s.year}`) ?? []), s]);

  return (
    <div className="mt-6 flex flex-col gap-8">
      <section className="o-card p-5">
        <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Add subjects</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
          <div>
            <label className="mb-1 block font-lp-mono text-[11px] text-app-muted" htmlFor="cur-branch">Branch</label>
            <input id="cur-branch" list="cur-branch-options" className={FIELD} value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Start typing, e.g. Computer Science" autoComplete="off" />
            <datalist id="cur-branch-options">
              {(branch.trim() ? searchBranches(branch) : []).map((b) => <option key={b.name} value={b.name} />)}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block font-lp-mono text-[11px] text-app-muted" htmlFor="cur-year">Year of study</label>
            <select id="cur-year" className={FIELD} value={year} onChange={(e) => setYear(e.target.value)}>
              {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
        </div>
        <label className="mt-3 mb-1 block font-lp-mono text-[11px] text-app-muted" htmlFor="cur-lines">One subject per line — optional code after a comma</label>
        <textarea id="cur-lines" className={`${FIELD} h-28`} value={lines} onChange={(e) => setLines(e.target.value)} placeholder={"Database Management Systems, CS301\nProbability and Statistics"} />
        <button type="button" disabled={busy} onClick={addFromForm} className="o-btn mt-3">
          {busy && <Loader2 size={13} className="animate-spin" />} Add subjects
        </button>
      </section>

      <section className="o-card p-5">
        <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Import from a template</h2>
        <p className="mt-1 font-lp-body text-[12px] text-app-muted">
          Paste CSV with the header <code className="font-lp-mono">branch,year,semester,subject_name,subject_code</code>. You&apos;ll see a preview before anything is saved.{" "}
          <button type="button" className="text-app-blue hover:underline" onClick={() => setCsv(CSV_TEMPLATE)}>Insert header</button>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 font-lp-body text-[12.5px]">
          <a
            href="/org/curriculum/template"
            download="curriculum-template.csv"
            className="o-btn-ghost"
          >
            Download template (.csv)
          </a>
          <label className="o-btn-ghost cursor-pointer">
            Upload filled file
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { void loadFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <span className="text-app-muted">Year 1–4, semester 1 or 2 (optional). Open the template in Excel or Google Sheets, fill one row per subject, save as CSV.</span>
        </div>
        <textarea aria-label="CSV" className={`${FIELD} mt-2 h-28 font-lp-mono text-[12px]`} value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); }} />
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={previewCsv} className="o-btn-ghost">Preview</button>
          {preview && (
            <button type="button" disabled={busy} onClick={importCsv} className="o-btn">
              Import {preview.length} subject{preview.length === 1 ? "" : "s"}
            </button>
          )}
        </div>
        {csvErrors.length > 0 && <ul className="mt-2 list-disc pl-5 font-lp-body text-[12px] text-app-orange" role="alert">{csvErrors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}</ul>}
        {preview && <p className="mt-2 font-lp-body text-[12px] text-app-muted">Preview: {preview.slice(0, 5).map((r) => `${r.name} (${r.branch}, Y${r.year})`).join("; ")}{preview.length > 5 ? "…" : ""}</p>}
      </section>

      <SyllabusExtraction initial={extraction} roleKey={roleKey} areas={areas} onMessage={setMessage} />

      {message && <p className="font-lp-body text-[12.5px] text-app-charcoal" role="status">{message}</p>}

      <section>
        <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Your subjects</h2>
        <p className="mt-1 font-lp-body text-[12px] text-app-muted">
          Map each subject to the {roleName} skills it builds. A mapping only counts once you confirm it; &ldquo;Suggest&rdquo; is a starting point, never saved automatically.
        </p>
        {subjects.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-app-border bg-white px-4 py-6 text-center font-lp-body text-[13px] text-app-muted">No subjects yet.</p>
        ) : (
          [...groups.entries()].map(([label, items]) => (
            <div key={label} className="mt-4">
              <h3 className="mb-2 font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-app-muted">{label}</h3>
              <ul className="flex flex-col gap-2">{items.map((s) => <SubjectMappingRow key={s.id} subject={s} roleKey={roleKey} areas={areas} />)}</ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
