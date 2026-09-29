import type { Metadata } from "next";
import Link from "next/link";
import { Building2, GraduationCap, Layers, School } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getViewerSummary, initialsOf } from "@/lib/dashboard/viewer";
import { getSkills } from "@/lib/dashboard/data";
import { getVaultItems } from "@/lib/vault/data";
import { getEducationEntries } from "@/lib/dashboard/education";
import { formatAcademicYear } from "@/lib/career/academic-year";
import { matchCareersForStudent } from "@/lib/career/match";
import { CapabilityCard, overallCapabilityScore } from "@/components/dashboard/CapabilityCard";
import { AvatarUpload } from "@/components/profile/AvatarUpload";

export const metadata: Metadata = { title: "Profile — Capabilio AI" };

export default async function ProfilePage() {
  const { supabase, user } = await requireAuthedUser();

  const [viewer, skills, vaultItems, careerMatches, educationEntries] = await Promise.all([
    getViewerSummary(supabase, user.id),
    getSkills(supabase, user.id),
    getVaultItems(supabase, user.id),
    matchCareersForStudent(supabase, user.id),
    getEducationEntries(supabase, user.id),
  ]);
  const yearLabel = formatAcademicYear(viewer.direction?.academicYear?.year ?? null, viewer.direction?.startYear ?? null, viewer.direction?.endYear ?? null);
  const topMatch = careerMatches[0] ?? null;
  const initials = initialsOf(viewer.fullName, viewer.email);
  const capabilityScore = overallCapabilityScore(skills);
  const verifiedCount = vaultItems.filter((v) => v.verified).length;

  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-app-charcoal">
        <div className="flex items-center gap-4 p-6">
          <AvatarUpload avatarUrl={viewer.avatarUrl} initials={initials} />
          <div className="min-w-0">
            <h1 className="font-lp-display text-[22px] font-semibold text-white">{viewer.fullName ?? "Student"}</h1>
            {topMatch && (
              <span className="mt-1.5 inline-block rounded-full bg-app-orange/15 px-2.5 py-0.5 font-lp-mono text-[11px] font-semibold text-app-orange">
                Aiming for {topMatch.careerRole}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10">
          <div className="flex flex-col items-center gap-0.5 py-3">
            <span className="font-lp-display text-[18px] font-semibold text-white">
              {capabilityScore ?? "—"}
            </span>
            <span className="font-lp-mono text-[10px] uppercase tracking-wide text-white/50">Capability</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 py-3">
            <span className="font-lp-display text-[18px] font-semibold text-white">{vaultItems.length}</span>
            <span className="font-lp-mono text-[10px] uppercase tracking-wide text-white/50">Vault items</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 py-3">
            <span className="font-lp-display text-[18px] font-semibold text-white">{verifiedCount}</span>
            <span className="font-lp-mono text-[10px] uppercase tracking-wide text-white/50">Verified</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {viewer.collegeName && (
          <span className="flex items-center gap-1.5 rounded-full border border-app-border bg-white px-3 py-1 font-lp-mono text-[11px] text-app-muted">
            <School size={12} />
            {viewer.collegeName}
          </span>
        )}
        {viewer.branch && (
          <span className="flex items-center gap-1.5 rounded-full border border-app-border bg-white px-3 py-1 font-lp-mono text-[11px] text-app-muted">
            <Layers size={12} />
            {viewer.branch}
          </span>
        )}
        {yearLabel && (
          <span className="flex items-center gap-1.5 rounded-full border border-app-border bg-white px-3 py-1 font-lp-mono text-[11px] text-app-muted">
            <GraduationCap size={12} />
            {yearLabel}
          </span>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <CapabilityCard skills={skills} />

        <div className="rounded-xl border border-app-border bg-white p-5">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-app-charcoal" />
            <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Education</h2>
          </div>
          {educationEntries.length === 0 ? (
            <p className="mt-3 font-lp-body text-[13px] text-app-muted">No institution on record yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2.5">
              {educationEntries.slice(0, 2).map((entry) => (
                <li key={entry.id}>
                  <p className="font-lp-body text-[13px] font-medium text-app-charcoal">{entry.institutionName}</p>
                  <p className="mt-0.5 font-lp-mono text-[11px] text-app-muted">
                    {[entry.degree, entry.fieldOfStudy].filter(Boolean).join(", ") ||
                      [entry.branch, entry.startYear != null && entry.endYear != null ? `${entry.startYear}–${entry.endYear}` : null].filter(Boolean).join(" · ") ||
                      "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/dashboard/education"
            className="mt-3 inline-block font-lp-mono text-[11px] text-app-blue hover:underline"
          >
            {educationEntries.length > 2 ? `View all ${educationEntries.length} entries` : "View educational history"}
          </Link>
        </div>

      </div>

      <div className="mt-5 rounded-xl border border-app-border bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Portfolio</h2>
          <a href="/dashboard/portfolio" className="font-lp-mono text-[11px] text-app-blue hover:underline">
            View full portfolio
          </a>
        </div>
        <p className="mt-1 font-lp-mono text-[11px] text-app-muted">{vaultItems.length} item(s) in your Vault</p>
        {vaultItems.length === 0 ? (
          <p className="mt-4 font-lp-body text-[13px] text-app-muted">
            Nothing added yet — certificates, projects, and links will show up here.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {vaultItems.slice(0, 6).map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-app-border px-3 py-2 font-lp-body text-[13px]"
              >
                <span className="truncate text-app-charcoal">{item.title}</span>
                <span className="shrink-0 font-lp-mono text-[10.5px] uppercase text-app-muted">
                  {item.item_type}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
