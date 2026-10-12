"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { ClipboardCheck, FileCheck2, GitBranch, MapPinned, MessagesSquare, Mic, Rocket, Swords } from "lucide-react";
import Ridgeline, { type Palette } from "./Ridgeline";
import CareerMapMock from "./mocks/CareerMapMock";
import AssessMock from "./mocks/AssessMock";
import ArenaMock from "./mocks/ArenaMock";
import CodeDnaMock from "./mocks/CodeDnaMock";
import PassportMock from "./mocks/PassportMock";
import MentorMock from "./mocks/MentorMock";
import LaunchpadMock from "./mocks/LaunchpadMock";
import InterviewMock from "./mocks/InterviewMock";

const APPS = [
  { id: "map", icon: MapPinned, title: "Career map", Mock: CareerMapMock },
  { id: "assess", icon: ClipboardCheck, title: "Assessments", Mock: AssessMock },
  { id: "arena", icon: Swords, title: "Arena", Mock: ArenaMock },
  { id: "dna", icon: GitBranch, title: "Code DNA", Mock: CodeDnaMock },
  { id: "mentor", icon: MessagesSquare, title: "Mentor", Mock: MentorMock },
  { id: "launch", icon: Rocket, title: "Launchpad", Mock: LaunchpadMock },
  { id: "interview", icon: Mic, title: "Interview", Mock: InterviewMock },
  { id: "passport", icon: FileCheck2, title: "Skill Passport", Mock: PassportMock },
];

const WALLPAPER: Palette = { far: "#4a4fb8", mid: "#232a72", near: "#070916", crest: "#9aa4ff" };
const SLIDE_SECONDS = 9;

export default function Showcase() {
  const [i, setI] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [hold, setHold] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const seen = useInView(root, { margin: "-25% 0px -25% 0px" });
  const app = APPS[i];

  const go = (n: number) => {
    setI(n);
    setCycle((c) => c + 1);
  };

  return (
    <section id="platform" className="bg-cap-mist px-5 py-20 md:px-10 md:py-24">
      <div className="mx-auto max-w-[84rem]">
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-end">
          <h2 data-rise className="font-cap-display text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[1.04] tracking-[-0.03em]" style={{ textWrap: "balance" }}>
            Capabilio OS. Eight apps, one record of proof.
          </h2>
          <p className="max-w-lg text-lg leading-relaxed text-cap-muted lg:justify-self-end">
            Open any app from the dock. The samples behave the way the product does.
          </p>
        </div>

        <div
          ref={root}
          data-rise
          className={`relative isolate mt-14 overflow-hidden rounded-3xl bg-cap-night ${hold ? "cap-paused" : ""}`}
          onPointerEnter={() => setHold(true)}
          onPointerLeave={() => setHold(false)}
        >
          <Ridgeline className="absolute inset-x-0 bottom-0 -z-10 h-3/4" palette={WALLPAPER} layers={11} horizon={0.3} relief={0.3} />
          <div className="flex items-center justify-between px-5 py-3 text-[13px] text-white/80">
            <span className="font-semibold text-white">Capabilio OS</span>
            <span aria-live="polite">{app.title}</span>
            <span className="hidden font-mono text-xs sm:block">sample session</span>
          </div>
          <div className="h-[3px] bg-white/10">
            {seen && (
              <div
                key={`${i}-${cycle}`}
                className="cap-bar h-full bg-cap-apricot"
                style={{ ["--cap-dur" as string]: `${SLIDE_SECONDS}s` }}
                onAnimationEnd={() => go((i + 1) % APPS.length)}
              />
            )}
          </div>

          <div id="platform-panel" role="region" aria-label={app.title} className="mx-auto min-h-[36rem] max-w-[46rem] px-3 pb-36 pt-8 sm:px-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={app.id}
                initial={{ opacity: 0, scale: 0.96, y: 18, filter: "blur(8px)" }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.98, y: -8, filter: "blur(6px)" }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <app.Mock />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="absolute inset-x-0 bottom-5 flex justify-center px-3">
            <div role="tablist" aria-label="Capabilio apps" className="flex max-w-full gap-1.5 overflow-x-auto rounded-3xl border border-white/25! bg-white/15 p-2 backdrop-blur-xl">
              {APPS.map((a, n) => {
                const on = n === i;
                const Icon = a.icon;
                return (
                  <button
                    key={a.id}
                    role="tab"
                    aria-selected={on}
                    aria-label={a.title}
                    title={a.title}
                    onClick={() => go(n)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight") go((n + 1) % APPS.length);
                      if (e.key === "ArrowLeft") go((n + APPS.length - 1) % APPS.length);
                    }}
                    className={`group relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition-all duration-200 hover:-translate-y-1 sm:h-14 sm:w-14 ${
                      on ? "bg-white text-cap-ink" : "text-white hover:bg-white/20"
                    }`}
                  >
                    <Icon size={22} strokeWidth={1.75} />
                    {on && <span className="absolute -bottom-1.5 h-1 w-1 rounded-full bg-cap-apricot" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
