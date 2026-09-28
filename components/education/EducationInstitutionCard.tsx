"use client";

import { useState } from "react";
import { BadgeCheck, Building2, MapPin, Pencil } from "lucide-react";
import { AddEducationHistoryForm } from "./AddEducationHistoryForm";
import { CertificateUpload } from "./CertificateUpload";

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

function formatEnrolledSince(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

type Step = "view" | "form" | "verify";

export function EducationInstitutionCard({
  institutionName,
  collegeType,
  city,
  state,
  branch,
  year,
  memberSince,
  hasVerifiedCertificate,
}: {
  institutionName: string | null;
  collegeType: string | null;
  city: string | null;
  state: string | null;
  branch: string | null;
  year: string | null;
  memberSince: string | null;
  hasVerifiedCertificate: boolean;
}) {
  const [step, setStep] = useState<Step>("view");

  if (step === "form") {
    return (
      <AddEducationHistoryForm
        initialCollegeName={institutionName ?? ""}
        initialBranch={branch ?? ""}
        initialYear={year ?? ""}
        onSaved={() => setStep(hasVerifiedCertificate ? "view" : "verify")}
      />
    );
  }

  if (step === "verify") {
    return (
      <div className="rounded-xl border border-app-blue/30 bg-app-blue-container/40 p-5">
        <p className="font-lp-display text-[15px] font-semibold text-app-charcoal">Verify your education</p>
        <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">
          Upload a bonafide, admission, or marksheet certificate — Capabilio checks it&rsquo;s a real file and marks
          your record verified, then adds it to your Vault.
        </p>
        <div className="mt-3">
          <CertificateUpload
            heading="Upload a certificate"
            description="PDF, JPG, or PNG, up to 5MB."
            onUploaded={() => setStep("view")}
            onSkip={() => setStep("view")}
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
              {institutionName ?? "No institution on record"}
              {hasVerifiedCertificate && (
                <span title="Verified with an uploaded certificate" className="text-app-success">
                  <BadgeCheck size={16} />
                </span>
              )}
            </h2>
            <p className="mt-0.5 font-lp-body text-[12.5px] text-app-muted">
              {[branch, formatYearSemester(year)].filter(Boolean).join(" · ") || "Branch not set"}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-lp-mono text-[11px] text-app-muted">
              {(city || state) && (
                <span className="flex items-center gap-1">
                  <MapPin size={11} />
                  {[city, state].filter(Boolean).join(", ")}
                </span>
              )}
              {memberSince && <span>· Enrolled {formatEnrolledSince(memberSince)}</span>}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setStep("form")}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-app-border px-3 py-1.5 font-lp-mono text-[11px] text-app-muted hover:text-app-charcoal"
        >
          <Pencil size={12} />
          {institutionName ? "Edit" : "Add educational history"}
        </button>
      </div>

      {institutionName && (
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-app-border pt-4 sm:grid-cols-2">
          <div>
            <p className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">College type</p>
            <p className="mt-1 font-lp-body text-[13px] text-app-charcoal">
              {collegeType ? (COLLEGE_TYPE_LABEL[collegeType] ?? collegeType) : "—"}
            </p>
          </div>
          {!hasVerifiedCertificate && (
            <div className="flex items-center justify-start sm:justify-end">
              <button
                type="button"
                onClick={() => setStep("verify")}
                className="rounded-lg bg-app-blue px-3 py-1.5 font-lp-mono text-[11px] font-semibold text-white"
              >
                Verify with a certificate
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
