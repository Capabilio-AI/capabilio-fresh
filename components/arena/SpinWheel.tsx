"use client";

import { useState } from "react";
import { TASK_COUNT_OPTIONS } from "@/lib/arena-challenges/points";

const SEGMENT_COLORS = ["#D64550", "#4C8DA8", "#3B82C4", "#2E9E6B", "#8B5CF6", "#E88A2E"];
const SEGMENT_COUNT = TASK_COUNT_OPTIONS.length;
const SPIN_DURATION_MS = 2400;
// The wheel's segments are a real, complete list of the actual possible
// outcomes (TASK_COUNT_OPTIONS) -- but the landing rotation itself is
// still cosmetic. The real pick already happened server-side (the /spin
// call) by the time this animation starts; the wheel reveals it, it
// doesn't decide it.
const MIN_EXTRA_SPINS = 4;

interface SpinWheelProps {
  onSpin: () => Promise<void>;
  disabled?: boolean;
}

export function SpinWheel({ onSpin, disabled }: SpinWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);

  async function handleSpin() {
    if (spinning || disabled) return;
    setSpinning(true);
    const randomOffset = Math.floor(Math.random() * 360);
    setRotation((prev) => prev + MIN_EXTRA_SPINS * 360 + randomOffset);

    await Promise.all([onSpin().catch(() => {}), new Promise((resolve) => setTimeout(resolve, SPIN_DURATION_MS))]);
    setSpinning(false);
  }

  const gradient = `conic-gradient(${SEGMENT_COLORS.map((c, i) => `${c} ${(i * 360) / SEGMENT_COUNT}deg ${((i + 1) * 360) / SEGMENT_COUNT}deg`).join(", ")})`;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-64 w-64">
        <div
          className="h-full w-full rounded-full border-[6px] border-white shadow-xl transition-transform ease-out"
          style={{ background: gradient, transform: `rotate(${rotation}deg)`, transitionDuration: `${SPIN_DURATION_MS}ms` }}
        >
          {TASK_COUNT_OPTIONS.map((count, i) => {
            const angle = (i + 0.5) * (360 / SEGMENT_COUNT);
            return (
              <span
                key={count}
                className="absolute left-1/2 top-1/2 w-0 whitespace-nowrap font-lp-display text-[14px] font-bold text-white"
                style={{ transform: `rotate(${angle}deg) translateY(-84px)`, transformOrigin: "center" }}
              >
                {count} TASKS
              </span>
            );
          })}
        </div>
        <div className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-app-border bg-white shadow" />
        <div className="absolute -top-1 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[10px] border-t-[16px] border-x-transparent border-t-app-orange" />
      </div>
      <button
        type="button"
        onClick={handleSpin}
        disabled={spinning || disabled}
        className="rounded-lg bg-app-orange px-6 py-3 font-lp-display text-[14px] font-bold uppercase tracking-wide text-white shadow-md disabled:cursor-not-allowed disabled:opacity-60"
      >
        {spinning ? "Spinning…" : "Spin for Tasks"}
      </button>
    </div>
  );
}
