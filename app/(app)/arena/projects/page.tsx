import type { Metadata } from "next";
import Link from "next/link";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { ArenaSubNav } from "@/components/arena/ArenaSubNav";
import { AreaHero } from "@/components/metro/AreaHero";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrgContext } from "@/lib/org/context";
import { loadStudentProjects } from "@/lib/org/loaders";
import { Pill, formatDateTime } from "@/components/org/ui";
import { loadCareerResources } from "@/lib/roadmap-visual/career-resources";
import { ResourceGallery } from "@/components/roadmap/visual/ResourceGallery";

export const metadata: Metadata = { title: "Projects | Arena | Capabilio AI" };

export default async function ArenaProjectsPage() {
  const { supabase, user } = await requireAuthedUser();
  const service = createServiceClient();
  const ctx = await getOrgContext(supabase, user.id);
  const [facultyProjects, careers] = await Promise.all([
    ctx && ctx.kind === "student" ? loadStudentProjects(service, ctx) : Promise.resolve([]),
    loadCareerResources(service, user.id),
  ]);
  const withProjects = careers.filter((c) => c.projects.length > 0);

  return (
    <div>
      <AreaHero tone="dark" title="Projects" intro="Real projects for the career you chose. Open one for the steps, the skills it adds and what to show." nav={<ArenaSubNav />} />

      <div className="flex flex-col gap-10 pt-6">
        {withProjects.map((c) => (
          <section key={c.which} aria-labelledby={`pj-${c.which}`}>
            <h2 id={`pj-${c.which}`} className="mb-1 font-lp-display text-[24px] font-bold text-[var(--m-ink)]">{c.which === "primary" ? c.careerName : `${c.careerName} (Plan B)`}</h2>
            <p className="mb-4 font-lp-body text-[14px] text-app-muted">{c.projects.length} {c.projects.length === 1 ? "project" : "projects"} from your roadmap. Finish one and add it to your portfolio as proof.</p>
            <ResourceGallery resources={c.projects} career={c.which} emptyText="No projects yet." />
          </section>
        ))}

        {withProjects.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--m-off)] bg-white px-6 py-12 text-center">
            <p className="font-lp-body text-[14px] text-app-muted">Projects appear here once you choose a career with a roadmap.</p>
            <Link href="/dashboard/roadmap" className="mt-4 inline-block rounded-lg bg-[var(--m-ink)] px-4 py-2 text-[13px] font-bold text-white">Open your roadmap</Link>
          </div>
        )}

        {facultyProjects.length > 0 && (
          <section aria-labelledby="pj-faculty">
            <h2 id="pj-faculty" className="mb-4 font-lp-display text-[24px] font-bold text-[var(--m-ink)]">From your faculty</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {facultyProjects.map((p) => (
                <li key={p.id}>
                  <Link href={`/arena/projects/${p.id}`} className="flex h-full flex-col gap-2.5 rounded-xl border border-[var(--m-rule)] bg-white p-4 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--m-ink)] hover:shadow-[0_8px_20px_-8px_rgba(20,20,20,0.3)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                    <span className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">{p.title}</span>
                    <span className="text-[13px] text-app-muted">Due {formatDateTime(p.deadline_at)}</span>
                    <span className="mt-auto pt-1">{p.myGroup ? <Pill tone="ok">{p.myGroup.group.name} · {p.myGroup.group.status}</Pill> : <Pill tone={p.status === "open" ? "warn" : "neutral"}>{p.status === "open" ? "Not in a group" : p.status}</Pill>}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
