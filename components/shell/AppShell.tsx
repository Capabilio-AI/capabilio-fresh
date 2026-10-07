import type { ReactNode } from "react";
import { Topbar } from "@/components/shell/Topbar";
import { HeaderNav } from "@/components/shell/HeaderNav";
import type { ViewerSummary } from "@/lib/dashboard/viewer";
import { MentorWidget } from "@/components/mentor/MentorWidget";
import { MessagingProvider } from "@/components/messages/MessagingProvider";
import { DirectionProvider } from "@/components/direction/DirectionContext";

export function AppShell({ viewer, banner, children }: { viewer: ViewerSummary; banner?: ReactNode; children: ReactNode }) {
  return (
    <DirectionProvider isJobTrack={viewer.direction?.track === "job"}>
      <MessagingProvider userId={viewer.id}>
      <div className="min-h-screen bg-app-background">
        <Topbar viewer={viewer} />
        <HeaderNav inDirectionWindow={viewer.direction?.inDirectionWindow ?? false} />
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          {banner}
          {children}
        </main>
        <MentorWidget />
      </div>
      </MessagingProvider>
    </DirectionProvider>
  );
}
