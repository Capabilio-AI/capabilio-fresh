"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Ridgeline, { type Palette, type Peak } from "./Ridgeline";
import { StateGlyph, STATE_LABEL, type NodeState } from "./StateGlyph";
import RotatingWord from "./RotatingWord";
import HeroPipeline from "./HeroPipeline";

type Skill = {
  id: string;
  name: string;
  state: NodeState;
  x: number;
  level: number;
  live?: boolean;
  evidence: string;
  next: string;
};

const SKILLS: Skill[] = [
  { id: "python", name: "Python", state: "met", x: 0.43, level: 0.78, evidence: "Assessment cleared at the role target. Two projects with tests on GitHub.", next: "Next: a Pandas project with a written readme." },
  { id: "sql", name: "SQL", state: "learning", x: 0.53, level: 0.6, live: true, evidence: "Three of five assessment items correct. One Arena ticket in progress.", next: "Next: finish the joins ticket." },
  { id: "eda", name: "Exploratory analysis", state: "met", x: 0.63, level: 0.7, evidence: "Notebook reviewed. Repository has a README and a passing CI run.", next: "Next: a second dataset to show range." },
  { id: "stats", name: "Statistics", state: "none", x: 0.73, level: 0.04, evidence: "No evidence yet. It stays flat on the map instead of showing a made-up zero.", next: "Next: take the 10-question diagnostic." },
  { id: "git", name: "Git & review", state: "check", x: 0.83, level: 0.5, live: true, evidence: "The self-score is high but no commits back it up, so it is flagged.", next: "Next: open one pull request that gets reviewed." },
  { id: "design", name: "System design", state: "locked", x: 0.93, level: 0.03, evidence: "Locked until SQL reaches its target.", next: "Unlocks after SQL." },
];

const PEAKS: Peak[] = SKILLS.map(({ id, x, level, live }) => ({ id, x, level, live }));
const NARROW_X = [0.12, 0.28, 0.44, 0.6, 0.76, 0.9];
const PEAKS_NARROW: Peak[] = PEAKS.map((p, i) => ({ ...p, x: NARROW_X[i] }));
const LEGEND = ["met", "learning", "none", "check", "locked"] as NodeState[];
const PALETTE: Palette = { far: "#f7c6c0", mid: "#6b5fd1", near: "#121634", crest: "#ffe3cc" };
const SKY =
  "radial-gradient(70% 45% at 66% 58%, rgba(255,87,1,0.30), transparent 70%), linear-gradient(180deg,#eceeff 0%,#f4e7f1 32%,#ffdcc4 54%,#ffb88a 72%)";
