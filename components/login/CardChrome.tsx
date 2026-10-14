"use client";

import { ReactNode } from "react";
import type { PointerEvent } from "react";
import { motion } from "framer-motion";

interface CardChromeProps {
  children: ReactNode;
  label?: string;
}

function trackPointer(e: PointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

export function CardChrome({ children, label = "Capabilio account" }: CardChromeProps) {
  return (
    <motion.section
      aria-label={label}
      initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      onPointerMove={trackPointer}
      className="cap-glass w-full max-w-[34rem] rounded-[1.75rem] p-6 text-cap-ink sm:p-9"
    >
      {children}
    </motion.section>
  );
}
