"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, RotateCcw } from "lucide-react";
import { SEGMENT_DEGREES, WHEEL_COUNTS, pickIndex, rotationFor, spinWeekKey } from "@/lib/arena-challenges/wheel";

// PROTOTYPE: the result is decided and remembered in this browser (localStorage) so the wheel can be tried out.
// In the real feature the server picks the number once per week and stores it; the client only animates to it.
const SPIN_MS = 6200;
const SIZE = 420;
const R = 190;
const SEGMENT_FILL = ["#d95d39", "#111315", "#4361ee", "#1a7d4d", "#b8431f", "#30312e"];
const bulbs = Array.from({ length: 24 }, (_, i) => i);
const storeKey = (week: string) => `capabilio:wheel-proto:${week}`;

const polar = (deg: number, r: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [SIZE / 2 + r * Math.cos(a), SIZE / 2 + r * Math.sin(a)] as const;
};
const wedge = (i: number) => {
  const [x1, y1] = polar(i * SEGMENT_DEGREES - SEGMENT_DEGREES / 2, R);
  const [x2, y2] = polar(i * SEGMENT_DEGREES + SEGMENT_DEGREES / 2, R);
  return `M${SIZE / 2},${SIZE / 2} L${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2} Z`;
};

function readStored(week: string): number | null {
  try {
    const v = Number(localStorage.getItem(storeKey(week)));
    return WHEEL_COUNTS.includes(v as never) ? v : null;
  } catch {
    return null;
  }
}

