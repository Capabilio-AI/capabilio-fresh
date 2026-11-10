"use client";

import { ArrowRight, BookOpen, Brain, Briefcase, Calculator, HeartHandshake, Mail, Mic, Timer, Users, type LucideIcon } from "lucide-react";
import { CATEGORIES, CATEGORY_LABEL, SIM_TESTS, testQuestionCount, type Category, type SimTestKey } from "@/lib/crt/categories";
import type { StudioView } from "@/lib/crt/studio-server";
import { MIN_EVIDENCE } from "@/lib/crt/studio";

const CARD = "rounded-2xl border border-app-border bg-white p-5";
const H2 = "font-lp-display text-[20px] font-bold text-app-charcoal";

const ICON: Record<Category, LucideIcon> = { aptitude: Calculator, reasoning: Brain, verbal: BookOpen, speaking: Mic, soft_skills: HeartHandshake, group_discussion: Users, interview: Briefcase, workplace: Mail };
// distinct but harmonious: the area's own accent, mixed into white at different strengths
const TINT: Record<Category, number> = { aptitude: 24, reasoning: 18, verbal: 13, speaking: 28, soft_skills: 10, group_discussion: 21, interview: 15, workplace: 8 };
const tint = (c: Category, extra = 0) => ({ background: `color-mix(in srgb, var(--m-accent) ${Math.min(95, TINT[c] + extra)}%, white)` });

function Shown({ view, category }: { view: StudioView; category: Category }) {
  const c = view.areas.find((a) => a.key === category)?.competency;
  if (!c) return null;
  return (
    <p className="font-lp-body text-[12px] text-app-muted">
      Shown so far: {c.pct !== null ? <strong className="text-app-charcoal">{c.pct}%</strong> : <span>not enough evidence yet ({Math.min(c.evidence, MIN_EVIDENCE)} of {MIN_EVIDENCE} answers)</span>}
    </p>
  );
}

/** The placement simulator: a full mock in sections, and one timed test per section. English speaking is practised by voice. */
export function Simulator({ view, onStart, onSpeaking }: { view: StudioView; onStart: (t: SimTestKey) => void; onSpeaking: () => void }) {
  const mock = SIM_TESTS[0];
  const total = testQuestionCount(mock);
  const sections = SIM_TESTS.slice(1);
  return (
    <section aria-label="Placement simulator">
      <h2 className={`${H2} mb-1`}>Placement simulator</h2>
      <p className="mb-4 max-w-[70ch] font-lp-body text-[13.5px] text-app-muted">Timed tests in the exam format companies use. <strong className="text-app-charcoal">One minute per question</strong>, no hints, answers and reasoning at the end. Every answer adds to your readiness below.</p>

      <article className="overflow-hidden rounded-2xl bg-[var(--m-ink)] p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0 max-w-[58ch]">
            <p className="font-lp-body text-[11.5px] font-bold uppercase tracking-[0.14em] text-white/60">Start here</p>
            <h3 className="mt-1 font-lp-display text-[26px] font-bold leading-tight">{mock.label}</h3>
            <p className="mt-1.5 font-lp-body text-[14px] leading-relaxed text-white/75">{mock.blurb}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 font-lp-body text-[13px] font-semibold text-white/90"><Timer size={14} aria-hidden /> {total} questions · {total} minutes</p>
          </div>
          <button type="button" onClick={() => onStart(mock.key)} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-3 font-lp-body text-[14px] font-semibold text-[var(--m-ink)] hover:bg-white/90">Start the mock <ArrowRight size={16} aria-hidden /></button>
        </div>
        <div className="mt-5" role="img" aria-label={`Sections of the mock: ${mock.parts.map((p) => `${CATEGORY_LABEL[p.category]} ${p.count} questions`).join(", ")}`}>
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
            {mock.parts.map((p, i) => <span key={p.category} className="h-full rounded-sm bg-white" style={{ flexGrow: p.count, opacity: 0.95 - i * 0.12 }} />)}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
            {mock.parts.map((p) => <li key={p.category} className="font-lp-body text-[12px] text-white/70">{CATEGORY_LABEL[p.category]} <span className="tabular-nums text-white/90">{p.count}</span></li>)}
          </ul>
        </div>
      </article>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sections.map((t) => {
          const category = t.parts[0].category;
          const Icon = ICON[category];
          const n = testQuestionCount(t);
          return (
            <article key={t.key} className="group flex flex-col gap-3 rounded-2xl border border-app-border bg-white p-4 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--m-soft)] hover:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--m-ink)]" style={tint(category)}><Icon size={20} aria-hidden /></span>
                <span className="text-right font-lp-body text-[12px] leading-tight text-app-muted"><strong className="block font-lp-display text-[22px] leading-none text-app-charcoal">{n}</strong>min</span>
              </div>
              <div>
                <h3 className="font-lp-display text-[17px] font-bold leading-snug text-app-charcoal">{t.label}</h3>
                <p className="mt-0.5 font-lp-body text-[12.5px] leading-relaxed text-app-muted">{t.blurb}</p>
              </div>
              <Shown view={view} category={category} />
              <button type="button" onClick={() => onStart(t.key)} className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--m-ink)] px-3.5 py-2.5 font-lp-body text-[13px] font-semibold text-white">Take the {n}-minute test <ArrowRight size={14} aria-hidden /></button>
            </article>
          );
        })}
        <article className="flex flex-col gap-3 rounded-2xl border border-dashed border-[var(--m-soft)] bg-[var(--m-accent-soft)] p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[var(--m-ink)]"><Mic size={20} aria-hidden /></span>
            <span className="rounded-full bg-white px-2.5 py-1 font-lp-body text-[11px] font-bold text-[var(--m-ink)]">Voice</span>
          </div>
          <div>
            <h3 className="font-lp-display text-[17px] font-bold leading-snug text-[var(--m-ink)]">English speaking</h3>
            <p className="mt-0.5 font-lp-body text-[12.5px] leading-relaxed text-[var(--m-muted)]">Answer interview and workplace prompts aloud and get feedback on grammar, vocabulary, clarity, flow, structure and relevance. Accents are never marked.</p>
          </div>
          <Shown view={view} category="speaking" />
          <button type="button" onClick={onSpeaking} className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--m-ink)] px-3.5 py-2.5 font-lp-body text-[13px] font-semibold text-white"><Mic size={14} aria-hidden /> Open Speaking Studio</button>
        </article>
      </div>
    </section>
  );
}