const CYCLE_MS = 3800;
const rise = (delay: number) => ({
  initial: { opacity: 0, y: 28, filter: "blur(10px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export default function Hero() {
  const [activeId, setActiveId] = useState(SKILLS[1].id);
  const [narrow, setNarrow] = useState(false);
  const paused = useRef(false);
  const activeRef = useRef<string | null>(activeId);
  const markers = useRef<Record<string, HTMLElement | null>>({});
  const place = useCallback((id: string, x: number, y: number) => {
    const el = markers.current[id];
    if (el) el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }, []);
  const active = useMemo(() => SKILLS.find((s) => s.id === activeId) ?? SKILLS[0], [activeId]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (paused.current) return;
      setActiveId((cur) => SKILLS[(SKILLS.findIndex((s) => s.id === cur) + 1) % SKILLS.length].id);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section
      className="relative isolate flex min-h-[max(100svh,820px)] flex-col overflow-hidden"
      style={{ background: SKY }}
      aria-labelledby="hero-title"
    >
      <div className="relative z-10 mx-auto w-full max-w-[84rem] px-5 pb-6 pt-24 md:px-10 md:pt-28">
        <h1
          id="hero-title"
          className="font-cap-display text-[clamp(2.6rem,6.4vw,5.25rem)] leading-[0.98] tracking-[-0.035em] text-cap-ink"
          style={{ textWrap: "balance" }}
        >
          <motion.span {...rise(0)} className="block font-light text-cap-ink/55">Resumes tell.</motion.span>
          <motion.span {...rise(0.12)} className="block font-bold">Proof wins.</motion.span>
        </h1>
        <motion.div {...rise(0.22)} className="mt-5">
          <RotatingWord />
        </motion.div>
        <motion.p {...rise(0.3)} className="mt-3 max-w-[34rem] text-lg leading-relaxed text-cap-ink/80">
          The career operating system for India and the rest of the world. Turn real work into evidence anyone can trust.
        </motion.p>
        <motion.div {...rise(0.4)} className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/get-started"
            className="group inline-flex items-center gap-2 rounded-full bg-cap-orange px-7 py-3.5 text-base font-semibold text-cap-ink transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Get started
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="#platform"
            className="inline-flex items-center rounded-full border border-cap-ink/30! px-7 py-3.5 text-base font-semibold text-cap-ink transition-colors hover:border-cap-ink! hover:bg-cap-ink/5"
          >
            See how it works
          </Link>
        </motion.div>
        <motion.ul {...rise(0.5)} className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] font-medium text-cap-ink/75">
          {["Live ELO ratings", "Verified by hidden tests", "Resume-free"].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <Check size={15} className="text-cap-ok" strokeWidth={2.5} />
              {t}
            </li>
          ))}
        </motion.ul>
        <div className="mt-8 max-w-[22.5rem] lg:hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="cap-win rounded-2xl bg-white p-5"
              aria-live="polite"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-cap-muted">
                <StateGlyph state={active.state} size={16} ink="#0c1020" />
                {STATE_LABEL[active.state]}
              </div>
              <div className="mt-2 font-cap-display text-3xl font-semibold tracking-tight text-cap-ink">{active.name}</div>
              <p className="mt-2 text-sm leading-relaxed text-cap-ink/80">{active.evidence}</p>
              <p className="mt-3 border-t border-cap-line! pt-3 text-sm font-medium text-cap-ink">{active.next}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <motion.div {...rise(0.35)} className="hidden lg:absolute lg:right-10 lg:top-24 lg:block">
          <HeroPipeline />
        </motion.div>
      </div>

      <div
        className="relative mt-auto h-72 shrink-0 lg:h-[min(27rem,38svh)]"
        onPointerEnter={() => (paused.current = true)}
        onPointerLeave={() => (paused.current = false)}
      >
        <span aria-hidden="true" className="cap-scan pointer-events-none absolute inset-y-0 left-0 z-[1] w-40" />
        <div className="absolute inset-x-0 bottom-14 z-10 hidden lg:block">
          <div className="mx-auto w-full max-w-[84rem] px-10">
            <div className="w-[19.5rem]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                  transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                  className="cap-win rounded-2xl bg-white p-4"
                  aria-live="polite"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-cap-muted">
                    <StateGlyph state={active.state} size={16} ink="#0c1020" />
                    {STATE_LABEL[active.state]}
                  </div>
                  <div className="mt-2 font-cap-display text-3xl font-semibold tracking-tight text-cap-ink">{active.name}</div>
                  <p className="mt-2 text-sm leading-relaxed text-cap-ink/80">{active.evidence}</p>
                  <p className="mt-3 border-t border-cap-line! pt-3 text-sm font-medium text-cap-ink">{active.next}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
        <Ridgeline
          className="absolute inset-0"
          palette={PALETTE}
          peaks={narrow ? PEAKS_NARROW : PEAKS}
          onPlace={place}
          activeRef={activeRef}
          horizon={0.5}
          relief={0.2}
          interactive
          parallax
        />
        {SKILLS.map((s) => {
          const isActive = s.id === activeId;
          return (
            <button
              key={s.id}
              type="button"
              ref={(el) => {
                markers.current[s.id] = el;
              }}
              onPointerEnter={() => setActiveId(s.id)}
              onFocus={() => setActiveId(s.id)}
              onClick={() => setActiveId(s.id)}
              aria-pressed={isActive}
              aria-label={`${s.name}: ${STATE_LABEL[s.state]}`}
              className="group absolute left-0 top-0 h-0 w-0"
            >
              <span className="absolute bottom-0 left-0 flex -translate-x-1/2 flex-col items-center">
                <span
                  className={`cap-flag flex items-center group-focus-visible:ring-2 group-focus-visible:ring-cap-orange gap-1.5 whitespace-nowrap rounded-full py-1 pl-1.5 pr-2.5 text-xs font-semibold transition-all duration-300 ${
                    isActive ? "scale-110 bg-cap-ink text-cap-paper" : "bg-white text-cap-ink"
                  }`}
                >
                  <StateGlyph state={s.state} size={15} ink={isActive ? "#ffb27a" : "#0c1020"} fill={isActive ? "#0c1020" : "#fff"} />
                  <span className={isActive ? "" : "max-sm:hidden"}>{s.name}</span>
                </span>
                <span className={`block w-px transition-all duration-300 ${isActive ? "h-5 bg-cap-apricot" : "h-3 bg-white/80"}`} />
                <span className={`block h-1.5 w-1.5 rounded-full ${isActive ? "bg-cap-apricot" : "bg-white"}`} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="absolute inset-x-5 bottom-4 z-10 hidden flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[11px] text-white/80 md:inset-x-10 lg:flex">
        <p className="font-mono tracking-wide">Sample profile · Data Analyst track · hover a peak</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {LEGEND.map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <StateGlyph state={k} size={13} ink="#fff" fill="#121634" />
              {STATE_LABEL[k]}
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-cap-night px-5 pb-5 pt-1 text-[11px] text-white/80 lg:hidden">
        <p className="font-mono tracking-wide">Sample profile · Data Analyst track · tap a peak</p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {LEGEND.map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <StateGlyph state={k} size={13} ink="#fff" fill="#121634" />
              {STATE_LABEL[k]}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
