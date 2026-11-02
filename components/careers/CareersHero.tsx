import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { CAREERS_EMAIL, SAMPLE_BRIEF, mailtoFor } from "@/lib/hiring/content";
import PencilMark from "./PencilMark";

export default function CareersHero({ openCount }: { openCount: number }) {
  return (
    <section className="px-5 pb-24 pt-14 md:px-10 md:pb-32 md:pt-20">
      <div className="mx-auto grid max-w-[84rem] gap-20 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <h1 className="text-[clamp(2.6rem,6.4vw,5.6rem)]">
            <span className="crit-title-light block text-[var(--crit-soft)]">Show the work.</span>
            <span className="crit-title block">We will read it.</span>
          </h1>
          <p className="crit-body mt-8 max-w-xl text-lg leading-relaxed text-[var(--crit-soft)]">
            Capabilio exists because proof beats a resume, so that is how we hire. Send us something you built, solved or shipped, and the conversation starts there.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a href="#roles" className="crit-btn crit-btn-ink">
              See open roles <ArrowDown size={18} aria-hidden="true" />
            </a>
            <Link href="#introduce" className="crit-btn crit-btn-line">
              Introduce yourself <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <p role="status" className="crit-strip mt-9 max-w-full">
            <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 ${openCount > 0 ? "bg-[#ff6b4d]" : "border border-white/70!"}`} />
            {openCount > 0 ? `${openCount} open ${openCount === 1 ? "role" : "roles"} right now` : "No open roles right now, but you can still introduce yourself"}
          </p>
          <p className="crit-body mt-5 text-[0.95rem] text-[var(--crit-soft)]">
            Prefer email? Send your profile and portfolio to{" "}
            <a href={mailtoFor("Profile and portfolio")} className="font-bold text-[var(--crit-ink)] underline decoration-[var(--crit-pencil)] decoration-2 hover:text-[var(--crit-pencil)]">{CAREERS_EMAIL}</a>.
          </p>
        </div>

        <div aria-hidden="true" className="crit-sheet crit-pinup mx-auto w-full max-w-md" style={{ "--r": "2deg", "--r0": "-4deg", "--d": "0.1s" } as React.CSSProperties}>
          <div className="flex items-center justify-between border-b-2 border-[var(--crit-ink)]! px-6 pb-3 pt-6">
            <span className="crit-label">Apply with proof</span>
            <span className="crit-label border border-[var(--crit-ink)]! px-2 py-0.5">{SAMPLE_BRIEF.role}</span>
          </div>
          <div className="grid gap-6 px-6 pb-7 pt-6">
            {SAMPLE_BRIEF.fields.map((f) => (
              <div key={f.label}>
                <div className="text-[0.8rem] font-bold">{f.label}</div>
                <div className="mt-2 border-b-2 border-[var(--crit-ink)]! pb-2 text-[0.95rem] text-[var(--crit-soft)]">{f.value}</div>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 pt-2">
              <span className="relative text-[0.85rem] font-semibold">
                Resume: optional
                <PencilMark kind="underline" className="-bottom-2 left-0 h-2.5 w-full" delay="1.3s" />
              </span>
              <span className="relative inline-block">
                <span className="crit-btn crit-btn-ink px-4 py-2.5 text-[0.8rem]">Send my proof</span>
                <PencilMark kind="circle" className="-left-4 -top-3 h-[calc(100%+1.5rem)] w-[calc(100%+2rem)]" delay="0.95s" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
