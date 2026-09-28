"use client";

import { useState } from "react";

const SEGMENT_COLORS = ["#4C4EE8", "#E88A2E", "#2E9E6B", "#D64550", "#8B5CF6", "#0EA5B7"];
const SEGMENT_COUNT = SEGMENT_COLORS.length;
const SPIN_DURATION_MS = 2400;
// Purely decorative: the wheel's visual segments don't map to real
// candidate challenges (the client doesn't know the pool ahead of a spin).
// The server has already decided the real pick before this animation ever
// starts — see the spin route. This is a reveal, not a decision.
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

    const [result] = await Promise.all([
      onSpin().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, SPIN_DURATION_MS)),
    ]);
    setSpinning(false);
    return result;
  }

  const gradient = `conic-gradient(${SEGMENT_COLORS.map((c, i) => `${c} ${(i * 360) / SEGMENT_COUNT}deg ${((i + 1) * 360) / SEGMENT_COUNT}deg`).join(", ")})`;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-40 w-40">
        <div
          className="h-full w-full rounded-full border-4 border-white shadow-lg transition-transform ease-out"
          style={{ background: gradient, transform: `rotate(${rotation}deg)`, transitionDuration: `${SPIN_DURATION_MS}ms` }}
        />
        <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow" />
        <div className="absolute -top-1 left-1/2 h-0 w-0 -translate-x-1/2 border-x-8 border-t-[14px] border-x-transparent border-t-app-charcoal" />
      </div>
      <button
        type="button"
        onClick={handleSpin}
        disabled={spinning || disabled}
        className="rounded-lg bg-app-charcoal px-5 py-2.5 font-lp-body text-[13.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {spinning ? "Spinning…" : "Spin for this week's challenge"}
      </button>
    </div>
  );
}
