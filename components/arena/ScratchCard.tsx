"use client";

import { useEffect, useRef, useState } from "react";

const REVEAL_THRESHOLD = 0.4;
const SCRATCH_RADIUS = 22;
const SAMPLE_STEP = 6; // check every Nth pixel when estimating cleared area -- exact-per-pixel isn't needed for a reveal threshold

interface ScratchCardProps {
  taskCount: number;
  onRevealed: () => void;
}

export function ScratchCard({ taskCount, onRevealed }: ScratchCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [revealed, setRevealed] = useState(false);
  const scratching = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#2E9E6B";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "600 13px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Scratch to play", canvas.width / 2, canvas.height - 16);
  }, []);

  function scratchAt(x: number, y: number) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, SCRATCH_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  function checkRevealProgress() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let cleared = 0;
    let sampled = 0;
    for (let i = 3; i < data.length; i += 4 * SAMPLE_STEP) {
      sampled++;
      if (data[i] === 0) cleared++;
    }
    if (sampled > 0 && cleared / sampled >= REVEAL_THRESHOLD) {
      setRevealed(true);
      onRevealed();
    }
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  return (
    <div className="relative mx-auto h-72 w-56 overflow-hidden rounded-2xl shadow-lg">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-app-success px-4 text-center text-white">
        <p className="font-lp-body text-[13px]">Unlock your</p>
        <p className="font-lp-display text-[36px] font-bold">{taskCount} TASKS</p>
        <p className="font-lp-body text-[13px]">Weekly Reward</p>
      </div>
      {!revealed && (
        <canvas
          ref={canvasRef}
          width={224}
          height={288}
          className="absolute inset-0 h-full w-full cursor-pointer touch-none"
          onPointerDown={(e) => {
            scratching.current = true;
            const { x, y } = pointerPos(e);
            scratchAt(x, y);
          }}
          onPointerMove={(e) => {
            if (!scratching.current) return;
            const { x, y } = pointerPos(e);
            scratchAt(x, y);
          }}
          onPointerUp={() => {
            scratching.current = false;
            checkRevealProgress();
          }}
          onPointerLeave={() => {
            if (scratching.current) checkRevealProgress();
            scratching.current = false;
          }}
        />
      )}
    </div>
  );
}
