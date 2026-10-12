"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface CardChromeProps {
  children: ReactNode;
  label?: string;
}

export function CardChrome({ children, label = "Capabilio account" }: CardChromeProps) {
  return (
    <motion.section
      aria-label={label}
      initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="cap-win w-full max-w-[34rem] rounded-3xl bg-white p-6 text-cap-ink sm:p-9"
    >
      {children}
    </motion.section>
  );
}
