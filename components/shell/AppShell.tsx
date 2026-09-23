"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { MobileDrawer } from "@/components/shell/MobileDrawer";
import { Topbar } from "@/components/shell/Topbar";
import type { ViewerSummary } from "@/lib/dashboard/viewer";

export function AppShell({ viewer, children }: { viewer: ViewerSummary; children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-app-background">
      <Sidebar year={viewer.year} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} year={viewer.year} />
      <div className="lg:pl-[240px]">
        <Topbar viewer={viewer} onMenuClick={() => setDrawerOpen(true)} />
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
