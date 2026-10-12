"use client";

import { useRef, type PointerEvent } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Briefcase, Building2, Crown, GraduationCap, type LucideIcon } from "lucide-react";
import { ONBOARDING_PATHS, type OnboardingPath } from "@/lib/onboarding/paths";

type Look = { tone: string; Icon: LucideIcon; points: string[]; cta: string; ridge: [string, string] };

const LOOK: Record<OnboardingPath["id"], Look> = {
  student: {
    tone: "bg-cap-indigo text-white",
    Icon: GraduationCap,
    points: ["A diagnostic, then a career map with your next step", "Arena tickets and assessments move one rating per role", "A Skill Passport anyone can verify"],
    cta: "Choose below",
    ridge: ["M0 160V90l60-40 70 36 80-70 90 64 100-44v124z", "M0 160V120l80-30 90 26 90-40 140 34v50z"],
  },
  professional: {
    tone: "bg-cap-night text-cap-paper",
    Icon: Briefcase,
    points: ["The same evidence model, for people already working", "Measured capability, not a self-written summary"],
    cta: "See what is coming",
    ridge: ["M0 160V70l70 40 60-60 80 50 70-46 120 40v66z", "M0 160V124l100-20 80 30 80-34 140 20v40z"],
  },
  executive: {
    tone: "bg-cap-peach text-cap-ink",
    Icon: Crown,
    points: ["For founders, CEOs, directors and other leaders", "Leadership proof, backed by evidence"],
    cta: "See what is coming",
    ridge: ["M0 160V100l50-50 60 30 90-60 80 60 120-30v110z", "M0 160V128l90-24 100 20 70-30 140 30v36z"],
  },
  organisation: {
    tone: "bg-cap-apricot text-cap-ink",
    Icon: Building2,
    points: ["Colleges, universities and companies in one workspace", "Cohort views, roles and a college-owned calendar", "Applications are approved by our team"],
    cta: "Register your organisation",
    ridge: ["M0 160V84l80 20 60-54 70 44 90-50 100 40v72z", "M0 160V132l70-26 110 24 90-28 130 22v32z"],
  },
};

const STUDENT_CHOICES = [
  { as: "student", label: "I'm a student", hint: "Currently studying" },
  { as: "graduate", label: "I recently graduated", hint: "Finished in the last few years" },
] as const;

function PathCard({ path, index }: { path: OnboardingPath; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const look = LOOK[path.id];
  const Icon = look.Icon;

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    el.style.transform = `perspective(900px) rotateX(${((0.5 - y) * 7).toFixed(1)}deg) rotateY(${((x - 0.5) * 9).toFixed(1)}deg) translateY(-6px)`;
  };

  return (
    <motion.li
      initial={{ opacity: 0, y: 32, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.7, delay: 0.15 + index * 0.09, ease: [0.22, 1, 0.36, 1] }}
      className="list-none"
    >
      <div
        ref={ref}
        data-path={path.id}
        onPointerMove={move}
        onPointerLeave={() => ref.current && (ref.current.style.transform = "")}
        className={`group cap-win relative flex h-full min-h-[25rem] flex-col overflow-hidden rounded-3xl p-7 transition-transform duration-200 ease-out ${look.tone}`}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: "radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.3), transparent 55%)" }}
        />
        <svg aria-hidden="true" viewBox="0 0 400 160" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 w-full opacity-[0.12] transition-transform duration-500 group-hover:scale-y-110">
          <path d={look.ridge[0]} fill="currentColor" />
          <path d={look.ridge[1]} fill="currentColor" />
        </svg>

        <div className="relative flex items-start justify-between gap-3">
          <span className="cap-float grid h-14 w-14 place-items-center rounded-2xl bg-white/90 text-cap-ink shadow-[0_8px_18px_-8px_rgba(12,16,32,0.5)]">
            <Icon size={26} strokeWidth={1.6} />
          </span>
          {path.comingSoon && <span className="rounded-full border border-current! px-3 py-1 text-xs font-semibold opacity-80">Coming soon</span>}
        </div>

        <h2 className="relative mt-8 font-cap-display text-[1.75rem] font-semibold leading-tight tracking-tight">{path.title}</h2>
        <p className="relative mt-2 text-[15px] font-medium leading-snug">{path.tagline}</p>
        {path.subtext && <p className="relative mt-1 text-sm opacity-80">{path.subtext}</p>}

        <ul className="relative mt-5 grid gap-2 text-sm leading-snug opacity-100 transition-all duration-300 lg:translate-y-2 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:group-focus-visible:translate-y-0 lg:group-focus-visible:opacity-100">
          {look.points.map((t) => (
            <li key={t} className="flex gap-2.5">
              <span className="mt-2 h-px w-3.5 shrink-0 bg-current opacity-60" />
              {t}
            </li>
          ))}
        </ul>

        {path.id === "student" ? (
          <span className="relative z-20 mt-auto grid gap-2 pt-8">
            {STUDENT_CHOICES.map((c, n) => (
              <Link
                key={c.as}
                href={`${path.href}?as=${c.as}`}
                className={`group/choice flex items-center justify-between gap-3 rounded-full px-5 py-3 text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5 ${
                  n === 0 ? "bg-cap-ink text-cap-paper" : "border border-white/70! bg-white/15 text-white hover:bg-white/25"
                }`}
              >
                <span>
                  {c.label}
                  <span className="block text-xs font-normal opacity-75">{c.hint}</span>
                </span>
                <ArrowUpRight size={18} className="shrink-0 transition-transform duration-300 group-hover/choice:-translate-y-0.5 group-hover/choice:translate-x-0.5" />
              </Link>
            ))}
          </span>
        ) : (
          <>
            <Link href={path.href} aria-label={`${path.title}: ${look.cta}`} className="absolute inset-0 z-10 rounded-3xl" />
            <span className="relative mt-auto flex items-center justify-between pt-8 text-sm font-semibold">
              {look.cta}
              <span className="grid h-10 w-10 place-items-center rounded-full bg-cap-ink text-cap-paper transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:rotate-12">
                <ArrowUpRight size={18} />
              </span>
            </span>
          </>
        )}
      </div>
    </motion.li>
  );
}

export default function PathPicker() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Choose how you will use Capabilio">
      {ONBOARDING_PATHS.map((p, i) => (
        <PathCard key={p.id} path={p} index={i} />
      ))}
    </ul>
  );
}
