import Link from "next/link";
import type { GraphUnavailable } from "@/lib/roadmap-visual/graph-types";

const COPY = (r: GraphUnavailable): { title: string; body: string; cta?: { href: string; label: string } } => {
  switch (r.state) {
    case "NO_CAREER": return { title: "Choose a career to see your roadmap", body: "Your roadmap is built around the career you're aiming for. Pick one (or a Plan B) and we'll lay out the path.", cta: { href: "/dashboard", label: "Choose a career" } };
    case "EXPLORING": return { title: "You're still exploring", body: "A roadmap needs a target. When you're ready, choose a primary career and it appears here. Until then, your Overview shows the careers that fit you best.", cta: { href: "/dashboard", label: "See career matches" } };
    case "NO_PLAN_B": return { title: "No Plan B chosen", body: "You haven't picked a second career yet. You can add one any time.", cta: { href: "/dashboard", label: "Add a Plan B" } };
    case "NO_TEMPLATE": return { title: `The ${r.career.name} roadmap isn't ready yet`, body: "We haven't published a visual roadmap for this career yet. Your skill gaps and plan are still available under Skill Gap, and we'll show the full map here as soon as it's published.", cta: { href: "/dashboard/skills?view=gaps", label: "See your skill gaps" } };
    case "NO_MEMBERSHIP": return { title: "Join your college to personalise this", body: "Link your college to see how your syllabus maps to the roadmap.", cta: { href: "/dashboard/vault", label: "Add your college" } };
  }
};

export function RoadmapEmpty({ reason }: { reason: GraphUnavailable }) {
  const c = COPY(reason);
  return (
    <div className="rounded-xl border border-dashed border-app-border bg-white px-6 py-10 text-center">
      <h2 className="font-lp-display text-[18px] font-semibold text-app-charcoal">{c.title}</h2>
      <p className="mx-auto mt-1.5 max-w-[56ch] font-lp-body text-[13.5px] text-app-muted">{c.body}</p>
      {c.cta && <Link href={c.cta.href} className="mt-4 inline-block rounded-md bg-app-charcoal px-4 py-2 font-lp-body text-[13px] text-white">{c.cta.label}</Link>}
    </div>
  );
}
