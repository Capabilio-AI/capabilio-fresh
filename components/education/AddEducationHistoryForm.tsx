"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR + 6 - 1980 + 1 }, (_, i) => CURRENT_YEAR + 5 - i);

const INPUT =
  "w-full rounded-lg border border-app-border bg-white px-3.5 py-2.5 font-lp-body text-[13px] text-app-charcoal placeholder:text-app-muted focus:border-app-blue focus:outline-none focus:ring-2 focus:ring-app-blue/25";

export function AddEducationHistoryForm({
  membershipId,
  initialCollegeName = "",
  initialDegree = "",
  initialFieldOfStudy = "",
  initialStartYear = "",
  initialEndYear = "",
  onSaved,
}: {
  membershipId?: string;
  initialCollegeName?: string;
  initialDegree?: string;
  initialFieldOfStudy?: string;
  initialStartYear?: string;
  initialEndYear?: string;
  onSaved: (membershipId: string) => void;
}) {
  const router = useRouter();
  const [collegeName, setCollegeName] = useState(initialCollegeName);
  const [degree, setDegree] = useState(initialDegree);
  const [fieldOfStudy, setFieldOfStudy] = useState(initialFieldOfStudy);
  const [startYear, setStartYear] = useState(initialStartYear);
  const [endYear, setEndYear] = useState(initialEndYear);
  const [current, setCurrent] = useState(initialStartYear !== "" && initialEndYear === "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (collegeName.trim().length < 2) {
      setError("Institution name (School) is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/education/institution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        membershipId,
        collegeName: collegeName.trim(),
        degree: degree.trim() || undefined,
        fieldOfStudy: fieldOfStudy.trim() || undefined,
        startYear: startYear ? Number(startYear) : undefined,
        endYear: !current && endYear ? Number(endYear) : undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save — check the fields and try again.");
      return;
    }
    const data = await res.json();
    router.refresh();
    onSaved(data.membershipId);
  }

  return (
    <div className="rounded-xl border border-app-border bg-white p-5">
      <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">
        {membershipId ? "Edit education" : "Add education"}
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        <div>
          <label className="mb-1 block font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">
            School
          </label>
          <input
            value={collegeName}
            onChange={(e) => setCollegeName(e.target.value)}
            placeholder="Ex: Amrita Sai Institute of Science and Technology"
            className={INPUT}
          />
        </div>
        <div>
          <label className="mb-1 block font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">
            Degree
          </label>
          <input
            value={degree}
            onChange={(e) => setDegree(e.target.value)}
            placeholder="Ex: 10th / SSC, Intermediate, B.Tech, M.Tech"
            className={INPUT}
          />
        </div>
        <div>
          <label className="mb-1 block font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">
            Field of study
          </label>
          <input
            value={fieldOfStudy}
            onChange={(e) => setFieldOfStudy(e.target.value)}
            placeholder="Ex: Mechanical Engineering"
            className={INPUT}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">
              Start year
            </label>
            <select value={startYear} onChange={(e) => setStartYear(e.target.value)} className={INPUT}>
              <option value="">Year</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">
              End year (or expected)
            </label>
            <select
              value={endYear}
              onChange={(e) => setEndYear(e.target.value)}
              disabled={current}
              className={`${INPUT} disabled:opacity-50`}
            >
              <option value="">Year</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <label className="mt-1.5 flex items-center gap-1.5 font-lp-mono text-[11px] text-app-muted">
              <input
                type="checkbox"
                checked={current}
                onChange={(e) => {
                  setCurrent(e.target.checked);
                  if (e.target.checked) setEndYear("");
                }}
              />
              Currently studying here
            </label>
          </div>
        </div>
        {error && <p className="font-lp-body text-[12.5px] text-app-warning">{error}</p>}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="w-fit rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
