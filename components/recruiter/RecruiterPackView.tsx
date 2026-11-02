"use client";

import { useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { EvidenceModal } from "@/components/portfolio/EvidenceModal";
import type { RecruiterPack } from "@/lib/recruiter/shares";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The page a recruiter reads. It answers one question: can this person do the work of a junior in the role? So it leads with readiness for the target role,
 * then the skill levels and how they were reached, then the actual work, each piece openable down to the student's submission and the graded checks.
 * No ranks, points, badges or streaks: those say how much someone used a product, not what they can do.
 */
export function RecruiterPackView({ pack, token }: { pack: RecruiterPack; token: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const c = pack.candidate;
  const r = pack.readiness;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header>
        <p className="font-lp-body text-[13px] text-[var(--m-muted)]">Shared with you by the candidate as “{pack.share.label}”. Link works until {fmtDate(pack.share.expiresAt)}.</p>
        <h1 className="mt-2 font-lp-display text-[30px] font-bold leading-tight text-[var(--m-ink)]">{c.name ?? "Candidate"}</h1>
        <p className="mt-1 font-lp-body text-[15px] text-[var(--m-ink)]">{[c.education, c.college].filter(Boolean).join(" · ") || "Education not provided"}</p>
        {c.targetRole && <p className="mt-0.5 font-lp-body text-[14px] text-[var(--m-muted)]">Target role: {c.targetRole}</p>}
        {c.contact && (
          <p className="mt-2 font-lp-body text-[14px] text-[var(--m-ink)]">
            <a className="underline" href={`mailto:${c.contact.email}`}>{c.contact.email}</a>
            {c.contact.phone ? ` · ${c.contact.phone}` : ""}
          </p>
        )}
      </header>

      {r && (
        <section className="mt-8" aria-labelledby="ready-h">
          <h2 id="ready-h" className="font-lp-body text-[13px] font-bold uppercase tracking-wide text-[var(--m-muted)]">Readiness for {r.careerName}</h2>
          <p className="mt-1 font-lp-display text-[24px] font-bold text-[var(--m-ink)]">{r.label}</p>
          <p className="mt-1 font-lp-body text-[14px] text-[var(--m-ink)]">{r.why}</p>
          {r.gaps.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1">
              {r.gaps.slice(0, 5).map((g) => (
                <li key={g.skillName} className="font-lp-body text-[13px] text-[var(--m-ink)]">
                  <span className="font-bold">Gap: {g.skillName}</span> ({g.importance.toLowerCase()}): Level {g.have} of the Level {g.need} a junior needs
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {pack.skills.length > 0 && (
        <section className="mt-8" aria-labelledby="skills-h">
          <h2 id="skills-h" className="font-lp-body text-[13px] font-bold uppercase tracking-wide text-[var(--m-muted)]">Skill levels from graded work</h2>
          <p className="mt-1 font-lp-body text-[13px] text-[var(--m-muted)]">Levels are computed from all {pack.gradedTotal} graded task{pack.gradedTotal === 1 ? "" : "s"} the candidate has passed. This share includes {pack.samples.length} of them for you to open.</p>
          <ul className="mt-3 flex flex-col divide-y divide-[var(--m-rule)]">
            {pack.skills.map((s) => (
              <li key={`${s.roleKey}:${s.skillId}`} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-lp-body text-[15px] font-bold text-[var(--m-ink)]">{s.skillName}</p>
                  <p className="shrink-0 font-lp-body text-[13px] font-bold text-[var(--m-accent-ink)]">Level {s.proficiency.level} of 5 · {s.proficiency.name}</p>
                </div>
                <p className="mt-1 font-lp-body text-[12.5px] text-[var(--m-muted)]">{s.proficiency.passes} graded task{s.proficiency.passes === 1 ? "" : "s"}{s.proficiency.reached.length ? `. Basis: ${s.proficiency.reached.map((x) => x.label).join("; ")}.` : "."}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8" aria-labelledby="work-h">
        <h2 id="work-h" className="font-lp-body text-[13px] font-bold uppercase tracking-wide text-[var(--m-muted)]">Work samples</h2>
        <p className="mt-1 font-lp-body text-[13px] text-[var(--m-muted)]">Each was graded automatically against an answer key the candidate never saw, on data generated for them. Open one to read the brief, their submission and every check.</p>
        <ul className="mt-3 flex flex-col divide-y divide-[var(--m-rule)]">
          {pack.samples.map((s) => (
            <li key={s.attemptId} className="flex items-start justify-between gap-4 py-3.5">
              <div className="min-w-0">
                <p className="font-lp-body text-[15px] font-bold text-[var(--m-ink)]">{s.title}</p>
                <p className="mt-0.5 font-lp-body text-[13px] text-[var(--m-muted)]">
                  {[s.areaName, s.toolLabel, cap(s.difficulty), `${s.submissions} submission${s.submissions === 1 ? "" : "s"}`, s.explained ? `Explained in interview${s.explanationScore !== null ? ` ${s.explanationScore}/100` : ""}` : "Not interviewed", fmtDate(s.completedAt)].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-0.5 flex items-center gap-1 font-lp-mono text-[11.5px] text-[var(--m-muted)]">
                  {s.intact ? <ShieldCheck size={13} aria-hidden /> : <ShieldAlert size={13} aria-hidden className="text-app-rose" />}
                  {s.intact ? `Sealed record ${s.fingerprint.slice(0, 12)}…, unaltered` : "Record does not match its seal"}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(s.attemptId)} className="shrink-0 rounded-md px-2 py-1 font-lp-body text-[13px] font-bold text-[var(--m-accent-ink)] hover:bg-[var(--m-ground)]">Open evidence</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-xl border border-[var(--m-rule)] p-4" aria-labelledby="limits-h">
        <h2 id="limits-h" className="font-lp-body text-[13px] font-bold text-[var(--m-ink)]">What this does and does not show</h2>
        <ul className="mt-1.5 list-disc pl-5 font-lp-body text-[13px] text-[var(--m-muted)]">
          <li>The tools are simulations of professional software. This is evidence of skill on realistic tasks, not field experience.</li>
          <li>Work is done in the candidate&apos;s own browser. We verify that the answer is right and that they could explain it, not who typed it.</li>
          <li>Readiness is measured against a defined list of skills for the role. It is not a prediction of job performance and not a hiring recommendation.</li>
        </ul>
      </section>

      {open && <EvidenceModal fetchUrl={`/api/r/${token}/evidence/${open}`} onClose={() => setOpen(null)} />}
    </div>
  );
}
