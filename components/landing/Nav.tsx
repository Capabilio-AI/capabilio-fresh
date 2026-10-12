"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, Search, X } from "lucide-react";
import { PALETTE_EVENT } from "./CommandPalette";
import { motion, useScroll, useSpring } from "framer-motion";

const LINKS = [
  { label: "Ecosystem", href: "#ecosystem" },
  { label: "Apps", href: "#platform" },
  { label: "Paths", href: "#paths" },
  { label: "Principles", href: "#principles" },
  { label: "Organisations", href: "#institutions" },
];

export default function Nav() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        solid || open ? "border-b border-cap-line! bg-cap-paper/95 backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <motion.div
        aria-hidden="true"
        style={{ scaleX: progress }}
        className="absolute inset-x-0 top-0 h-[3px] origin-left bg-cap-orange"
      />
      <nav className="mx-auto flex h-16 max-w-[84rem] items-center justify-between px-5 md:px-10" aria-label="Main">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/brand/icon-light.png" alt="" width={28} height={28} className="h-7 w-7" />
          <span className="font-cap-display text-xl font-semibold tracking-tight text-cap-ink">Capabilio</span>
        </Link>

        <div className="hidden items-center gap-8 xl:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-cap-ink/75 transition-colors hover:text-cap-ink">
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(PALETTE_EVENT))}
            className="mr-1 hidden items-center gap-2 rounded-full border border-cap-ink/20! px-3.5 py-2 text-sm font-medium text-cap-ink/70 hover:text-cap-ink xl:inline-flex"
            aria-label="Open command palette"
          >
            <Search size={15} /> Search <kbd className="font-mono text-[11px] opacity-70">⌘K</kbd>
          </button>
          <Link href="/login" className="px-3 py-2 text-sm font-medium text-cap-ink/75 hover:text-cap-ink">
            Log in
          </Link>
          <Link
            href="/get-started"
            className="rounded-full bg-cap-ink px-5 py-2.5 text-sm font-semibold text-cap-paper transition-transform hover:-translate-y-px active:translate-y-0"
          >
            Get started
          </Link>
        </div>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full text-cap-ink xl:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-cap-line! px-5 pb-6 pt-3 xl:hidden">
          <div className="flex flex-col">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b border-cap-line! py-3.5 font-cap-display text-xl text-cap-ink"
              >
                {l.label}
              </a>
            ))}
          </div>
          <div className="mt-5 flex gap-3">
            <Link href="/login" className="flex-1 rounded-full border border-cap-line! py-3 text-center text-sm font-semibold">
              Log in
            </Link>
            <Link href="/get-started" className="flex-1 rounded-full bg-cap-ink py-3 text-center text-sm font-semibold text-cap-paper">
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
