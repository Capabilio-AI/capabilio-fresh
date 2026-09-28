"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BranchAutocomplete } from "@/components/login/BranchAutocomplete";

const YEAR_OPTIONS = [
  { value: "1-1", label: "1st Year, Sem 1" },
  { value: "1-2", label: "1st Year, Sem 2" },
  { value: "2-1", label: "2nd Year, Sem 1" },
  { value: "2-2", label: "2nd Year, Sem 2" },
  { value: "3-1", label: "3rd Year, Sem 1" },
  { value: "3-2", label: "3rd Year, Sem 2" },
  { value: "4-1", label: "4th Year, Sem 1" },
  { value: "4-2", label: "4th Year, Sem 2" },
];

const INPUT =
  "w-full rounded-lg border border-app-border bg-white px-3.5 py-2.5 font-lp-body text-[13px] text-app-charcoal placeholder:text-app-muted focus:border-app-blue focus:outline-none focus:ring-2 focus:ring-app-blue/25";

export function AddEducationHistoryForm({
  initialCollegeName,
  initialBranch,
  initialYear,
  onSaved,
}: {
  initialCollegeName: string;
  initialBranch: string;
  initialYear: string;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [collegeName, setCollegeName] = useState(initialCollegeName);
  const [branch, setBranch] = useState(initialBranch);
  const [year, setYear] = useState(initialYear);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (collegeName.trim().length < 2) {
      setError("Institution name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/education/institution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collegeName: collegeName.trim(), branch: branch.trim() || undefined, year: year || undefined }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save — check the fields and try again.");
      return;
    }
    router.refresh();
    onSaved();
  }

  return (
    <div className="rounded-xl border border-app-border bg-white p-5">
      <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Add educational history</h2>
      <div className="mt-3 flex flex-col gap-3">
        <div>
          <label className="mb-1 block font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">
            Institution
          </label>
          <input
            value={collegeName}
            onChange={(e) => setCollegeName(e.target.value)}
            placeholder="Institution name"
            className={INPUT}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">
              Branch
            </label>
            <BranchAutocomplete value={branch} onChange={setBranch} />
          </div>
          <div>
            <label className="mb-1 block font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">
              Year
            </label>
            <select value={year} onChange={(e) => setYear(e.target.value)} className={INPUT}>
              <option value="">Select year</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y.value} value={y.value}>
                  {y.label}
                </option>
              ))}
            </select>
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
