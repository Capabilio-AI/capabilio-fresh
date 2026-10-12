"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { ONBOARDING_PATHS } from "@/lib/onboarding/paths";

const LOOK: Record<string, { tone: string; points: string[] }> = {
  student: {
    tone: "bg-cap-indigo text-white",
    points: [
      "A diagnostic first, then a career map with your next step",
      "Arena tickets and assessments move one rating per role",
      "GitHub Code DNA and a Skill Passport anyone can verify",
    ],
  },
  professional: {
    tone: "bg-cap-night text-cap-paper",
    points: ["The same evidence model, for people already working", "Measured capability, not a self-written summary"],
  },
  executive: {
    tone: "bg-cap-peach text-cap-ink",
    points: ["For founders, CEOs, directors and other leaders", "Leadership and professional proof, backed by evidence"],
  },
  organisation: {
    tone: "bg-cap-apricot text-cap-ink",
    points: [
      "Colleges, universities and companies in one workspace",
      "Cohort views, roles, and a college-owned academic calendar",
      "Team chat beside access and curriculum",
    ],
  },
};

const RIDGES = [
  ["M0 160V90l60-40 70 36 80-70 90 64 100-44v124z", "M0 160V120l80-30 90 26 90-40 140 34v50z"],
  ["M0 160V70l70 40 60-60 80 50 70-46 120 40v66z", "M0 160V124l100-20 80 30 80-34 140 20v40z"],
  ["M0 160V100l50-50 60 30 90-60 80 60 120-30v110z", "M0 160V128l90-24 100 20 70-30 140 30v36z"],
  ["M0 160V84l80 20 60-54 70 44 90-50 100 40v72z", "M0 160V132l70-26 110 24 90-28 130 22v32z"],
] as const;

export default function Paths() {
  const [i, setI] = useState(0);

  return (
    <section id="paths" className="bg-cap-paper px-5 py-20 md:px-10 md:py-24">
      <div className="mx-auto max-w-[84rem]">
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-end">
          <h2 data-rise className="font-cap-display text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[1.04] tracking-[-0.03em]" style={{ textWrap: "balance" }}>
            Four paths. One career operating system.
          </h2>
          <p className="max-w-lg text-lg leading-relaxed text-cap-muted lg:justify-self-end">
            Starting out, working, leading, or running an institution: the rule is the same everywhere. Proof beats claims.
          </p>
        </div>

        <div data-rise className="mt-14 flex flex-col gap-3 lg:h-[30rem] lg:flex-row">
          {ONBOARDING_PATHS.map((p, n) => {
            const on = n === i;
            const look = LOOK[p.id];
            return (
              <article
                key={p.id}
                onPointerEnter={(e) => e.pointerType === "mouse" && setI(n)}
                className={`relative overflow-hidden rounded-3xl transition-[flex-grow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:basis-0 ${look.tone} ${
                  on ? "lg:grow-[3.2]" : "lg:grow-[1]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setI(n)}
                  onFocus={() => setI(n)}
                  aria-expanded={on}
                  className="relative z-10 flex w-full flex-col items-start gap-2 p-6 text-left lg:absolute lg:inset-x-0 lg:top-0"
                >
                  <span className="font-cap-display text-2xl font-semibold leading-tight tracking-tight">{p.title}</span>
                  {!on && <span className="hidden text-sm leading-snug opacity-80 lg:block">{p.tagline}</span>}
                  <ChevronDown aria-hidden="true" size={20} className={`absolute right-5 top-7 transition-transform lg:hidden ${on ? "rotate-180" : ""}`} />
                  {p.comingSoon && (
                    <span className="shrink-0 rounded-full border border-current! px-2.5 py-0.5 text-[11px] font-semibold opacity-80">Coming soon</span>
                  )}
                </button>

                <svg aria-hidden="true" viewBox="0 0 400 160" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-2/5 w-full opacity-[0.1] lg:block">
                  <path d={RIDGES[n % RIDGES.length][0]} fill="currentColor" />
                  <path d={RIDGES[n % RIDGES.length][1]} fill="currentColor" />
                </svg>
                <div
                  className={`relative px-6 pb-7 transition-opacity duration-300 lg:absolute lg:bottom-0 lg:left-0 lg:w-[26rem] lg:pb-8 ${
                    on ? "block opacity-100 lg:delay-150" : "hidden opacity-0 lg:block"
                  }`}
                  aria-hidden={!on}
                >
                  <p className="text-lg font-medium leading-snug">{p.tagline}</p>
                  {p.subtext && <p className="mt-1 text-sm opacity-80">{p.subtext}</p>}
                  <ul className="mt-5 grid gap-2.5 text-[15px] leading-snug">
                    {look.points.map((t) => (
                      <li key={t} className="flex gap-3">
                        <span className="mt-2.5 h-px w-4 shrink-0 bg-current opacity-60" />
                        {t}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={p.href}
                    tabIndex={on ? 0 : -1}
                    className="group mt-6 inline-flex items-center gap-2 rounded-full bg-cap-ink px-5 py-2.5 text-sm font-semibold text-cap-paper"
                  >
                    {p.comingSoon ? "See what is coming" : "Get started"}
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
