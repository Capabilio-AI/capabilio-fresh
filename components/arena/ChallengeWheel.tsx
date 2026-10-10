"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SEGMENT_DEGREES, WHEEL_COUNTS, rotationFor, segmentAt } from "@/lib/arena-challenges/wheel";
import { ScratchCard } from "./ScratchCard";

// The server draws the week's number (POST /api/arena/wheel); this component only animates to it, then runs the scratch-card reveal.
const SPIN_MS = 6500;
const REDUCED_SPIN_MS = 900;
const SIZE = 440;
const R = 196;
// [rim colour, inner colour, numeral colour]
const SEGMENTS: readonly (readonly [string, string, string])[] = [
  ["#ff7a45", "#c2410c", "#fff"], ["#5b7cff", "#2f45c9", "#fff"], ["#22c58b", "#0f7a55", "#fff"],
  ["#ffc83d", "#d98a00", "#2a1a00"], ["#a678ff", "#6a35d6", "#fff"], ["#ff5a76", "#c0243f", "#fff"],
];
const bulbs = Array.from({ length: 30 }, (_, i) => i);
const ink = "#ffffff", soft = "rgba(255,255,255,.68)";

const polar = (deg: number, r: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [SIZE / 2 + r * Math.cos(a), SIZE / 2 + r * Math.sin(a)] as const;
};
const wedge = (i: number) => {
  const [x1, y1] = polar(i * SEGMENT_DEGREES - SEGMENT_DEGREES / 2, R);
  const [x2, y2] = polar(i * SEGMENT_DEGREES + SEGMENT_DEGREES / 2, R);
  return `M${SIZE / 2},${SIZE / 2} L${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2} Z`;
};
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

interface WheelState { weekStart: string; spin: { count: number; revealed: boolean } | null }
async function callWheel(action?: "spin" | "reveal"): Promise<WheelState> {
  const res = await fetch("/api/arena/wheel", action ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) } : undefined);
  if (!res.ok) throw new Error("wheel request failed");
  return res.json();
}

