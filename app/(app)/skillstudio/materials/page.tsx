import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrgContext } from "@/lib/org/context";
import { getViewerSummary } from "@/lib/dashboard/viewer";
import { loadStudentMaterials } from "@/lib/org/loaders";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { EmptyState, Pill } from "@/components/org/ui";

export const metadata: Metadata = { title: "Materials — SkillStudio — Capabilio AI" };

export default async function SkillStudioMaterialsPage() {
  const { supabase, user } = await requireAuthedUser();
  const ctx = await getOrgContext(supabase, user.id);
  const viewer = await getViewerSummary(supabase, user.id);
  const currentYear = viewer.direction?.academicYear?.year ?? null;
  const materials = ctx && ctx.kind === "student" ? await loadStudentMaterials(createServiceClient(), ctx, currentYear) : [];

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">SkillStudio</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Your personalized learning path, foundations, courses, and certifications.</p>
      <div className="mt-4">
        <SkillStudioSubNav />
      </div>

      <div className="pt-6">
        <p className="mb-3 font-lp-body text-[13px] text-app-muted">
          Notes, PDFs and links your faculty shared with your department{currentYear ? ` for year ${currentYear}` : ""}.
        </p>
        {materials.length === 0 ? (
          <EmptyState
            title="No materials yet"
            body={ctx?.kind === "student" && !ctx.branch ? "Add your branch to your profile to see materials for it." : "Faculty haven't shared anything for your branch and year yet."}
          />
        ) : (
          <ul className="divide-y divide-app-border rounded-xl border border-app-border bg-white">
            {materials.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-lp-body text-[13.5px] font-medium text-app-charcoal">{m.title}</p>
                  <div className="flex items-center gap-2">
                    <Pill>{m.type}</Pill>
                    {m.url && (
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="font-lp-body text-[12.5px] text-app-blue hover:underline">
                        Open
                      </a>
                    )}
                  </div>
                </div>
                {m.description && <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">{m.description}</p>}
                {m.type === "notes" && m.body && <p className="mt-2 whitespace-pre-wrap font-lp-body text-[13px] text-app-charcoal">{m.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
