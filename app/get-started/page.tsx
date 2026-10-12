import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { display } from "@/components/landing/fonts";
import "@/components/landing/landing.css";
import Ridgeline, { type Palette } from "@/components/landing/Ridgeline";
import PathPicker from "@/components/onboarding/PathPicker";

export const metadata: Metadata = {
  title: "Get started — Capabilio AI",
  description: "Choose how you'll use Capabilio AI.",
};

const SKY =
  "radial-gradient(70% 50% at 70% 85%, rgba(255,87,1,0.28), transparent 70%), linear-gradient(180deg,#eceeff 0%,#f4e7f1 34%,#ffdcc4 66%,#ffb88a 100%)";
const RIDGE: Palette = { far: "#f7c6c0", mid: "#6b5fd1", near: "#121634", crest: "#ffe3cc" };

export default function GetStartedPage() {
  return (
    <div className={`${display.variable} cap relative isolate min-h-screen overflow-hidden`} style={{ background: SKY }}>
      <Ridgeline className="absolute inset-x-0 bottom-0 -z-10 h-[34svh]" palette={RIDGE} layers={11} horizon={0.35} relief={0.28} interactive />

      <header className="mx-auto flex max-w-[84rem] items-center justify-between px-5 py-5 md:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/brand/icon-light.png" alt="" width={28} height={28} className="h-7 w-7" />
          <span className="font-cap-display text-xl font-semibold tracking-tight text-cap-ink">Capabilio</span>
        </Link>
        <p className="flex items-center gap-3 text-sm text-cap-ink/75">
          <span className="hidden sm:inline">Already have an account?</span>
          <Link href="/login" className="whitespace-nowrap rounded-full bg-cap-ink px-4 py-2 font-semibold text-cap-paper">
            Log in
          </Link>
        </p>
      </header>

      <main className="mx-auto max-w-[84rem] px-5 pb-40 pt-8 md:px-10 md:pt-12">
        <h1 className="font-cap-display text-[clamp(2.4rem,6vw,4.5rem)] font-bold leading-[1] tracking-[-0.035em] text-cap-ink" style={{ textWrap: "balance" }}>
          How will you use Capabilio?
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-cap-ink/80">
          Pick your path and we will take you to the right form. One login works for every path.
        </p>
        <div className="mt-10">
          <PathPicker />
        </div>
      </main>
    </div>
  );
}
