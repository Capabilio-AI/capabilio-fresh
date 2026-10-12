import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Ridgeline, { type Palette } from "./Ridgeline";

const DAWN: Palette = { far: "#ffd9bd", mid: "#8f86e0", near: "#121634", crest: "#fff0e2" };
const FOOT = [
  { t: "Platform", l: [["Ecosystem", "#ecosystem"], ["Capabilio OS apps", "#platform"], ["Four paths", "#paths"], ["Principles", "#principles"]] },
  { t: "Start", l: [["Get started", "/get-started"], ["Student sign up", "/signup"], ["Log in", "/login"]] },
  { t: "Organisations", l: [["Colleges and companies", "#institutions"]] },
] as const;

export default function Closing() {
  return (
    <>
      <section id="close" className="cap-dawn relative isolate overflow-hidden px-5 pb-32 pt-20 md:px-10 md:pb-36 md:pt-24" style={{ background: "linear-gradient(180deg,#ff7a2e 0%,#ff9a57 45%,#ffc59b 100%)" }}>
        <div className="mx-auto grid max-w-[84rem] gap-12 text-cap-ink lg:grid-cols-[1.5fr_1fr] lg:items-end">
         <div>
          <h2 data-rise className="max-w-4xl font-cap-display text-[clamp(2.8rem,8vw,6rem)] font-bold leading-[0.98] tracking-[-0.035em]" style={{ textWrap: "balance" }}>
            Start with your next step.
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-cap-ink/85">
            Students begin with a diagnostic and a career map. Organisations begin with a cohort and a calendar. Everyone ends with proof.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/get-started" className="group inline-flex items-center gap-2 rounded-full bg-cap-ink px-7 py-4 text-base font-semibold text-cap-paper transition-transform hover:-translate-y-0.5">
              Get started
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/login" className="inline-flex items-center rounded-full border border-cap-ink/45! px-7 py-4 text-base font-semibold hover:bg-cap-ink/10">
              Log in
            </Link>
          </div>
         </div>
          <ol className="grid gap-5 lg:pb-3">
            {["Take the diagnostic for your career", "Read your map: what is measured, what is not", "Do the one next step, then watch the number move"].map((t, i) => (
              <li key={t} className="flex gap-4 border-t border-cap-ink/35! pt-4 text-lg font-medium leading-snug">
                <span className="font-mono text-sm">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </div>
        <Ridgeline className="absolute inset-x-0 bottom-0 -z-10 h-24 md:h-28" palette={DAWN} layers={13} horizon={0.4} relief={0.26} interactive />
      </section>

      <footer className="cap-night bg-[#070916] px-5 py-14 text-cap-paper md:px-10">
        <div className="mx-auto grid max-w-[84rem] gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
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
        <div className="mx-auto mt-12 max-w-[84rem] border-t border-white/10! pt-6 text-xs text-white/45">© 2026 Capabilio AI</div>
      </footer>
    </>
  );
}