/** `onStart` runs after the card is revealed and the student presses Start: the caller then loads the week's challenges. */
export function ChallengeWheel({ onStart }: { onStart: () => void }) {
  const [week, setWeek] = useState("");
  const [error, setError] = useState<string | null>(null);
  const disc = useRef<SVGGElement>(null);
  const flap = useRef<SVGGElement>(null);
  const raf = useRef(0);
  const rotation = useRef(0);
  const [phase, setPhase] = useState<"idle" | "spinning" | "scratch" | "done">("idle");
  const [value, setValue] = useState<number | null>(null);
  const [lit, setLit] = useState(0);
  const [ready, setReady] = useState(false);
  const [earlier, setEarlier] = useState(false); // scratched on an earlier visit, so no foil to show

  const paint = (deg: number, speed: number) => {
    disc.current?.setAttribute("transform", `rotate(${deg} ${SIZE / 2} ${SIZE / 2})`);
    // the flapper is kicked back by every peg (segment boundary) that passes under it, harder when the wheel is fast
    const phaseInPeg = ((deg + SEGMENT_DEGREES / 2) % SEGMENT_DEGREES) / SEGMENT_DEGREES;
    const kick = Math.min(32, speed * 2.2) * Math.pow(1 - phaseInPeg, 2);
    flap.current?.setAttribute("transform", `rotate(${-kick} ${SIZE / 2} 14)`);
    setLit((cur) => { const next = segmentAt(deg); return next === cur ? cur : next; });
  };

  useEffect(() => {
    let alive = true;
    callWheel().then((st) => {
      if (!alive) return;
      setWeek(st.weekStart);
      if (st.spin) {
        rotation.current = rotationFor(WHEEL_COUNTS.indexOf(st.spin.count as never), 0) % 360;
        paint(rotation.current, 0);
        setValue(st.spin.count);
        setEarlier(st.spin.revealed);
        setPhase(st.spin.revealed ? "done" : "scratch");
      }
      setReady(true);
    }).catch(() => { if (alive) setError("Could not load your wheel. Refresh to try again."); });
    return () => { alive = false; cancelAnimationFrame(raf.current); };
  }, []);

  async function spin() {
    if (phase !== "idle" || !ready) return;
    setPhase("spinning");
    setError(null);
    let count: number;
    try {
      const st = await callWheel("spin");
      if (!st.spin) throw new Error("no spin");
      count = st.spin.count;
      setWeek(st.weekStart);
    } catch {
      setError("The wheel could not start. Please try again.");
      setPhase("idle");
      return;
    }
    const index = WHEEL_COUNTS.indexOf(count as never);
    const from = rotation.current % 360;
    const to = rotationFor(index, from, (Math.random() - 0.5) * 0.7);
    const ms = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? REDUCED_SPIN_MS : SPIN_MS;
    const t0 = performance.now();
    let prev = from;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      const deg = from + (to - from) * easeOutQuart(t);
      rotation.current = deg;
      paint(deg, deg - prev);
      prev = deg;
      if (t < 1) { raf.current = requestAnimationFrame(tick); return; }
      paint(deg, 0);
      setValue(count);
      setPhase("scratch");
    };
    raf.current = requestAnimationFrame(tick);
  }

  const onReveal = () => {
    setPhase("done");
    callWheel("reveal").catch(() => setError("Your reveal could not be saved; pressing Start will retry."));
  };
  const [rim] = SEGMENTS[lit];

  return (
    <div className="relative overflow-hidden rounded-3xl px-4 py-10"
      style={{ background: "radial-gradient(120% 80% at 50% 0%, #1d1f2b 0%, #0b0c10 70%)", color: ink, border: "1px solid rgba(255,255,255,.1)" }}>
      <style>{CSS}</style>
      <div aria-hidden className="absolute inset-0 transition-[background] duration-500"
        style={{ background: `radial-gradient(46% 38% at 50% 34%, ${rim}55, transparent 72%)` }} />
      <div aria-hidden className="wheel-stars" />
      {phase === "done" && <Confetti />}

      <div className="relative mx-auto flex max-w-[480px] flex-col items-center">
        <p style={{ color: rim, font: "700 12px Inter, sans-serif", letterSpacing: ".24em", textTransform: "uppercase" }}>{week ? `Week of ${week}` : "This week"}</p>
        <h2 className="mt-2 text-center" style={{ font: "800 32px/1.15 var(--font-lp-display, Inter, sans-serif)", color: ink }}>
          {phase === "idle" || phase === "spinning" ? "Spin for your week" : phase === "scratch" ? "Scratch your card" : `${value} challenges unlocked`}
        </h2>
        <p className="mt-1 text-center" style={{ color: soft, font: "400 13.5px/1.5 Inter, sans-serif" }}>
          {phase === "idle" ? "A new spin opens every Sunday at 12:00 AM. It decides how many Stream challenges you get this week." :
           phase === "spinning" ? "Hold your breath…" :
           phase === "scratch" ? "The wheel has chosen. Scratch to see your number." : "Locked in until next Sunday."}
        </p>

        <div className="relative mt-8" style={{ width: SIZE, maxWidth: "100%" }}>
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="block w-full overflow-visible" role="img" aria-label={`Wheel: ${WHEEL_COUNTS.join(", ")}`}>
            <defs>
              {SEGMENTS.map(([a, b], i) => (
                <radialGradient key={i} id={`seg${i}`} cx="50%" cy="50%" r="50%"><stop offset="25%" stopColor={b} /><stop offset="100%" stopColor={a} /></radialGradient>
              ))}
              <radialGradient id="hub" cx="50%" cy="35%" r="70%"><stop offset="0%" stopColor="#fff" /><stop offset="100%" stopColor="#e6e1d6" /></radialGradient>
            </defs>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R + 22} fill="#15161b" stroke="#2c2e38" strokeWidth={4} />
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R + 22} fill="none" stroke={rim} strokeOpacity={0.6} strokeWidth={2} className="wheel-ring" />
            <g ref={disc}>
              {WHEEL_COUNTS.map((n, i) => {
                const [tx, ty] = polar(i * SEGMENT_DEGREES, R * 0.66);
                return (
                  <g key={n}>
                    <path d={wedge(i)} fill={`url(#seg${i})`} stroke="#0b0c10" strokeWidth={3} />
                    <text x={tx} y={ty} fill={SEGMENTS[i][2]} fontSize={62} fontWeight={900} textAnchor="middle" dominantBaseline="central"
                      transform={`rotate(${i * SEGMENT_DEGREES - 90} ${tx} ${ty})`} style={{ fontFamily: "Inter, sans-serif", paintOrder: "stroke", stroke: "rgba(0,0,0,.25)", strokeWidth: 2 }}>{n}</text>
                  </g>
                );
              })}
              {WHEEL_COUNTS.map((n, i) => { // pegs on the rim, one per boundary
                const [x, y] = polar(i * SEGMENT_DEGREES + SEGMENT_DEGREES / 2, R + 1);
                return <circle key={n} cx={x} cy={y} r={7} fill="#ffe29a" stroke="#8a5a00" strokeWidth={2} />;
              })}
            </g>
            {bulbs.map((i) => {
              const [x, y] = polar((i * 360) / bulbs.length, R + 12);
              return <circle key={i} cx={x} cy={y} r={3.2} fill={i % 2 ? "#fff" : rim} className={phase === "spinning" ? "wheel-bulb fast" : "wheel-bulb"} style={{ animationDelay: `${(i % 2) * 0.4}s` }} />;
            })}
            <circle cx={SIZE / 2} cy={SIZE / 2} r={58} fill="#15161b" stroke={rim} strokeWidth={4} />
            <circle cx={SIZE / 2} cy={SIZE / 2} r={48} fill="url(#hub)" />
            <image href="/brand/icon-light.png" x={SIZE / 2 - 24} y={SIZE / 2 - 24} width={48} height={48} />
            <g ref={flap}>
              <path d={`M${SIZE / 2 - 15},-8 L${SIZE / 2 + 15},-8 L${SIZE / 2},44 Z`} fill="#faf9f5" stroke="#15161b" strokeWidth={3} strokeLinejoin="round" />
              <circle cx={SIZE / 2} cy={4} r={6} fill="#d95d39" />
            </g>
          </svg>
          <button type="button" onClick={spin} disabled={phase !== "idle" || !ready}
            aria-label="Spin the wheel" className="absolute rounded-full" style={{ left: "50%", top: "50%", width: 104, height: 104, margin: "-52px 0 0 -52px", background: "transparent", cursor: phase === "idle" ? "pointer" : "default" }} />
        </div>

        {phase === "idle" && (
          <button type="button" onClick={spin} disabled={!ready} className="wheel-cta mt-8 rounded-full px-9 py-3.5"
            style={{ background: "linear-gradient(135deg,#ff7a45,#ff4f6e)", color: "#fff", font: "800 16px Inter, sans-serif", letterSpacing: ".08em" }}>
            SPIN THE WHEEL
          </button>
        )}
        {(phase === "scratch" || phase === "done") && value !== null && (
          <div className="mt-8"><ScratchCard value={value} revealed={earlier} onReveal={onReveal} onStart={onStart} /></div>
        )}

        {error && <p role="alert" className="mt-6" style={{ color: "#ff9aa8", font: "500 13px Inter, sans-serif" }}>{error}</p>}
      </div>
    </div>
  );
}

