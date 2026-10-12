"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Item = { id: string; label: string; tier: "path" | "app"; body: string; soon?: boolean };

const NODES: Item[] = [
  { id: "student", label: "Student", tier: "path", body: "Students and recent graduates build an evidence-backed career profile: a diagnostic, a career map, and a Skill Passport." },
  { id: "professional", label: "Professional", tier: "path", soon: true, body: "Working professionals turn real work into verified, evidence-backed capability. Coming soon." },
  { id: "executive", label: "Executive", tier: "path", soon: true, body: "Founders, CEOs, directors and other leaders build an evidence-backed leadership and professional profile. Coming soon." },
  { id: "org", label: "Organisation", tier: "path", body: "Colleges, universities and companies connect, assess, develop and understand their people, with roles and a shared calendar." },
  { id: "map", label: "Career map", tier: "app", body: "A tree per career where every topic shows its measured state, what blocks it, and the next stop." },
  { id: "assess", label: "Assessments", tier: "app", body: "A general layer and a career layer, with one rating per role. Answer keys stay on the server." },
  { id: "arena", label: "Arena", tier: "app", body: "Real tickets checked by hidden tests. The rating moves +4 for correct and −2 for incorrect, never below zero." },
  { id: "dna", label: "Code DNA", tier: "app", body: "A fingerprint of public GitHub work built only from what the scan found, with its limits stated." },
  { id: "mentor", label: "Mentor", tier: "app", body: "An AI mentor that knows your career direction and your skill gaps." },
  { id: "launch", label: "Launchpad", tier: "app", body: "Opportunities matched to your measured profile." },
  { id: "interview", label: "Interview", tier: "app", body: "Interview preparation tied to the skills you are building." },
  { id: "pulse", label: "Pulse", tier: "app", body: "An activity feed for what you and others are building and shipping." },
];

const C = 380;
const R = { path: 165, app: 292 };
const SPEED = { path: 0.045, app: -0.028 };

const shown = (n: Item) => (n.soon ? `${n.label} · soon` : n.label);

const layout = (n: Item, t: number) => {
  const group = NODES.filter((x) => x.tier === n.tier);
  const k = group.indexOf(n);
  const base = n.tier === "path" ? Math.PI / 4 : Math.PI / 8;
  const a = base + (k * 2 * Math.PI) / group.length + t * SPEED[n.tier];
  return [C + Math.cos(a) * R[n.tier], C + Math.sin(a) * R[n.tier]] as const;
};

