"use client";

import { useState } from "react";
import { Building2, MapPin, Pencil } from "lucide-react";
import { AddEducationHistoryForm } from "./AddEducationHistoryForm";

const COLLEGE_TYPE_LABEL: Record<string, string> = {
  engineering: "Engineering & Technology (AICTE)",
  medical: "Medical & Health Sciences",
  management: "Management Studies (AICTE)",
  arts_science: "Arts & Science",
  pharmacy: "Pharmacy (AICTE)",
  law: "Law",
  other: "General / Other",
};

function formatYearSemester(year: string | null): string | null {
  if (!year) return null;
  const [y, s] = year.split("-");
  const ordinal: Record<string, string> = { "1": "1st", "2": "2nd", "3": "3rd", "4": "4th" };
  return `${ordinal[y] ?? y} Year, Semester ${s}`;
}

export function EducationInstitutionCard({
  institutionName,
  collegeType,
  city,
  state,
  branch,
  year,
}: {
  institutionName: string | null;
  collegeType: string | null;
  city: string | null;
  state: string | null;
  branch: string | null;
  year: string | null;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <AddEducationHistoryForm
        initialCollegeName={institutionName ?? ""}
        initialBranch={branch ?? ""}
        initialYear={year ?? ""}
        onSaved={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-xl border border-app-border bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-app-background text-app-charcoal">
            <Building2 size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="font-lp-display text-[16px] font-semibold text-app-charcoal">
              {institutionName ?? "No institution on record"}
            </h2>
            {(city || state) && (
              <p className="mt-0.5 flex items-center gap-1 font-lp-mono text-[11px] text-app-muted">
                <MapPin size={11} />
                {[city, state].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-app-border px-3 py-1.5 font-lp-mono text-[11px] text-app-muted hover:text-app-charcoal"
        >
          <Pencil size={12} />
          {institutionName ? "Edit" : "Add educational history"}
        </button>
      </div>

      {institutionName && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <p className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">College type</p>
            <p className="mt-1 font-lp-body text-[13px] text-app-charcoal">
              {collegeType ? (COLLEGE_TYPE_LABEL[collegeType] ?? collegeType) : "—"}
            </p>
          </div>
          <div>
            <p className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">Branch</p>
            <p className="mt-1 font-lp-body text-[13px] text-app-charcoal">{branch ?? "—"}</p>
          </div>
          <div>
            <p className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">Year</p>
            <p className="mt-1 font-lp-body text-[13px] text-app-charcoal">{formatYearSemester(year) ?? "—"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
