import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Code2, Cpu, Laptop2, Lock } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getStudentDirection } from "@/lib/career/direction";
import { streamOf, STREAM_SUGGESTIONS } from "@/lib/explore/stream";
import { tierRows } from "@/lib/languages/tiers";
import { loadProvenTiers } from "@/lib/languages/tier-proof";
import { AreaHero } from "@/components/metro/AreaHero";
import { SkillStudioSubNav } from "@/components/skillstudio/SkillStudioSubNav";
import { LearnSearch } from "@/components/courses/LearnSearch";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "Courses | SkillStudio | Capabilio AI" };

/**
 * Courses, kept simple: search for what you want to learn, or pick one of three doors. Each door has one sentence and one button. The four levels are
 * shown once, below, for programming (the only area with level tests so far), instead of eight lines of "coming soon" inside the cards.
 */
export default async function CoursesPage() {
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  const direction = await getStudentDirection(service, user.id);
  const year = direction?.academicYear?.year ?? null;
  const stream = streamOf(direction?.branch ?? null);
  const proven = await loadProvenTiers(service, user.id, "basic-programming").catch(() => []);
  const levels = tierRows(proven, year);
  const branchLine = stream === "it" ? "Your branch is IT. See the IT courses." : stream === "other" ? "Mechanical, Civil, ECE, EEE and more." : `Courses for ${STREAM_SUGGESTIONS[stream].label}.`;

  const doors = [
    { href: "/skillstudio/courses/basic-programming", Icon: Code2, title: "Learn a programming language", line: "Python, Java, C, C++, SQL, HTML, JavaScript and C#. Small steps, with code you can try.", cta: "See the languages" },
    { href: "/skillstudio/courses/stream", Icon: Cpu, title: "Learn for your branch", line: branchLine, cta: "See my branch" },
    { href: "/skillstudio/courses/it", Icon: Laptop2, title: "Learn IT skills", line: "Software, data, cloud, security and AI. Open to every branch.", cta: "See IT skills" },
  ];

  return (
    <div className="ss-studio">
      <AreaHero tone="tint" title="Courses" intro="Learn one small step at a time. Pass a short test to open the next step." nav={<SkillStudioSubNav />} />
      <div className="flex flex-col gap-6 pb-12 pt-6">
        <LearnSearch />
        <ul className="grid gap-4 lg:grid-cols-3">
          {doors.map(({ href, Icon, title, line, cta }) => (
            <li key={href}>
              <Link href={href} className="group flex h-full flex-col gap-3 rounded-2xl border border-[var(--m-rule)] bg-white p-5 transition-colors hover:border-[var(--m-ink)] focus-visible:border-[var(--m-ink)]">
                <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--m-ink)] text-white"><Icon size={26} /></span>
                <span className="font-lp-display text-[22px] font-bold leading-tight text-[var(--m-ink)]">{title}</span>
                <span className="text-[14.5px] leading-snug text-[var(--m-muted)]">{line}</span>
                <span className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--m-ink)] px-4 py-2.5 text-[14.5px] font-bold text-white">{cta}<ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-0.5" /></span>
              </Link>
            </li>
          ))}
        </ul>
        <section aria-labelledby="levels" className="rounded-2xl border border-[var(--m-rule)] bg-white p-5">
          <h2 id="levels" className="font-lp-display text-[22px] font-bold leading-tight text-[var(--m-ink)]">Your programming level</h2>
          <p className="mt-1 text-[14.5px] text-[var(--m-muted)]">There are four levels. Pass a level test to open the next one.</p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-4">
            {levels.map((t) => (
              <li key={t.n} className="flex flex-col gap-1 rounded-xl border border-[var(--m-rule)] px-3 py-2.5">
                <span className="flex items-center gap-2 text-[14.5px] font-bold text-[var(--m-ink)]">
                  <span aria-hidden className="text-[var(--m-accent-ink)]">{t.status === "proven" ? <Check size={16} /> : t.status === "locked" ? <Lock size={15} /> : <span className="ss-num text-[13px]">{t.n}</span>}</span>
                  {t.label}{t.suggested && <span className="rounded-full bg-[var(--m-accent-soft)] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--m-accent-ink)]">For you</span>}
                </span>
                <span className="text-[13px] text-[var(--m-muted)]">
                  {t.status === "proven" ? "Done" : t.status === "locked" ? "Locked" : <Link href={`/skillstudio/courses/proof?area=basic-programming&tier=${t.n}`} className="font-bold text-[var(--m-accent-ink)]">Take the test</Link>}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
