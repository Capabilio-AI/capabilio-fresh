"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

export type Peak = { id: string; x: number; level: number; live?: boolean };
export type Palette = { far: string; mid?: string; near: string; crest: string };

type Props = {
  palette: Palette;
  peaks?: Peak[];
  /** Called every frame with each peak's crest position in px, so the parent can pin markers. */
  onPlace?: (id: string, x: number, y: number) => void;
  activeRef?: MutableRefObject<string | null>;
  layers?: number;
  horizon?: number;
  relief?: number;
  interactive?: boolean;
  /** Far layers drift slower than the page scroll. */
  parallax?: boolean;
  className?: string;
};

const MARKER_LAYER_FROM_NEAR = 0;
const PEAK_WIDTH = 0.065;

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export default function Ridgeline({
  palette,
  peaks = [],
  onPlace,
  activeRef,
  layers = 14,
  horizon = 0.42,
  relief = 0.2,
  interactive = false,
  parallax = false,
  className,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = wrap.current;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!host || !cv || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0;
    let H = 0;
    let raf = 0;
    let running = false;
    let start = 0;
    let mouse = 0.5;
    let mouseTarget = 0.5;
    let mouseAmt = 0;
    let mouseAmtTarget = 0;
    const markerLayer = layers - 1 - MARKER_LAYER_FROM_NEAR;

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = host.clientWidth;
      H = host.clientHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const baseY = (t: number) => H * (horizon + (0.99 - horizon) * Math.pow(t, 1.25));

    const height = (x: number, i: number, t: number, grow: number): number => {
      const lt = i / (layers - 1);
      const relief_i = H * relief * (0.3 + 0.7 * lt);
      const n =
        Math.sin(x * 5.1 + i * 1.7 + t * 0.12) * 0.5 +
        Math.sin(x * 11.3 - i * 2.3 + t * 0.07) * 0.3 +
        Math.sin(x * 23 + i * 0.9 - t * 0.05) * 0.2;
      let h = (n * 0.5 + 0.5) * relief_i * 0.3;
      for (let k = 0; k < peaks.length; k++) {
        const p = peaks[k];
        const wob = p.live ? 0.045 * Math.sin(t * 0.8 + k) : 0;
        const lift = activeRef?.current === p.id ? 0.07 : 0;
        const level = (p.level + wob + lift) * grow;
        const d = (x - (p.x + (i - markerLayer) * 0.007)) / PEAK_WIDTH;
        h += level * H * 0.7 * (0.55 + 0.45 * lt) * Math.exp(-d * d);
      }
      if (interactive && mouseAmt > 0.001) {
        const d = (x - mouse) / 0.16;
        h += mouseAmt * H * 0.07 * (0.4 + 0.6 * lt) * Math.exp(-d * d);
      }
      return h;
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      const sy = parallax && !reduced ? Math.min(window.scrollY, 1000) : 0;
      const grow = reduced ? 1 : ease(t / 1.8);
      const step = Math.max(5, Math.round(W / 220));
      for (let i = 0; i < layers; i++) {
        const lt = i / (layers - 1);
        const y0 = baseY(lt) + sy * 0.3 * (1 - lt);
        ctx.beginPath();
        ctx.moveTo(0, H + 2);
        for (let px = 0; px <= W + step; px += step) {
          ctx.lineTo(px, y0 - height(Math.min(px, W) / W, i, t, grow));
        }
        ctx.lineTo(W, H + 2);
        ctx.closePath();
        const c = Math.pow(lt, 0.85);
        ctx.fillStyle = palette.mid
          ? c < 0.5
            ? mix(palette.far, palette.mid, c * 2)
            : mix(palette.mid, palette.near, (c - 0.5) * 2)
          : mix(palette.far, palette.near, c);
        ctx.fill();
        ctx.strokeStyle = palette.crest;
        ctx.globalAlpha = 0.12 + 0.3 * lt;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (onPlace) {
        const y0 = baseY(markerLayer / (layers - 1));
        for (const p of peaks) onPlace(p.id, p.x * W, y0 - height(p.x, markerLayer, t, grow));
      }
    };

    const frame = (now: number) => {
      if (!running) return;
      if (!start) start = now;
      mouse += (mouseTarget - mouse) * 0.08;
      mouseAmt += (mouseAmtTarget - mouseAmt) * 0.06;
      draw((now - start) / 1000);
      raf = requestAnimationFrame(frame);
    };

    const play = () => {
      if (running || reduced) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    size();
    draw(reduced ? 99 : 0);
    const ro = new ResizeObserver(() => {
      size();
      if (!running) draw(reduced ? 99 : (performance.now() - start) / 1000);
    });
    ro.observe(host);
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? play() : stop()));
    io.observe(host);

    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      mouseTarget = (e.clientX - r.left) / r.width;
      mouseAmtTarget = 1;
    };
    const onLeave = () => (mouseAmtTarget = 0);
    if (interactive && !reduced) {
      host.addEventListener("pointermove", onMove, { passive: true });
      host.addEventListener("pointerleave", onLeave);
    }

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, [palette, peaks, onPlace, activeRef, layers, horizon, relief, interactive, parallax]);

  return (
    <div ref={wrap} className={className} aria-hidden={peaks.length === 0}>
      <canvas ref={canvas} className="block h-full w-full" />
    </div>
  );
}
