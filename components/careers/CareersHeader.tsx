import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const LINKS = [
  { label: "How we hire", href: "/careers#process" },
  { label: "Open roles", href: "/careers#roles" },
  { label: "FAQ", href: "/careers#faq" },
  { label: "Introduce yourself", href: "/careers#introduce" },
];

/** The careers title block: a plain black bar, not the landing page's floating glass nav. */
export default function CareersHeader() {
  return (
    <header className="crit-ink sticky top-0 z-40 bg-[var(--crit-ink)] text-white">
      <nav className="mx-auto flex h-14 max-w-[84rem] items-center justify-between gap-4 px-5 md:px-10" aria-label="Careers">
        <Link href="/careers" className="flex items-center gap-3">
          <Image src="/brand/icon-dark.png" alt="" width={24} height={24} className="h-6 w-6" />
          <span className="text-[0.95rem] font-extrabold tracking-tight" style={{ fontStretch: "112%" }}>Capabilio</span>
          <span className="hidden border-l border-white/30! pl-3 text-xs font-bold uppercase tracking-[0.12em] text-white/70 sm:inline">Careers</span>
        </Link>
        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-semibold text-white/75 transition-colors hover:text-white">
              {l.label}
            </Link>
          ))}
        </div>
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/75 transition-colors hover:text-white">
          Main site <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </nav>
    </header>
  );
}
