"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

const QUOTES = [
  {
    text: "Talk is cheap. Show me the code.",
    who: "Linus Torvalds",
    where: "Linux kernel mailing list, August 2000",
    href: "https://computerhistory.org/profile/linus-torvalds/",
    src: "Computer History Museum profile",
  },
  {
    text: "Trust, but verify.",
    who: "Russian proverb, доверяй, но проверяй",
    where: "Made famous in English by Ronald Reagan at the INF Treaty signing, December 1987",
    href: "https://en.wikipedia.org/wiki/Trust,_but_verify",
    src: "Wikipedia",
  },
] as const;

const FACTS = [
  {
    to: 39,
    dec: 0,
    pre: "",
    suf: "% of workers' core skills",
    rest: "are expected to change by 2030.",
    src: "World Economic Forum, Future of Jobs Report 2025",
    href: "https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/",
  },
  {
    to: 54.81,
    dec: 2,
    pre: "",
    suf: "% of Indian graduates",
    rest: "were assessed as employable in the India Skills Report 2025.",
    src: "India Skills Report 2025 (Wheebox with CII, AICTE and AIU), via Taggd",
    href: "https://taggd.in/industry-reports/isr/india-skills-report-2025/",
  },
  {
    to: 0,
    dec: 0,
    pre: "Almost two thirds",
    suf: "",
    rest: "of employers use skills-based hiring to identify candidates with potential.",
    src: "NACE Job Outlook 2025 Spring Update",
    href: "https://naceweb.org/job-market/trends-and-predictions/almost-two-thirds-of-employers-use-skills-based-hiring-to-help-identify-job-candidates",
  },
] as const;

function Count({ to, dec, run }: { to: number; dec: number; run: boolean }) {
  const [v, setV] = useState(to);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!run || reduce) return;
    const settle = window.setTimeout(() => setV(to), 2200);
    const c = animate(0, to, { duration: 1.6, ease: [0.22, 1, 0.36, 1], onUpdate: (x) => setV(x) });
    return () => {
      c.stop();
      window.clearTimeout(settle);
    };
  }, [run, reduce, to]);
  return <>{(reduce ? to : v).toFixed(dec)}</>;
}

export default function WorldSays() {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const facts = useRef<HTMLDivElement>(null);
  const seen = useInView(facts, { once: true, margin: "-15% 0px" });

  useEffect(() => {
    if (hold || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % QUOTES.length), 6500);
    return () => window.clearInterval(id);
  }, [hold]);

  const q = QUOTES[i];

  return (
    <section id="world" className="bg-cap-paper px-5 py-20 md:px-10 md:py-24">
      <div className="mx-auto max-w-[84rem]">
        <h2 data-rise className="max-w-4xl font-cap-display text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[1.04] tracking-[-0.03em]" style={{ textWrap: "balance" }}>
          The world is moving from claims to proof.
        </h2>

        <div
          className="relative mt-14 min-h-[16rem] md:min-h-[14rem]"
          onPointerEnter={() => setHold(true)}
          onPointerLeave={() => setHold(false)}
        >
          <AnimatePresence mode="wait">
            <motion.figure
              key={q.text}
              initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -16, filter: "blur(8px)" }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <blockquote className="font-cap-display text-[clamp(2.4rem,6.5vw,5.5rem)] font-bold leading-[1] tracking-[-0.035em]" style={{ textWrap: "balance" }}>
                <span aria-hidden="true" className="text-cap-orange">“</span>
                {q.text}
                <span aria-hidden="true" className="text-cap-orange">”</span>
              </blockquote>
              <figcaption className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-cap-muted">
                <span className="font-semibold text-cap-ink">{q.who}</span>
                <span>{q.where}</span>
                <a href={q.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-cap-indigo underline">
                  {q.src}
                  <ArrowUpRight size={15} />
                </a>
              </figcaption>
            </motion.figure>
          </AnimatePresence>
          <div className="mt-8 flex gap-2" role="group" aria-label="Choose a quote">
            {QUOTES.map((x, n) => (
              <button
                key={x.text}
                onClick={() => setI(n)}
                aria-label={`Show quote ${n + 1}`}
                aria-pressed={n === i}
                className="flex h-6 items-center"
              >
                <span className={`block h-1.5 rounded-full transition-all duration-300 ${n === i ? "w-10 bg-cap-ink" : "w-5 bg-cap-ink/25"}`} />
              </button>
            ))}
          </div>
        </div>

        <div ref={facts} className="mt-20 border-t border-cap-line!">
          {FACTS.map((f) => (
            <div key={f.src} data-rise className="grid gap-4 border-b border-cap-line! py-8 md:grid-cols-[1.7fr_1fr] md:items-end md:gap-12">
              <p className="font-cap-display text-[clamp(1.6rem,3.2vw,2.6rem)] font-medium leading-[1.12] tracking-[-0.025em]">
                {f.pre ? (
                  <span className="font-bold text-cap-orange">{f.pre}</span>
                ) : (
                  <span className="font-bold text-cap-orange">
                    <Count to={f.to} dec={f.dec} run={seen} />
                    {f.suf}
                  </span>
                )}{" "}
                {f.rest}
              </p>
              <a href={f.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-cap-muted underline md:justify-self-end">
                {f.src}
                <ArrowUpRight size={14} />
              </a>
            </div>
          ))}
        </div>
        <p data-rise className="mt-10 max-w-2xl text-lg leading-relaxed text-cap-ink/80">
          Capabilio is built for that shift: skills that are measured, recorded, and open to anyone who wants to check.
        </p>
      </div>
    </section>
  );
}
