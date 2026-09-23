"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { PrimaryButton, StatusDot } from "./ui";

const LINKS = [
  { label: "Product", href: "#" },
  { label: "Career Paths", href: "#career-path" },
  { label: "Project Lab", href: "#project-lab" },
  { label: "Arena", href: "#arena" },
  { label: "For Students", href: "#ecosystem" },
  { label: "For Colleges", href: "#ecosystem" },
  { label: "For Recruiters", href: "#ecosystem" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 w-full bg-lp-background/90 backdrop-blur-md transition-shadow duration-300 ${
        scrolled ? "shadow-[0_1px_8px_rgba(0,0,0,0.06)]" : ""
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-margin-mobile md:px-margin">
        <div className="flex items-center gap-space-lg">
          <a href="/" className="flex items-center gap-space-sm">
            <Image
              src="/logo-mark.jpg"
              alt="Capabilio AI"
              width={28}
              height={28}
              className="h-7 w-7 rounded object-cover"
            />
            <span className="font-lp-display text-lp-headline-sm font-semibold tracking-tight text-lp-text-ink">
              Capabilio <span className="text-lp-accent-ochre">AI</span>
            </span>
          </a>
          <span className="hidden items-center gap-1.5 rounded bg-lp-surface-subtle px-2 py-0.5 font-lp-mono text-lp-label-sm uppercase tracking-wider text-lp-text-muted lg:inline-flex">
            <StatusDot tone="indigo" />
            Research Core
          </span>
        </div>

        <div className="hidden items-center gap-space-md xl:flex">
          {LINKS.map((l, i) => (
            <a
              key={l.label}
              href={l.href}
              className={
                i === 0
                  ? "font-lp-body text-lp-body-sm font-medium text-lp-text-ink underline decoration-1 underline-offset-8"
                  : "font-lp-body text-lp-body-sm text-lp-on-surface-variant transition-colors hover:text-lp-text-ink"
              }
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-space-md lg:flex">
          <a href="/login" className="font-lp-body text-lp-body-sm text-lp-on-surface-variant hover:text-lp-text-ink">
            Log in
          </a>
          <PrimaryButton href="#" className="rounded-full px-4 py-1.5 text-lp-body-sm">
            Get Started
          </PrimaryButton>
        </div>

        <button
          className="text-lp-text-ink lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-lp-border-hairline bg-lp-background px-margin-mobile py-space-md lg:hidden">
          <div className="flex flex-col gap-space-md">
            {LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="font-lp-body text-lp-body-sm text-lp-on-surface-variant"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-space-xs flex items-center gap-space-md">
              <a href="/login" className="font-lp-body text-lp-body-sm text-lp-on-surface-variant">
                Log in
              </a>
              <PrimaryButton href="#" className="flex-1 rounded-full px-4 py-2 text-lp-body-sm">
                Get Started
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