export function ChallengeWheel() {
  const week = useMemo(() => spinWeekKey(new Date()), []);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    // localStorage only exists in the browser, so the saved spin is applied after mount (in a microtask, not during render)
    queueMicrotask(() => {
      const saved = readStored(week);
      if (saved !== null) {
        setResult(saved);
        setRotation(rotationFor(WHEEL_COUNTS.indexOf(saved as never), 0) % 360);
      }
      setReady(true);
    });
    return () => clearTimeout(timer.current);
  }, [week]);

  function spin() {
    if (spinning || result !== null) return;
    const index = pickIndex();
    const jitter = (Math.random() - 0.5) * 0.7;
    setSpinning(true);
    setRotation((cur) => rotationFor(index, cur, jitter));
    timer.current = setTimeout(() => {
      const value = WHEEL_COUNTS[index];
      try { localStorage.setItem(storeKey(week), String(value)); } catch { /* prototype only */ }
      setResult(value);
      setSpinning(false);
    }, SPIN_MS);
  }

  function resetForTesting() {
    try { localStorage.removeItem(storeKey(week)); } catch { /* prototype only */ }
    setResult(null);
  }

  return (
    <div className="wheel-stage relative overflow-hidden rounded-3xl border border-[#2a2b2e] bg-[#0f1012] px-4 py-10 text-white">
      <style>{CSS}</style>
      <div className="wheel-glow" aria-hidden />
      {result !== null && !spinning && <Confetti />}

      <div className="relative mx-auto flex max-w-[460px] flex-col items-center">
        <p className="font-lp-body text-[12px] font-semibold uppercase tracking-[0.22em] text-[#f2a58c]">Week of {week}</p>
        <h2 className="mt-2 text-center font-lp-display text-[30px] font-bold leading-tight">
          {result === null ? "Spin for your week" : `${result} challenges this week`}
        </h2>
        <p className="mt-1 text-center font-lp-body text-[13px] text-white/60">
          {result === null ? "One spin every Sunday decides how many challenges you get until next Sunday." : "Locked in. Come back next Sunday for a new spin."}
        </p>

        <div className="relative mt-8" style={{ width: SIZE, maxWidth: "100%" }}>
          <div className="wheel-pointer" aria-hidden />
          <div className={`wheel-rim ${spinning ? "is-spinning" : ""}`}>
            {bulbs.map((i) => {
              const [x, y] = polar((i * 360) / bulbs.length, 207);
              return <span key={i} className="wheel-bulb" style={{ left: `${(x / SIZE) * 100}%`, top: `${(y / SIZE) * 100}%`, animationDelay: `${(i % 2) * 0.35}s` }} />;
            })}
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="block w-full" role="img" aria-label={`Wheel with ${WHEEL_COUNTS.join(", ")}`}>
              <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "50% 50%", transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.72, 0.1, 1)` : "none" }}>
                {WHEEL_COUNTS.map((n, i) => {
                  const [tx, ty] = polar(i * SEGMENT_DEGREES, R * 0.68);
                  return (
                    <g key={n}>
                      <path d={wedge(i)} fill={SEGMENT_FILL[i]} stroke="#faf9f5" strokeWidth={3} />
                      <text x={tx} y={ty} fill="#fff" fontSize={54} fontWeight={800} textAnchor="middle" dominantBaseline="central"
                        transform={`rotate(${i * SEGMENT_DEGREES} ${tx} ${ty})`} style={{ fontFamily: "var(--font-lp-display, Inter, sans-serif)" }}>{n}</text>
                    </g>
                  );
                })}
              </g>
              <circle cx={SIZE / 2} cy={SIZE / 2} r={52} fill="#faf9f5" stroke="#d95d39" strokeWidth={6} />
            </svg>
            <button type="button" onClick={spin} disabled={spinning || result !== null || !ready}
              className="wheel-hub" aria-label={result === null ? "Spin the wheel" : "Already spun this week"}>
              {spinning ? "…" : result === null ? "SPIN" : result}
            </button>
          </div>
        </div>

        {result !== null && !spinning && (
          <div className="wheel-result mt-8 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-5 py-4">
            <Sparkles className="text-[#f2a58c]" size={22} />
            <div>
              <p className="font-lp-display text-[18px] font-bold">{result} challenges unlocked</p>
              <p className="font-lp-body text-[12.5px] text-white/60">Finish one and it locks, so no edits after submit.</p>
            </div>
          </div>
        )}

        <button type="button" onClick={resetForTesting}
          className="mt-8 inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-1.5 font-lp-body text-[12px] text-white/70 hover:bg-white/10">
          <RotateCcw size={13} /> Reset spin (testing only)
        </button>
      </div>
    </div>
  );
}

function Confetti() {
  // deterministic scatter (pure render): a golden-ratio sequence looks random enough for confetti
  const pieces = Array.from({ length: 46 }, (_, i) => {
    const f = (k: number) => (i * 0.618034 * k) % 1;
    return { left: f(1) * 100, delay: f(2) * 0.6, dur: 2.2 + f(3) * 1.6, color: SEGMENT_FILL[i % SEGMENT_FILL.length], drift: (f(5) - 0.5) * 120 };
  });
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {pieces.map((p, i) => (
        <span key={i} className="wheel-confetti" style={{ left: `${p.left}%`, background: p.color === "#111315" ? "#faf9f5" : p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, ["--drift" as string]: `${p.drift}px` }} />
      ))}
    </div>
  );
}

const CSS = `
.wheel-glow{position:absolute;inset:0;background:radial-gradient(60% 45% at 50% 38%,rgba(217,93,57,.28),transparent 70%),radial-gradient(40% 30% at 85% 90%,rgba(67,97,238,.2),transparent 70%)}
.wheel-rim{position:relative;border-radius:50%;padding:0;background:radial-gradient(circle,#1b1c1f 0 62%,#2c2d31 63% 100%);box-shadow:0 0 0 6px #2c2d31,0 24px 70px rgba(0,0,0,.55),0 0 80px rgba(217,93,57,.25)}
.wheel-bulb{position:absolute;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%;background:#ffd9a0;box-shadow:0 0 10px 2px rgba(255,200,120,.8);animation:wheel-blink 1.4s ease-in-out infinite;z-index:2}
.wheel-rim.is-spinning .wheel-bulb{animation-duration:.25s}
.wheel-pointer{position:absolute;left:50%;top:-14px;z-index:5;width:0;height:0;margin-left:-17px;border-left:17px solid transparent;border-right:17px solid transparent;border-top:42px solid #faf9f5;filter:drop-shadow(0 4px 6px rgba(0,0,0,.6))}
.wheel-pointer::after{content:"";position:absolute;left:-7px;top:-38px;width:14px;height:14px;border-radius:50%;background:#d95d39}
.wheel-hub{position:absolute;left:50%;top:50%;z-index:4;width:92px;height:92px;margin:-46px 0 0 -46px;border-radius:50%;border:0;background:transparent;color:#111315;font:800 20px/1 var(--font-lp-display,Inter,sans-serif);letter-spacing:.06em;cursor:pointer}
.wheel-hub:not(:disabled){animation:wheel-pulse 1.6s ease-in-out infinite;color:#d95d39}
.wheel-hub:disabled{cursor:default}
.wheel-result{animation:wheel-pop .5s cubic-bezier(.2,1.4,.4,1) both}
.wheel-confetti{position:absolute;top:-12px;width:8px;height:14px;border-radius:2px;animation:wheel-fall linear forwards}
@keyframes wheel-blink{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes wheel-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
@keyframes wheel-pop{from{opacity:0;transform:translateY(12px) scale(.94)}to{opacity:1;transform:none}}
@keyframes wheel-fall{to{transform:translate(var(--drift),520px) rotate(540deg);opacity:0}}
@media (prefers-reduced-motion:reduce){.wheel-bulb,.wheel-hub,.wheel-confetti{animation:none}.wheel-hub{transform:none}}
`;
