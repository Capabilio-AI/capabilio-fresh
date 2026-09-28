"use client";

import { BadgeCheck, Building2, MapPin, Pencil } from "lucide-react";
import { AddEducationHistoryForm } from "./AddEducationHistoryForm";
import { CertificateUpload } from "./CertificateUpload";
import type { EducationEntry } from "@/lib/dashboard/education";

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

function formatEnrolledSince(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function subtitleLine(entry: EducationEntry): string {
  if (entry.degree || entry.fieldOfStudy) {
    return [entry.degree, entry.fieldOfStudy].filter(Boolean).join(", ");
  }
  return [entry.branch, formatYearSemester(entry.year)].filter(Boolean).join(" · ") || "Details not set";
}

function dateRangeLine(entry: EducationEntry): string | null {
  if (entry.startYear || entry.endYear) {
    return `${entry.startYear ?? "—"} – ${entry.endYear ?? "Present"}`;
  }
  return null;
}

type Mode = "view" | "edit" | "verify";

export function EducationEntryCard({
  entry,
  mode,
  onEdit,
  onVerify,
  onSaved,
  onDoneVerifying,
}: {
  entry: EducationEntry;
  mode: Mode;
  onEdit: () => void;
  onVerify: () => void;
  onSaved: (membershipId: string) => void;
  onDoneVerifying: () => void;
}) {
  if (mode === "edit") {
    return (
      <AddEducationHistoryForm
        membershipId={entry.id}
        initialCollegeName={entry.institutionName}
        initialDegree={entry.degree ?? ""}
        initialFieldOfStudy={entry.fieldOfStudy ?? entry.branch ?? ""}
        initialStartYear={entry.startYear ? String(entry.startYear) : ""}
        initialEndYear={entry.endYear ? String(entry.endYear) : ""}
        onSaved={onSaved}
      />
    );
  }

  if (mode === "verify") {
    return (
      <div className="rounded-xl border border-app-blue/30 bg-app-blue-container/40 p-5">
        <p className="font-lp-display text-[15px] font-semibold text-app-charcoal">
          Verify {entry.institutionName}
        </p>
        <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">
          Upload a bonafide, admission, or marksheet certificate — Capabilio checks it&rsquo;s a real file and marks
          this entry verified, then adds it to your Vault.
        </p>
        <div className="mt-3">
          <CertificateUpload
            heading="Upload a certificate"
            description="PDF, JPG, or PNG, up to 5MB."
            institutionMembershipId={entry.id}
            onUploaded={onDoneVerifying}
            onSkip={onDoneVerifying}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-app-border bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-app-orange-container text-app-orange">
            <Building2 size={22} />
          </span>
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 font-lp-display text-[16px] font-semibold text-app-charcoal">
              {entry.institutionName}
              {entry.hasVerifiedCertificate && (
                <span title="Verified with an uploaded certificate" className="text-app-success">
                  <BadgeCheck size={16} />
                </span>
              )}
            </h2>
            <p className="mt-0.5 font-lp-body text-[12.5px] text-app-muted">{subtitleLine(entry)}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-lp-mono text-[11px] text-app-muted">
              {dateRangeLine(entry) ?? `Enrolled ${formatEnrolledSince(entry.memberSince)}`}
              {(entry.city || entry.state) && (
                <span className="flex items-center gap-1">
                  <MapPin size={11} />
                  {[entry.city, entry.state].filter(Boolean).join(", ")}
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-app-border px-3 py-1.5 font-lp-mono text-[11px] text-app-muted hover:text-app-charcoal"
        >
          <Pencil size={12} />
          Edit
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-app-border pt-4 sm:grid-cols-2">
        <div>
          <p className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">College type</p>
          <p className="mt-1 font-lp-body text-[13px] text-app-charcoal">
            {entry.collegeType ? (COLLEGE_TYPE_LABEL[entry.collegeType] ?? entry.collegeType) : "—"}
          </p>
        </div>
        {!entry.hasVerifiedCertificate && (
          <div className="flex items-center justify-start sm:justify-end">
            <button
              type="button"
              onClick={onVerify}
              className="rounded-lg bg-app-blue px-3 py-1.5 font-lp-mono text-[11px] font-semibold text-white"
            >
              Verify with a certificate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
