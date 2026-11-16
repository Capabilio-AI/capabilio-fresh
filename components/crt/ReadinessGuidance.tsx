import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CATEGORY_LABEL, type Category } from "@/lib/crt/categories";
import type { StudioView } from "@/lib/crt/studio-server";

/** One concrete way to improve each area. Plain advice, not a score: the student can act on it today. */
const HOW: Record<Category, string> = {
  aptitude: "Do 10 aptitude questions a day, and check the method in the explanation after each one. Speed comes after accuracy.",
  reasoning: "Practise one puzzle type a day (series, seating, coding-decoding). Write the pattern down before you pick an answer.",
  verbal: "Read one short article daily and note 3 new words. Do the grammar and vocabulary practice, then the Communication test.",
  speaking: "Record yourself answering one prompt in the Speaking Studio each day. Listen back for filler words and pace.",
  soft_skills: "Take the soft-skills test, then read the explanation for every answer you got wrong. It teaches what employers expect.",
  group_discussion: "Practise teamwork and leadership questions. In a real GD, speak early, build on others, and close with a summary.",
  interview: "Practise the common interview questions out loud. Use the spoken-communication practice, then try a mock.",
  workplace: "Write one short work email a day and compare it with the model answers in Workplace Writing practice.",
};
const WEAK_BELOW = 60;
const SHOW = 3;

/** Where the student stands in the common assessment, section by section, and where each score goes. */
export function CommonAssessmentCard({ common }: { common: StudioView["common"] }) {
  if (!common) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-app-border bg-[var(--m-ground)] p-4 font-lp-body text-[13px] text-app-muted">
        Take the common assessment and its scores appear here: Aptitude, Reasoning and Communication feed the radar below.{" "}
        <Link href="/assessment" className="font-bold text-app-charcoal underline">Take it now</Link>
      </div>
    );
  }
  const date = new Date(common.completedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return (
    <div className="mt-3 rounded-xl border border-app-border bg-[var(--m-ground)] p-4">
      <p className="font-lp-body text-[12.5px] font-bold uppercase tracking-wide text-app-muted">From your common assessment · {date}</p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {common.sections.map((s) => (
          <li key={s.section} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 font-lp-body text-[13px]">
            <span className="min-w-0">
              <span className="block truncate font-semibold text-app-charcoal">{s.label}</span>
              <span className="block text-[11.5px] text-app-muted">{s.correct} of {s.total} correct{s.area ? " · on the radar" : " · not part of the radar"}</span>
            </span>
            <strong className={s.score < WEAK_BELOW ? "text-app-warning" : "text-app-charcoal"}>{s.score}%</strong>
          </li>
        ))}
      </ul>
      <p className="mt-2 font-lp-body text-[12px] text-app-muted">Retake it any time: your newest result replaces this one on the radar. <Link href="/assessment?retake=1" className="font-bold text-app-charcoal underline">Retake</Link></p>
    </div>
  );
}

/** What to work on next: the weakest areas with evidence, each with one way to improve it. */
export function ImproveList({ view }: { view: StudioView }) {
  const weak = view.areas
    .filter((a) => a.competency.pct !== null && a.competency.pct < WEAK_BELOW)
    .sort((a, b) => a.competency.pct! - b.competency.pct!)
    .slice(0, SHOW);
  if (view.areas.every((a) => a.competency.pct === null)) return null;
  if (weak.length === 0) return <p className="mt-3 font-lp-body text-[13px] text-app-muted">Every area with evidence is at {WEAK_BELOW}% or above. Keep the streak going and try a full mock to test it under time.</p>;
  return (
    <div className="mt-4">
      <h3 className="font-lp-display text-[16px] font-bold text-app-charcoal">What to improve, and how</h3>
      <ol className="mt-2 flex flex-col gap-2">
        {weak.map((a) => (
          <li key={a.key} className="rounded-xl border border-app-border bg-white p-3 font-lp-body text-[13px]">
            <p className="flex items-center justify-between gap-3 font-semibold text-app-charcoal"><span>{CATEGORY_LABEL[a.key]}</span><span className="text-app-warning">{a.competency.pct}%</span></p>
            <p className="mt-1 text-app-muted">{HOW[a.key]}</p>
            <Link href="/skillstudio/crt" className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-bold text-app-charcoal">Practise now <ArrowRight size={13} aria-hidden /></Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
