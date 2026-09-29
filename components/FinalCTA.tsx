import { ArrowRight } from "lucide-react";
import { Reveal } from "./ui";

export default function FinalCTA() {
  return (
    <section className="w-full bg-lp-surface px-margin-mobile py-space-2xl md:px-margin">
      <div className="mx-auto max-w-7xl">
        <Reveal className="relative flex flex-col items-start justify-between gap-space-xl overflow-hidden rounded-2xl bg-lp-text-ink p-space-lg text-lp-surface-card md:flex-row md:items-center md:p-space-2xl">
          <div className="pointer-events-none absolute inset-0 flex justify-between opacity-10">
            <div className="h-full w-px bg-lp-surface-card" />
            <div className="h-full w-px bg-lp-surface-card" />
            <div className="h-full w-px bg-lp-surface-card" />
            <div className="h-full w-px bg-lp-surface-card" />
          </div>

          <div className="z-10 flex max-w-2xl flex-col gap-space-sm">
            <span className="font-lp-mono text-lp-label-md font-semibold uppercase tracking-widest text-lp-secondary-fixed">
              Transition from promises to proof
            </span>
            <h2 className="font-lp-display text-lp-display-mobile font-medium leading-tight tracking-tight md:text-lp-display">
              Stop collecting certificates.
              <br />
              Start building proof.
            </h2>
            <p className="mt-1 font-lp-body text-lp-body-lg text-white/70">
              Join thousands of engineering students and self-directed builders turning raw work
              into immutable career equity.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-space-md font-lp-mono text-lp-label-sm text-white/70">
              <span>• Free to start</span>
              <span>• Instant sandbox access</span>
              <span>• No credit card required</span>
            </div>
          </div>

          <div className="z-10 flex w-full flex-col gap-space-sm md:w-auto">
            <a
              href="/get-started"
              className="inline-flex items-center justify-center gap-2 rounded bg-lp-surface-card px-8 py-4 font-lp-body text-lp-body-sm font-semibold text-lp-text-ink transition-colors hover:bg-lp-surface-subtle"
            >
              Get Started Free <ArrowRight size={18} />
            </a>
            <a
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded border border-lp-border-strong px-8 py-3.5 font-lp-body text-lp-body-sm font-medium text-lp-surface-card transition-colors hover:bg-white/10"
            >
              Schedule Campus Demo
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
