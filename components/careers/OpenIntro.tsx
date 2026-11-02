import { Mail } from "lucide-react";
import { CAREERS_EMAIL, mailtoFor } from "@/lib/hiring/content";
import ApplyForm from "./ApplyForm";

/** The one black field on the page: a single sheet pinned on it. */
export default function OpenIntro() {
  return (
    <section id="introduce" className="crit-ink scroll-mt-14 bg-[var(--crit-ink)] px-5 py-24 text-white md:px-10 md:py-32">
      <div className="mx-auto grid max-w-[84rem] gap-16 lg:grid-cols-[1fr_1.15fr] lg:items-start">
        <div>
          <h2 className="crit-head text-[clamp(2rem,4.6vw,3.6rem)]">Do not see your role? Introduce yourself.</h2>
          <p className="crit-body mt-6 max-w-md text-lg leading-relaxed text-white/75">
            Roles do not always match the people who could help. Show us what you can do and what you would want to work on, and we will write when something lines up.
          </p>
          <div className="mt-10 max-w-md border-t-2 border-white/30! pt-6">
            <p className="crit-label text-white/70">Or email us</p>
            <a href={mailtoFor("Profile and portfolio")} className="mt-3 inline-flex items-center gap-3 text-[clamp(1.1rem,2.2vw,1.5rem)] font-extrabold underline decoration-[var(--crit-pencil)] decoration-[3px] underline-offset-[6px] hover:text-[#ff9b86]" style={{ fontStretch: "112%" }}>
              <Mail size={22} aria-hidden="true" /> {CAREERS_EMAIL}
            </a>
            <p className="crit-body mt-3 text-[0.95rem] text-white/70">Send your profile and a link to your portfolio or work.</p>
          </div>
        </div>
        <div className="crit-sheet crit-tilt p-7 text-[var(--crit-ink)] md:p-10" style={{ "--r": "0.8deg" } as React.CSSProperties}>
          <ApplyForm openingId={null} />
        </div>
      </div>
    </section>
  );
}
