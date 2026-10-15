import { AlertTriangle, Lightbulb } from "lucide-react";
import type { TheoryLesson } from "@/lib/skillstudio/lesson-content";
import { CheckYourself } from "./CheckYourself";

/** The written lesson: scannable sections, a worked example each, then what to remember and what trips people up. */
export function TheoryView({ lesson }: { lesson: TheoryLesson }) {
  return (
    <article className="flex flex-col gap-6">
      <p className="max-w-[64ch] text-[17px] leading-relaxed text-[var(--m-ink)]">{lesson.summary}</p>
      {lesson.sections.map((s, i) => (
        <section key={i} aria-labelledby={`th-${i}`} className="flex flex-col gap-3">
          <h3 id={`th-${i}`} className="font-lp-display text-[22px] font-bold leading-snug text-[var(--m-ink)]">{s.heading}</h3>
          {s.paragraphs.map((p, pi) => <p key={pi} className="max-w-[68ch] text-[15.5px] leading-relaxed text-[var(--m-ink)]">{p}</p>)}
          {s.example && (
            <figure className="overflow-hidden rounded-xl border border-[var(--m-rule)] bg-[var(--m-ground)]">
              <figcaption className="px-4 pt-3 text-[14px] font-bold text-[var(--m-ink)]">{s.example.title}</figcaption>
              {s.example.code && <pre className="ss-scroll mx-4 mt-2 overflow-x-auto rounded-lg bg-[var(--m-ink)] p-4 font-lp-mono text-[13px] leading-relaxed text-white"><code>{s.example.code}</code></pre>}
              <p className="px-4 pb-4 pt-2 text-[14.5px] leading-relaxed text-[var(--m-ink)]">{s.example.explanation}</p>
            </figure>
          )}
        </section>
      ))}
      <section aria-labelledby="th-keys" className="rounded-2xl bg-[var(--m-ink)] p-5 text-white">
        <h3 id="th-keys" className="flex items-center gap-2 font-lp-display text-[20px] font-bold"><Lightbulb size={18} aria-hidden className="text-[var(--m-accent)]" />Remember this</h3>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed marker:text-[var(--m-accent)]">{lesson.takeaways.map((t, i) => <li key={i}>{t}</li>)}</ul>
      </section>
      {lesson.mistakes.length > 0 && (
        <section aria-labelledby="th-mistakes" className="rounded-2xl border border-[var(--m-rule)] bg-white p-5">
          <h3 id="th-mistakes" className="flex items-center gap-2 font-lp-display text-[20px] font-bold text-[var(--m-ink)]"><AlertTriangle size={18} aria-hidden />Common mistakes</h3>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed text-[var(--m-ink)]">{lesson.mistakes.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </section>
      )}
      <CheckYourself id="theory-check" questions={lesson.check} />
    </article>
  );
}