const SHORT: Record<Category, string> = { aptitude: "Aptitude", reasoning: "Reasoning", verbal: "Verbal", speaking: "Speaking", soft_skills: "Soft skills", group_discussion: "GD", interview: "Interview", workplace: "Workplace" };

/** What the student has shown across eight areas, from answers and assessments only. */
export function ReadinessRadar({ view }: { view: StudioView }) {
  const size = 320;
  const c = size / 2;
  const R = 108;
  const n = CATEGORIES.length;
  const at = (i: number, frac: number) => {
    const a = (-90 + (i * 360) / n) * (Math.PI / 180);
    return [c + R * frac * Math.cos(a), c + R * frac * Math.sin(a)] as const;
  };
  const byKey = new Map(view.areas.map((p) => [p.key, p]));
  const points = CATEGORIES.map((k, i) => at(i, (byKey.get(k)!.competency.pct ?? 0) / 100));
  const proven = view.areas.filter((p) => p.competency.pct !== null);
  const weakest = [...proven].sort((a, b) => a.competency.pct! - b.competency.pct!)[0];
  return (
    <section className={CARD} aria-label="Placement readiness">
      <h2 className={H2}>Placement readiness</h2>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">What you have demonstrated through answers and assessments across eight areas. Hollow points mean there is not enough evidence yet.</p>
      <div className="mt-3 grid items-center gap-4 md:grid-cols-[minmax(0,340px)_1fr]">
        <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Readiness across ${n} areas: ${view.areas.map((p) => `${SHORT[p.key]} ${p.competency.pct ?? "no evidence"}`).join(", ")}`} className="mx-auto w-full max-w-[340px]">
          {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={CATEGORIES.map((_, i) => at(i, f).join(",")).join(" ")} fill="none" stroke="var(--m-rule)" strokeWidth="1" />)}
          {CATEGORIES.map((_, i) => <line key={i} x1={c} y1={c} x2={at(i, 1)[0]} y2={at(i, 1)[1]} stroke="var(--m-rule)" strokeWidth="1" />)}
          {proven.length > 0 && <polygon points={points.map((p) => p.join(",")).join(" ")} fill="color-mix(in srgb, var(--m-accent) 22%, transparent)" stroke="var(--m-accent)" strokeWidth="2" strokeLinejoin="round" />}
          {CATEGORIES.map((k, i) => {
            const has = byKey.get(k)!.competency.pct !== null;
            const [x, y] = at(i, (byKey.get(k)!.competency.pct ?? 0) / 100);
            const [lx, ly] = at(i, 1.2);
            return (
              <g key={k}>
                <circle cx={x} cy={y} r={has ? 3.5 : 2.5} fill={has ? "var(--m-accent)" : "white"} stroke="var(--m-accent)" strokeWidth="1.5" />
                <text x={lx} y={ly} textAnchor={lx < c - 4 ? "end" : lx > c + 4 ? "start" : "middle"} dominantBaseline="middle" className="fill-[var(--m-muted)]" style={{ fontSize: 11, fontWeight: 600 }}>{SHORT[k]}</text>
              </g>
            );
          })}
        </svg>
        <ul className="flex flex-col divide-y divide-app-border">
          {view.areas.map((p) => (
            <li key={p.key} className="py-2.5 font-lp-body text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-semibold text-app-charcoal">{CATEGORY_LABEL[p.key]}</span>
                <strong className="shrink-0 text-app-charcoal">{p.competency.pct !== null ? `${p.competency.pct}%` : "–"}</strong>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--m-ground)]" role="meter" aria-label={`${CATEGORY_LABEL[p.key]} readiness`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.competency.pct ?? 0}>
                <div className={`h-full rounded-full ${p.competency.pct !== null && p.competency.pct < 50 ? "bg-app-warning" : "bg-[var(--m-accent)]"}`} style={{ width: `${p.competency.pct ?? 0}%` }} />
              </div>
              <p className="mt-1 text-[11.5px] text-app-muted">{p.competency.pct !== null ? `Based on ${p.competency.evidence} ${p.key === "speaking" ? "attempts" : "answers"}${p.competency.assessmentPct !== null ? " and your assessment" : ""}` : p.key === "speaking" ? "Two speaking attempts give a score" : `${Math.min(p.competency.evidence, MIN_EVIDENCE)} of ${MIN_EVIDENCE} answers needed for a score`}</p>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3 font-lp-body text-[12.5px] text-app-muted">{weakest ? <>Weakest area so far: <strong className="text-app-charcoal">{CATEGORY_LABEL[weakest.key]}</strong> at {weakest.competency.pct}%. Take that section&apos;s test next.</> : "Take a section test to start building your picture."}</p>
    </section>
  );
}
