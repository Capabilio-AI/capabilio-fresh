import Image from "next/image";
import { RECOGNITIONS } from "./Recognition";

// Hash links are absolute ("/#...") so the footer works from /careers as well as from the landing page.
const FOOT = [
  { t: "Platform", l: [["Ecosystem", "/#ecosystem"], ["Capabilio OS apps", "/#platform"], ["Four paths", "/#paths"], ["Principles", "/#principles"]] },
  { t: "Start", l: [["Get started", "/get-started"], ["Student sign up", "/signup"], ["Log in", "/login"]] },
  { t: "Organisations", l: [["Colleges and companies", "/#institutions"]] },
  { t: "Company", l: [["Careers", "/careers"], ["Contact us", "/#contact"]] },
] as const;


export default function Footer() {
  return (
    <footer className="cap-night bg-[#070916] px-5 py-14 text-cap-paper md:px-10">
      <div className="mx-auto grid max-w-[84rem] gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <Image src="/brand/icon-dark.png" alt="" width={28} height={28} className="h-7 w-7" />
            <span className="font-cap-display text-xl font-semibold tracking-tight">Capabilio</span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">The career operating system for India and the rest of the world. Proof, not resumes.</p>
        </div>
        {FOOT.map((c) => (
          <nav key={c.t} aria-label={c.t}>
            <div className="text-sm font-semibold text-white/90">{c.t}</div>
            <ul className="mt-3 grid gap-2">
              {c.l.map(([label, href]) => (
                <li key={label}>
                  <a href={href} className="text-sm text-white/60 transition-colors hover:text-white">{label}</a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto mt-12 flex max-w-[84rem] flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-white/10! pt-6 text-xs text-white/45">
        <span>© 2026 Capabilio AI</span>
        <ul className="flex flex-wrap gap-2">
          {RECOGNITIONS.map((r) => (
            <li key={r.pill} className="rounded-full border border-white/15! px-3 py-1 text-white/70">
              {r.pill}
              {r.number && <span className="ml-1.5 text-white/45">{r.number}</span>}
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
