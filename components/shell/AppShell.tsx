import type { ReactNode } from "react";
import { Topbar } from "@/components/shell/Topbar";
import { HeaderNav } from "@/components/shell/HeaderNav";
import type { ViewerSummary } from "@/lib/dashboard/viewer";

export function AppShell({ viewer, banner, children }: { viewer: ViewerSummary; banner?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-app-background">
      <Topbar viewer={viewer} />
      <HeaderNav inDirectionWindow={viewer.direction?.inDirectionWindow ?? false} />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        {banner}
        {children}
      </main>
    </div>
  );
}
