"use client";

import Link from "next/link";
import { ArrowRight, Lightbulb, Swords } from "lucide-react";
import { Playground } from "@/components/skillstudio/learn/Playground";
import { CheckYourself } from "@/components/skillstudio/learn/CheckYourself";
import type { RoleLesson } from "@/lib/role-lessons/types";

/**
 * One lesson of a role's path: the idea with an everyday analogy, runnable examples (the output a real run gave is shown beside each), and questions to answer from memory.
 * It is practice; the proof is in Arena, which the last lesson of a level points to.
 */
export function RoleLessonView({ lesson, next, proveHref }: { lesson: RoleLesson; next: { href: string; title: string } | null; proveHref: string }) {
  return (
    <article className="flex max-w-[860px] flex-col gap-6">
      <p className="max-w-[64ch] text-[17px] leading-relaxed text-[var(--m-ink)]">{lesson.summary}</p>
      <aside className="flex gap-4 rounded-2xl bg-[var(--m-ground)] p-5">
        <span aria-hidden className="text-[34px] leading-none">{lesson.analogy.icon}</span>
        <div className="min-w-0">
          <p className="font-lp-display text-[19px] font-bold text-[var(--m-ink)]">{lesson.analogy.title}</p>
          <p className="mt-1 text-[15px] leading-relaxed text-[var(--m-ink)]">{lesson.analogy.text}</p>
          <ul className="mt-3 flex flex-col gap-1 text-[13.5px] text-[var(--m-muted)]">{lesson.analogy.pairs.map(([a, b]) => <li key={a}>{a} <span aria-hidden>→</span> <code className="font-lp-mono text-[var(--m-ink)]">{b}</code></li>)}</ul>
        </div>
      </aside>
      {lesson.sections.map((s, i) => (
        <section key={s.heading} aria-labelledby={`rl-${i}`} className="flex flex-col gap-3">
          <h2 id={`rl-${i}`} className="font-lp-display text-[22px] font-bold leading-snug text-[var(--m-ink)]">{s.heading}</h2>
          {s.body.map((p) => <p key={p} className="max-w-[68ch] text-[15.5px] leading-relaxed text-[var(--m-ink)]">{p}</p>)}
          <figure className="overflow-hidden rounded-xl border border-[var(--m-rule)] bg-[var(--m-ground)]">
            <figcaption className="px-4 pt-3 text-[14px] font-bold text-[var(--m-ink)]">{s.example.title}</figcaption>
            <Playground code={s.example.code} language="python" title={s.example.title} data />
            <details className="px-4 pt-2 text-[13.5px]"><summary className="cursor-pointer font-bold text-[var(--m-muted)]">What this prints</summary><pre className="ss-scroll mt-2 overflow-x-auto rounded-lg bg-[var(--m-ink)] p-3 font-lp-mono text-[12.5px] leading-relaxed text-white"><code>{s.example.output}</code></pre></details>
            <p className="px-4 pb-4 pt-2 text-[14.5px] leading-relaxed text-[var(--m-ink)]">{s.example.explanation}</p>
          </figure>
        </section>
      ))}
      <section aria-labelledby="rl-keys" className="rounded-2xl bg-[var(--m-ink)] p-5 text-white">
        <h2 id="rl-keys" className="flex items-center gap-2 font-lp-display text-[20px] font-bold"><Lightbulb size={18} aria-hidden className="text-[var(--m-accent)]" />Questions to answer from memory</h2>
      </section>
      <CheckYourself id="role-lesson-check" questions={lesson.check} />
      <nav aria-label="Next" className="flex flex-wrap items-center gap-3">
        {next && <Link href={next.href} className="inline-flex items-center gap-2 rounded-xl bg-[var(--m-ink)] px-5 py-2.5 text-[14.5px] font-bold text-white">Next: {next.title}<ArrowRight size={15} aria-hidden /></Link>}
        <Link href={proveHref} className="inline-flex items-center gap-2 rounded-xl border border-[var(--m-ink)] px-5 py-2.5 text-[14.5px] font-bold text-[var(--m-ink)]"><Swords size={15} aria-hidden />Prove it in Arena</Link>
      </nav>
    </article>
  );
}
