import type { ReactNode } from "react";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";

/** The head every tabbed page shares: title, one line of purpose, then the tab bar (the dashboard's by default). */
export function PageHead({ title, intro, nav, children }: { title: string; intro: string; nav?: ReactNode; children?: ReactNode }) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-lp-display text-[30px] font-bold leading-[1.08] tracking-tight text-[var(--m-ink)] sm:text-[40px]">{title}</h1>
          <p className="mt-1.5 max-w-2xl font-lp-body text-[15px] leading-relaxed text-app-muted">{intro}</p>
        </div>
        {children}
      </div>
      <div className="mt-3 print:hidden">{nav ?? <DashboardSubNav />}</div>
    </div>
  );
}
