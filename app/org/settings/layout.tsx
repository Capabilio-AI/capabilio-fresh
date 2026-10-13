import type { ReactNode } from "react";
import { OrgSettingsNav } from "@/components/org/OrgSettingsNav";

export default function OrgSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl pb-16 pt-4">
      <h1 className="text-[30px] font-extrabold leading-[1.08] tracking-tight text-[var(--m-ink)] sm:text-[38px]">Settings</h1>
      <p className="mt-1 text-[13.5px] text-[var(--m-muted)]">Your organisation, your team&apos;s access, and how you sign in.</p>
      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:gap-10">
        <OrgSettingsNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
