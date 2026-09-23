import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ArenaSubNav } from "@/components/arena/ArenaSubNav";
import { MOCK_ARENA_PROJECTS } from "@/lib/mock/arena";

export const metadata: Metadata = { title: "Projects — Arena — Capabilio AI" };

const DIFFICULTY_COLOR: Record<string, string> = {
  Beginner: "bg-app-success-container text-app-success",
  Intermediate: "bg-app-warning-container text-app-warning",
  Advanced: "bg-app-attention-container text-app-attention",
};

export default async function ArenaProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Arena</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Timed challenges, projects, and competitions.</p>
      <div className="mt-4">
        <ArenaSubNav />
      </div>

      <div className="pt-6">
        <div className="mb-4 rounded-lg border border-dashed border-app-border bg-white px-4 py-3 font-lp-body text-[12.5px] text-app-muted">
          Project catalog is in development — these are sample scopes. Completed work still counts once you log it
          in your Vault.
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_ARENA_PROJECTS.map((project) => (
            <div key={project.id} className="flex flex-col gap-3 rounded-xl border border-app-border bg-white p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-lp-body text-[14.5px] font-semibold text-app-charcoal">{project.title}</h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-lp-mono text-[10.5px] font-semibold ${DIFFICULTY_COLOR[project.difficulty]}`}
                >
                  {project.difficulty}
                </span>
              </div>
              <p className="font-lp-body text-[12.5px] leading-relaxed text-app-muted">{project.summary}</p>
              <div className="flex flex-wrap gap-1.5">
                {project.skills.map((s) => (
                  <span key={s} className="rounded-full border border-app-border px-2 py-0.5 font-lp-mono text-[10.5px] text-app-muted">
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt-auto flex items-center gap-1.5 font-lp-mono text-[11px] text-app-muted">
                <Clock size={12} />
                ~{project.estimatedHours}h
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
