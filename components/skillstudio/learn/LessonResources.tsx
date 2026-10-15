import Link from "next/link";
import { ArrowUpRight, BadgeCheck, BookOpen, FileText, FolderKanban, GraduationCap, PencilRuler, PlayCircle, Swords, Award, type LucideIcon } from "lucide-react";
import type { Resource, ResourceType } from "@/lib/roadmap-visual/graph-types";
import type { NodeExplanation } from "@/lib/roadmap-visual/explain-node";

const TYPE: Record<ResourceType, { icon: LucideIcon; label: string }> = {
  VIDEO: { icon: PlayCircle, label: "Video" },
  COURSE: { icon: GraduationCap, label: "Course" },
  BOOK: { icon: BookOpen, label: "Book" },
  ARTICLE: { icon: FileText, label: "Article" },
  OFFICIAL: { icon: BadgeCheck, label: "Official docs" },
  PRACTICE: { icon: PencilRuler, label: "Practice" },
};

function Row({ r, fallback }: { r: Resource; fallback: { icon: LucideIcon; label: string } }) {
  const { icon: Icon, label } = r.type ? TYPE[r.type] : fallback;
  const external = r.url?.startsWith("https://");
  const meta = [label, r.provider, r.hours ? `${r.hours} h` : null, r.cost, r.difficulty].filter(Boolean).join(" · ");
  const inner = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--m-ground)] text-[var(--m-ink)]"><Icon size={18} aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold leading-snug text-[var(--m-ink)]">{r.title}</span>
        <span className="ss-num mt-0.5 block text-[13px] text-[var(--m-muted)]">{meta}</span>
      </span>
      {r.url && <ArrowUpRight size={16} aria-hidden className="shrink-0 text-[var(--m-muted)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" />}
    </>
  );
  const cls = "group flex items-center gap-3 rounded-xl border border-[var(--m-rule)] bg-white p-3 transition-colors motion-reduce:transition-none";
  if (!r.url) return <li className={cls}>{inner}</li>;
  return (
    <li>
      {external ? (
        <a href={r.url} target="_blank" rel="noopener noreferrer" className={`${cls} hover:border-[var(--m-ink)]`}>{inner}<span className="sr-only"> (opens in a new tab)</span></a>
      ) : (
        <Link href={r.url} className={`${cls} hover:border-[var(--m-ink)]`}>{inner}</Link>
      )}
    </li>
  );
}

function Group({ title, items, fallback }: { title: string; items: Resource[]; fallback: { icon: LucideIcon; label: string } }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-[14px] font-bold text-[var(--m-muted)]">{title}</h3>
      <ul className="flex flex-col gap-2">{items.map((r) => <Row key={`${r.kind}${r.id}`} r={r} fallback={fallback} />)}</ul>
    </div>
  );
}

/** What to read or watch, and how to prove it. Only items that exist in the catalogue; a topic with none says so. */
export function LessonResources({ e }: { e: Pick<NodeExplanation, "resources" | "practice" | "whatIf"> }) {
  const hasPractice = e.practice.arena.length + e.practice.projects.length + e.practice.certifications.length > 0;
  return (
    <>
      <section aria-labelledby="res-h" className="rounded-2xl border border-[var(--m-rule)] bg-white p-5">
        <h2 id="res-h" className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">Learning resources</h2>
        {e.resources.none ? (
          <p className="mt-2 max-w-[56ch] text-[14.5px] leading-relaxed text-[var(--m-muted)]">No resources are listed for this lesson yet. Your tutor above can teach it, and the practice below will show where you stand.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            <Group title="Free" items={e.resources.free} fallback={TYPE.ARTICLE} />
            <Group title="Paid" items={e.resources.premium} fallback={TYPE.COURSE} />
          </div>
        )}
      </section>

      <section aria-labelledby="prove-h" className="rounded-2xl border border-[var(--m-rule)] bg-white p-5">
        <h2 id="prove-h" className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">Prove it</h2>
        <p className="mt-1 text-[14px] text-[var(--m-muted)]">This lesson turns solid when your work shows it. Passing a challenge or finishing a project counts; reading does not.</p>
        {e.whatIf.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {e.whatIf.map((w) => <li key={w.resourceId} className="ss-num rounded-lg bg-[var(--m-accent-soft)] px-3 py-2 text-[14px] text-[var(--m-ink)]">Passing <strong>{w.title}</strong> would take you {w.from === null ? "to" : `from ${w.from}% to`} <strong>{w.to}%</strong>.</li>)}
          </ul>
        )}
        {hasPractice ? (
          <div className="mt-4 flex flex-col gap-4">
            <Group title="Arena challenges" items={e.practice.arena} fallback={{ icon: Swords, label: "Arena" }} />
            <Group title="Projects" items={e.practice.projects} fallback={{ icon: FolderKanban, label: "Project" }} />
            <Group title="Certifications" items={e.practice.certifications} fallback={{ icon: Award, label: "Certification" }} />
          </div>
        ) : (
          <p className="mt-3 text-[14.5px] text-[var(--m-muted)]">No challenge or project is attached to this lesson yet. <Link href="/arena" className="font-bold text-[var(--m-accent-ink)] hover:underline">Browse Arena</Link> for something close.</p>
        )}
      </section>
    </>
  );
}
