"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const WORDS = ["static PDF", "LinkedIn bio", "fake claim", "resume"];
const SWAP_MS = 2900;

export default function RotatingWord() {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % WORDS.length), SWAP_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <p
      className="font-cap-display text-[clamp(1.35rem,2.6vw,2.2rem)] font-medium leading-tight tracking-[-0.02em] text-cap-ink"
      aria-label={`Your career needs more than a ${WORDS.join(", ")}.`}
    >
      <span aria-hidden="true">
        Your career needs more than a{" "}
        <span className="relative inline-flex overflow-hidden align-bottom">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={WORDS[i]}
              initial={{ y: "80%", opacity: 0, filter: "blur(8px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: "-80%", opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="relative inline-block font-bold text-cap-orange"
            >
              {WORDS[i]}
              <span className="cap-strike absolute left-0 top-[56%] h-[3px] w-full origin-left bg-cap-ink" />
            </motion.span>
          </AnimatePresence>
        </span>
        .
      </span>
    </p>
  );
}
