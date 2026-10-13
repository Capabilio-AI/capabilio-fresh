import type { ReactNode } from "react";
import { SettingsNav } from "@/components/settings/SettingsNav";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-lp-display text-[30px] font-bold leading-[1.08] tracking-tight text-[var(--m-ink)] sm:text-[40px]">Settings</h1>
      <p className="mt-1 font-lp-body text-[13.5px] text-[var(--m-muted)]">Your account, how you sign in, and what other people can see.</p>
      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:gap-10">
        <SettingsNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
