"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";

const TEXT =
  "Every skill you build becomes a record anyone can check. Not a claim. Not a link. Proof.";
const WORDS = TEXT.split(" ");

function Word({ w, i, p }: { w: string; i: number; p: MotionValue<number> }) {
  const a = (i / WORDS.length) * 0.7;
  const opacity = useTransform(p, [a, a + 0.12], [0.16, 1]);
  return (
    <motion.span style={{ opacity }} className="mr-[0.28em] inline-block">
      {w}
    </motion.span>
  );
}

export default function Statement() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.55"] });

  return (
    <section id="statement" ref={ref} className="bg-cap-paper px-5 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-[62rem] text-center">
        <p className="font-cap-display text-[clamp(2rem,5vw,4.25rem)] font-medium leading-[1.12] tracking-[-0.025em] text-cap-ink">
          {WORDS.map((w, i) => (
            <Word key={i} w={w} i={i} p={scrollYProgress} />
          ))}
        </p>
        <a href="#platform" className="mt-10 inline-block text-base font-semibold text-cap-indigo underline">
          See how a skill becomes proof
        </a>
      </div>
    </section>
  );
}
