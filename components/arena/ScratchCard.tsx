"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

const W = 340;
const H = 190;
const BRUSH = 24;
const REVEAL_AT = 0.5; // fraction of the foil that must be gone before the rest clears itself
const SAMPLE_STEP = 6;

function paintFoil(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#c9ccd2"); g.addColorStop(0.35, "#f4f5f7"); g.addColorStop(0.55, "#aeb2ba"); g.addColorStop(1, "#e3e5e9");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 260; i++) { ctx.fillStyle = i % 2 ? "#fff" : "#6b7078"; ctx.fillRect((i * 97) % W, (i * 53) % H, 2, 2); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#4b4f57";
  ctx.font = "800 22px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("SCRATCH TO REVEAL", W / 2, H / 2 - 4);
  ctx.font = "600 12px Inter, sans-serif";
  ctx.fillText("your challenges for this week", W / 2, H / 2 + 20);
}

interface Props {
  value: number;
  /** already revealed on an earlier visit */
  revealed: boolean;
  onReveal: () => void;
  /** the student pressed "Start" after revealing */
  onStart: () => void;
}

export function ScratchCard({ value, revealed, onReveal, onStart }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const moves = useRef(0);
  const [done, setDone] = useState(revealed);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || revealed) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr; c.height = H * dpr;
    ctx.scale(dpr, dpr);
    paintFoil(ctx);
  }, [revealed]);

  const finish = useCallback(() => { setDone(true); onReveal(); }, [onReveal]);

  function coverage(ctx: CanvasRenderingContext2D, dpr: number): number {
    const { data, width, height } = ctx.getImageData(0, 0, W * dpr, H * dpr);
    let clear = 0, total = 0;
    const step = SAMPLE_STEP * dpr;
    for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) { total++; if (data[(Math.floor(y) * width + Math.floor(x)) * 4 + 3] < 40) clear++; }
    return clear / total;
  }

  function scratch(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || done) return;
    const c = canvas.current!, ctx = c.getContext("2d")!;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath(); ctx.arc(x, y, BRUSH, 0, Math.PI * 2); ctx.fill();
    if (++moves.current % 8 === 0 && coverage(ctx, window.devicePixelRatio || 1) > REVEAL_AT) finish();
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative overflow-hidden rounded-2xl" style={{ width: W, maxWidth: "100%", aspectRatio: `${W}/${H}`, boxShadow: "0 18px 50px rgba(0,0,0,.5), 0 0 0 2px rgba(255,255,255,.14)" }}>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: "linear-gradient(135deg,#fff7ec,#ffe1cf)", color: "#111315" }}>
          <span style={{ font: "800 70px/1 Inter, sans-serif", color: "#d95d39" }}>{value}</span>
          <span style={{ font: "700 15px Inter, sans-serif", marginTop: 4 }}>challenges this week</span>
        </div>
        {!revealed && (
          <canvas ref={canvas} aria-label="Scratch card foil" className="absolute inset-0 h-full w-full"
            style={{ touchAction: "none", cursor: "crosshair", opacity: done ? 0 : 1, transition: "opacity .6s", pointerEvents: done ? "none" : "auto" }}
            onPointerDown={(e) => { drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); scratch(e); }}
            onPointerMove={scratch}
            onPointerUp={() => { drawing.current = false; }}
            onPointerCancel={() => { drawing.current = false; }} />
        )}
      </div>
      {done ? (
        <button type="button" onClick={onStart} className="mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-bold text-white"
          style={{ background: "linear-gradient(135deg,#d95d39,#e8844f)", boxShadow: "0 10px 30px rgba(217,93,57,.45)" }}>
          Start your {value} challenges <ArrowRight size={16} />
        </button>
      ) : (
        <p className="mt-4 text-[12.5px]" style={{ color: "rgba(255,255,255,.65)" }}>Use your finger or mouse to scratch the silver.</p>
      )}
    </div>
  );
}