function Confetti() {
  // deterministic scatter (pure render): a golden-ratio sequence looks random enough for confetti
  const pieces = Array.from({ length: 56 }, (_, i) => {
    const f = (k: number) => (i * 0.618034 * k) % 1;
    return { left: f(1) * 100, delay: f(2) * 0.7, dur: 2.4 + f(3) * 1.6, color: SEGMENTS[i % SEGMENTS.length][0], drift: (f(5) - 0.5) * 140 };
  });
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {pieces.map((p, i) => <span key={i} className="wheel-confetti" style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, ["--drift" as string]: `${p.drift}px` }} />)}
    </div>
  );
}

const CSS = `
.wheel-stars{position:absolute;inset:0;opacity:.5;background-image:radial-gradient(1.5px 1.5px at 12% 20%,#fff,transparent),radial-gradient(1.5px 1.5px at 80% 14%,#fff,transparent),radial-gradient(1px 1px at 30% 70%,#fff,transparent),radial-gradient(1.5px 1.5px at 90% 60%,#fff,transparent),radial-gradient(1px 1px at 55% 90%,#fff,transparent),radial-gradient(1px 1px at 6% 82%,#fff,transparent)}
.wheel-bulb{animation:wheel-blink 1.5s ease-in-out infinite;filter:drop-shadow(0 0 4px currentColor)}
.wheel-bulb.fast{animation-duration:.22s}
.wheel-ring{animation:wheel-glow 2.4s ease-in-out infinite}
.wheel-cta{animation:wheel-pulse 1.6s ease-in-out infinite;box-shadow:0 12px 34px rgba(255,90,110,.5)}
.wheel-confetti{position:absolute;top:-12px;width:8px;height:14px;border-radius:2px;animation:wheel-fall linear forwards}
@keyframes wheel-blink{0%,100%{opacity:.3}50%{opacity:1}}
@keyframes wheel-glow{0%,100%{stroke-opacity:.35}50%{stroke-opacity:.9}}
@keyframes wheel-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes wheel-fall{to{transform:translate(var(--drift),640px) rotate(540deg);opacity:0}}
@media (prefers-reduced-motion:reduce){.wheel-bulb,.wheel-ring,.wheel-cta,.wheel-confetti{animation:none}}
`;
