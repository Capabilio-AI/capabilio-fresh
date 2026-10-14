import { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { display } from "@/components/landing/fonts";
import "@/components/landing/landing.css";
import Ridgeline, { type Palette } from "@/components/landing/Ridgeline";
import { AuthJourney } from "./AuthJourney";
import type { ShellPath } from "@/lib/onboarding/auth-path";

const SKY =
  "radial-gradient(70% 50% at 25% 90%, rgba(255,87,1,0.22), transparent 70%), linear-gradient(180deg,#eceeff 0%,#f4e7f1 36%,#ffdcc4 70%,#ffb88a 100%)";
const RIDGE: Palette = { far: "#f7c6c0", mid: "#6b5fd1", near: "#121634", crest: "#ffe3cc" };

const COPY: Record<ShellPath, { title: string; lead: string; body: string; journeyLabel: string }> = {
  student: {
    title: "Build. Practice. Prove.",
    lead: "Your career operating system.",
    body: "Learn the right skills, build real projects, prove your capability, and carry a Skill Passport anyone can verify.",
    journeyLabel: "The Capabilio journey",
  },
  professional: {
    title: "Your work, verified.",
    lead: "Early access for working professionals.",
    body: "Turn the work you already do into evidence-backed capability. Join the list and we will open your path as soon as it is ready.",
    journeyLabel: "What is coming",
  },
  executive: {
    title: "Leadership, on the record.",
    lead: "Early access for founders and leaders.",
    body: "Build an evidence-backed leadership and professional profile. Join the list and we will tell you when it opens.",
    journeyLabel: "What is coming",
  },
  organisation: {
    title: "Understand your people.",
    lead: "Connect, assess and develop, with evidence, not claims.",
    body: "For colleges, universities and companies. Organisation accounts are reviewed manually before they are activated.",
    journeyLabel: "Organisation onboarding",
  },
};

function Brand({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image src="/brand/icon-light.png" alt="" width={30} height={30} className="h-[30px] w-[30px]" priority />
      <span className="font-cap-display text-xl font-semibold tracking-tight text-cap-ink">Capabilio</span>
    </Link>
  );
}

export function AuthLayout({ children, path = "student" }: { children: ReactNode; path?: ShellPath }) {
  const copy = COPY[path];
  return (
    <div className={`${display.variable} cap cap-auth relative isolate min-h-screen overflow-hidden`} style={{ background: SKY }}>
      <div aria-hidden="true" className="cap-aurora pointer-events-none absolute inset-0 -z-10">
        <span className="-left-[8vw] top-[8vh] h-[42vh] w-[42vh] bg-cap-indigo/45" />
        <span className="right-[6vw] top-[22vh] h-[38vh] w-[38vh] bg-cap-orange/40 [animation-delay:-6s]" />
        <span className="bottom-[18vh] left-[34vw] h-[30vh] w-[30vh] bg-cap-apricot/60 [animation-delay:-11s]" />
      </div>
      <Ridgeline className="absolute inset-x-0 bottom-0 -z-10 h-[30svh]" palette={RIDGE} layers={10} horizon={0.35} relief={0.28} interactive />
      <div className="mx-auto grid min-h-screen max-w-[84rem] gap-10 px-5 md:px-10 lg:grid-cols-[1fr_minmax(0,34rem)] lg:gap-16">
        <aside className="hidden flex-col justify-center py-16 lg:flex">
          <Brand />
          <h1 className="mt-10 font-cap-display text-[clamp(2.4rem,4.6vw,4rem)] font-bold leading-[1] tracking-[-0.035em] text-cap-ink" style={{ textWrap: "balance" }}>
            {copy.title}
          </h1>
          <p className="mt-4 max-w-md text-xl font-medium leading-snug text-cap-ink">{copy.lead}</p>
          <p className="mt-2 max-w-md text-[15px] leading-relaxed text-cap-ink/75">{copy.body}</p>
          <AuthJourney path={path} label={copy.journeyLabel} />
          {path === "organisation" && (
            <p className="mt-8 flex max-w-md items-start gap-2 text-sm leading-relaxed text-cap-ink/75">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-cap-indigo" />
              Every new organisation is checked by our team. You can sign in at any time to see where your application stands.
            </p>
          )}
        </aside>

        <main className="flex flex-col items-center justify-center py-10 pb-44 lg:pb-40 lg:pt-8">
          <Brand className="mb-8 lg:hidden" />
          {children}
        </main>
      </div>
    </div>
  );
}