export default function Ecosystem() {
  const [active, setActive] = useState("map");
  const hold = useRef(false);
  const nodeEls = useRef<(SVGGElement | null)[]>([]);
  const lineEls = useRef<(SVGLineElement | null)[]>([]);
  const dotEls = useRef<(SVGCircleElement | null)[]>([]);
  const svg = useRef<SVGSVGElement>(null);
  const cur = useMemo(() => NODES.find((n) => n.id === active) ?? NODES[0], [active]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = svg.current;
    if (!el) return;
    let raf = 0;
    let running = false;
    let t0 = 0;
    const frame = (now: number) => {
      if (!running) return;
      if (!t0) t0 = now;
      const t = (now - t0) / 1000;
      NODES.forEach((n, i) => {
        const [x, y] = layout(n, t);
        nodeEls.current[i]?.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        const ln = lineEls.current[i];
        if (ln) {
          ln.setAttribute("x2", x.toFixed(1));
          ln.setAttribute("y2", y.toFixed(1));
        }
        const dot = dotEls.current[i];
        if (dot) {
          const p = (t * 0.28 + i * 0.137) % 1;
          dot.setAttribute("cx", (C + (x - C) * p).toFixed(1));
          dot.setAttribute("cy", (C + (y - C) * p).toFixed(1));
        }
      });
      raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !reduced && !running) {
        running = true;
        raf = requestAnimationFrame(frame);
      } else if (!e.isIntersecting) {
        running = false;
        cancelAnimationFrame(raf);
      }
    });
    io.observe(el);
    const cycle = window.setInterval(() => {
      if (hold.current || reduced) return;
      setActive((a) => NODES[(NODES.findIndex((n) => n.id === a) + 1) % NODES.length].id);
    }, 3200);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      window.clearInterval(cycle);
    };
  }, []);

  return (
    <section id="ecosystem" className="cap-night relative isolate overflow-hidden bg-cap-night px-5 py-20 text-cap-paper md:px-10 md:py-24">
      <div className="mx-auto grid max-w-[84rem] items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <h2 data-rise className="font-cap-display text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[1.04] tracking-[-0.03em]" style={{ textWrap: "balance" }}>
            One ecosystem. Every path. Every proof.
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/72">
            Four paths for four kinds of people, and eight apps that all write to the same Skill Passport. Hover a node to see what it does.
          </p>
          <div className="mt-8 min-h-[9rem] rounded-2xl border border-white/15! bg-white/[0.06] p-6" aria-live="polite">
            <div className="font-cap-display text-3xl font-semibold tracking-tight">{cur.label}</div>
            <p className="mt-2 text-[15px] leading-relaxed text-white/75">{cur.body}</p>
          </div>
        </div>

        <div onPointerEnter={() => (hold.current = true)} onPointerLeave={() => (hold.current = false)}>
          <svg ref={svg} viewBox="0 0 760 760" className="mx-auto hidden w-full max-w-[44rem] md:block" role="group" aria-label="Capabilio ecosystem map">
            <defs>
              <radialGradient id="eco-core" cx="50%" cy="45%" r="60%">
                <stop offset="0%" stopColor="#ffb27a" />
                <stop offset="100%" stopColor="#ff5701" />
              </radialGradient>
            </defs>
            <circle cx={C} cy={C} r={R.path} fill="none" stroke="rgba(255,255,255,.14)" strokeDasharray="3 7" />
            <circle cx={C} cy={C} r={R.app} fill="none" stroke="rgba(255,255,255,.1)" strokeDasharray="3 9" />
            {NODES.map((n, i) => {
              const [x, y] = layout(n, 0);
              return (
                <line
                  key={`l-${n.id}`}
                  ref={(el) => {
                    lineEls.current[i] = el;
                  }}
                  x1={C}
                  y1={C}
                  x2={x.toFixed(1)}
                  y2={y.toFixed(1)}
                  stroke={n.id === active ? "#ffb27a" : "rgba(255,255,255,.16)"}
                  strokeWidth={n.id === active ? 1.6 : 1}
                />
              );
            })}
            {NODES.map((n, i) => (
              <circle
                key={`d-${n.id}`}
                ref={(el) => {
                  dotEls.current[i] = el;
                }}
                r="2.6"
                fill="#ffb27a"
                cx={C}
                cy={C}
              />
            ))}
            <circle cx={C} cy={C} r="74" fill="url(#eco-core)" />
            <text x={C} y={C - 4} textAnchor="middle" fontSize="19" fontWeight="700" fill="#0c1020">Skill</text>
            <text x={C} y={C + 18} textAnchor="middle" fontSize="19" fontWeight="700" fill="#0c1020">Passport</text>
            {NODES.map((n, i) => {
              const [x, y] = layout(n, 0);
              const w = shown(n).length * 7.6 + 30;
              const on = n.id === active;
              const path = n.tier === "path";
              return (
                <g
                  key={n.id}
                  ref={(el) => {
                    nodeEls.current[i] = el;
                  }}
                  transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
                  role="button"
                  tabIndex={0}
                  aria-label={n.soon ? `${n.label}, coming soon` : n.label}
                  aria-pressed={on}
                  onPointerEnter={() => setActive(n.id)}
                  onFocus={() => setActive(n.id)}
                  onClick={() => setActive(n.id)}
                  className="cursor-pointer outline-none"
                >
                  <rect
                    x={-w / 2}
                    y={path ? -18 : -15}
                    width={w}
                    height={path ? 36 : 30}
                    rx={path ? 18 : 15}
                    fill={on ? "#ff5701" : path ? "#fcfcfb" : "#1b2150"}
                    stroke={on ? "#ffb27a" : "rgba(255,255,255,.28)"}
                    strokeWidth="1.2"
                    strokeDasharray={n.soon ? "4 3" : undefined}
                  />
                  <text y={path ? 5 : 4.5} textAnchor="middle" fontSize={path ? 15 : 13} fontWeight="600" fill={on ? "#0c1020" : path ? "#0c1020" : "#fcfcfb"}>
                    {shown(n)}
                  </text>
                </g>
              );
            })}
          </svg>

          <ul className="grid grid-cols-2 gap-2 md:hidden">
            {NODES.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => setActive(n.id)}
                  aria-pressed={n.id === active}
                  className={`w-full rounded-full px-4 py-2.5 text-sm font-semibold ${
                    n.id === active ? "bg-cap-orange text-cap-ink" : n.tier === "path" ? "bg-cap-paper text-cap-ink" : "border border-white/30! text-white"
                  }`}
                >
                  {shown(n)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
