import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { GraduationCap, Layers, School } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getViewerSummary, initialsOf } from "@/lib/dashboard/viewer";
import { getSkills } from "@/lib/dashboard/data";
import { getVaultItems } from "@/lib/vault/data";
import { matchCareersForStudent } from "@/lib/career/match";
import { CapabilityCard } from "@/components/dashboard/CapabilityCard";

export const metadata: Metadata = { title: "Profile — Capabilio AI" };

function formatYearSemester(year: string | null): string | null {
  if (!year) return null;
  const [y, s] = year.split("-");
  const ordinal: Record<string, string> = { "1": "1st", "2": "2nd", "3": "3rd", "4": "4th" };
  return `${ordinal[y] ?? y} Year, Sem ${s}`;
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [viewer, skills, vaultItems, careerMatches] = await Promise.all([
    getViewerSummary(supabase, user.id),
    getSkills(supabase, user.id),
    getVaultItems(supabase, user.id),
    matchCareersForStudent(supabase, user.id),
  ]);
  const yearLabel = formatYearSemester(viewer.year);
  const topMatch = careerMatches[0] ?? null;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-app-charcoal font-lp-display text-[18px] font-semibold text-white">
          {initialsOf(viewer.fullName, viewer.email)}
        </span>
        <div>
          <h1 className="font-lp-display text-[24px] font-semibold text-app-charcoal">
            {viewer.fullName ?? "Student"}
          </h1>
          <p className="font-lp-body text-[13px] text-app-muted">{viewer.email}</p>
          {topMatch && (
            <p className="mt-1 font-lp-mono text-[11px] text-app-orange">Aiming for {topMatch.careerRole}</p>
          )}
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

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <CapabilityCard skills={skills} />

        <div className="rounded-xl border border-app-border bg-white p-5">
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
            <ul className="mt-3 flex flex-col gap-2">
              {vaultItems.slice(0, 4).map((item) => (
                <li key={item.id} className="flex items-center justify-between font-lp-body text-[13px]">
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
    </div>
  );
}
