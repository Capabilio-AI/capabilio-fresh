import type { ReactNode } from "react";
import { Topbar } from "@/components/shell/Topbar";
import { HeaderNav } from "@/components/shell/HeaderNav";
import type { ViewerSummary } from "@/lib/dashboard/viewer";
import { MentorWidget } from "@/components/mentor/MentorWidget";
import { CallOverlay } from "@/components/messages/CallOverlay";
import { CallProvider } from "@/components/messages/CallProvider";
import { MessagingProvider } from "@/components/messages/MessagingProvider";
import "@/components/metro/metro.css";
import { metroFontVars } from "@/components/metro/font";
import { AreaMain } from "@/components/shell/AreaMain";
import { DirectionProvider } from "@/components/direction/DirectionContext";
import type { CareerStage } from "@/lib/stage/stage";

export function AppShell({ viewer, stage, banner, children }: { viewer: ViewerSummary; stage: CareerStage; banner?: ReactNode; children: ReactNode }) {
  // A graduate is job-hunting now, so Launchpad is open for them whatever their old programme dates say.
  const launchpadOpen = stage === "graduate" || (viewer.direction?.launchpadOpen ?? false);
  return (
    <DirectionProvider isJobTrack={stage === "student" ? viewer.direction?.track === "job" : true} launchpadOpen={launchpadOpen} stage={stage}>
      <MessagingProvider userId={viewer.id}>
      <CallProvider>
      <div className={`metro ${metroFontVars} min-h-screen bg-[var(--m-ground)]`}>
        <Topbar viewer={viewer} />
        <HeaderNav stage={stage} launchpadOpen={launchpadOpen} />
        <AreaMain>
          {banner}
          {children}
        </AreaMain>
        <MentorWidget />
      </div>
        <CallOverlay />
      </CallProvider>
      </MessagingProvider>
    </DirectionProvider>
  );
}
